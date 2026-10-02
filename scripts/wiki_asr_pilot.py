"""Reproducible private ASR pilot; never sends audio to a remote inference API."""
from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import resource
import subprocess
import time
import wave

try:
    from .wiki_asr_gate import write_sidecar
except ImportError:
    from wiki_asr_gate import write_sidecar


MODELS = {
    'large': 'mlx-community/whisper-large-v3-mlx',
    'turbo': 'mlx-community/whisper-large-v3-turbo',
    'parakeet': 'mlx-community/parakeet-tdt-0.6b-v3',
}


def sha256(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def save(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + '.tmp')
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    temp.replace(path)


def duration(path):
    with wave.open(str(path)) as f:
        return f.getnframes() / f.getframerate()


def prepare(args):
    root = Path(args.output)
    if (root / 'manifest.json').exists():
        raise SystemExit('Manifest already exists: use another output directory.')
    clips = []
    for index, path in enumerate(sorted(Path(args.source).glob('*.wav')), 1):
        length = duration(path)
        source_hash = sha256(path)
        # Smoke: one middle excerpt per source; pilot: early/middle/late.
        offsets = [max(0, (length - 90) / 2)] if args.smoke else [30, length * .42, length - 270]
        seconds = 90 if args.smoke else 240
        for part, offset in enumerate(offsets, 1):
            offset = max(0, min(offset, length - seconds))
            target = root / 'audio' / f'sample-{index:02d}-{part}.wav'
            target.parent.mkdir(parents=True, exist_ok=True)
            subprocess.run(['ffmpeg', '-v', 'error', '-nostdin', '-i', str(path),
                            '-ss', str(offset), '-t', str(seconds), '-vn', '-ar', '16000',
                            '-ac', '1', '-c:a', 'pcm_s16le', str(target)], check=True)
            clips.append({'id': target.stem, 'path': str(target.resolve()),
                          'source_path': str(path), 'source_sha256': source_hash,
                          'source_offset_seconds': offset, 'seconds': duration(target),
                          'sha256': sha256(target), 'reference_status': 'not_listened',
                          'sampling': 'deterministic_position_not_quality_stratified'})
    silent = root / 'audio' / 'control-silence.wav'
    silent.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(silent), 'wb') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(16000)
        f.writeframes(b'\x00\x00' * 16000 * 15)
    clips.append({'id': 'control-silence', 'path': str(silent.resolve()),
                  'source_offset_seconds': 0, 'seconds': 15, 'sha256': sha256(silent),
                  'reference_status': 'synthetic_silence', 'reference_text': ''})
    save(root / 'manifest.json', {'schema': 1, 'clips': clips,
                                'note': 'Old local samples only; not a fresh-corpus representative evaluation.'})
    print(json.dumps({'clips': len(clips), 'audio_seconds': sum(x['seconds'] for x in clips)}))


def run(args):
    root = Path(args.output)
    manifest = json.loads((root / 'manifest.json').read_text())
    os.environ.setdefault('HF_HOME', str(root.resolve().parent / 'hf-cache'))
    os.environ.setdefault('HF_HUB_DISABLE_PROGRESS_BARS', '1')
    if args.download_only:
        from huggingface_hub import snapshot_download
        path = snapshot_download(MODELS[args.model])
        print(json.dumps({'downloaded_model':MODELS[args.model], 'snapshot':Path(path).name}), flush=True)
        return
    import mlx.core as mx
    started = time.monotonic()
    if args.model == 'parakeet':
        from parakeet_mlx import from_pretrained
        model = from_pretrained(MODELS[args.model])
        package = 'parakeet-mlx'
    else:
        import mlx_whisper
        # Load before the first measurement; download/startup recorded separately.
        from mlx_whisper.transcribe import ModelHolder
        model = ModelHolder.get_model(MODELS[args.model], mx.float16)
        package = 'mlx-whisper'
    setup_seconds = time.monotonic() - started
    settings = {'model': MODELS[args.model], 'package': package,
                'package_version': importlib.metadata.version(package),
                'mlx_version': importlib.metadata.version('mlx'),
                'language': 'ru' if args.model != 'parakeet' else 'auto',
                'word_timestamps': True, 'temperature': 0 if args.model != 'parakeet' else None,
                'vad': False, 'condition_on_previous_text': False if args.model != 'parakeet' else None}
    if manifest.get('vad'):
        settings['input_vad'] = manifest['vad']
        settings['input_grouping'] = manifest.get('grouping')
    # Include weight revisions used from the HF cache in run metadata.
    cached = Path(os.environ['HF_HOME']) / 'hub' / ('models--' + MODELS[args.model].replace('/', '--')) / 'snapshots'
    settings['cached_snapshot_revisions'] = sorted(x.name for x in cached.iterdir()) if cached.exists() else []
    save(root / args.model / 'run.json', {'settings': settings, 'setup_seconds': setup_seconds})
    for clip in manifest['clips']:
        output = root / args.model / (clip['id'] + '.json')
        if output.exists():
            prior = json.loads(output.read_text())
            if prior.get('audio_sha256') == clip['sha256'] and prior.get('settings') == settings:
                if sha256(clip['path']) != clip['sha256']:
                    raise ValueError('Cached audio hash changed')
                write_sidecar(output, root / 'quality' / args.model / output.name)
                print('skip', clip['id'], flush=True)
                continue
            raise ValueError('Existing result has different input/settings; use a new output directory')
        if sha256(clip['path']) != clip['sha256']:
            raise ValueError('Audio hash changed')
        print('start', args.model, clip['id'], flush=True)
        mx.reset_peak_memory()
        t0 = time.monotonic()
        if args.model == 'parakeet':
            result = model.transcribe(clip['path'])
            text = result.text
            segments = [{'text': s.text, 'start': s.start, 'end': s.end} for s in result.sentences]
        else:
            result = mlx_whisper.transcribe(clip['path'], path_or_hf_repo=MODELS[args.model],
                       language='ru', task='transcribe', word_timestamps=True,
                       temperature=0, condition_on_previous_text=False, verbose=None)
            text, segments = result['text'], result['segments']
        elapsed = time.monotonic() - t0
        for s in segments:
            s['source_start'] = clip['source_offset_seconds'] + float(s['start'])
            s['source_end'] = clip['source_offset_seconds'] + float(s['end'])
        save(output, {'clip_id': clip['id'], 'audio_sha256': clip['sha256'],
                      'seconds': clip['seconds'], 'elapsed_seconds': elapsed,
                      'rtf': elapsed / clip['seconds'], 'peak_mlx_bytes': mx.get_peak_memory(),
                      'process_peak_rss_bytes': resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
                      'settings': settings, 'text': text, 'segments': segments,
                      'reference_status': clip['reference_status'], 'quality_scored': False})
        write_sidecar(output, root / 'quality' / args.model / output.name)
        print(json.dumps({'model': args.model, 'clip': clip['id'], 'seconds': round(elapsed, 2),
                          'rtf': round(elapsed / clip['seconds'], 3)}), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest='command', required=True)
    p = sub.add_parser('prepare')
    p.add_argument('--source', required=True)
    p.add_argument('--output', required=True)
    p.add_argument('--smoke', action='store_true')
    r = sub.add_parser('run')
    r.add_argument('--output', required=True)
    r.add_argument('--model', choices=MODELS, required=True)
    r.add_argument('--download-only', action='store_true')
    args = parser.parse_args()
    (prepare if args.command == 'prepare' else run)(args)
