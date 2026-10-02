"""Local Qwen ASR runner using the same immutable audio manifests as other engines."""
import argparse
import importlib.metadata
import json
import os
from pathlib import Path
import time

from wiki_asr_pilot import save, sha256
from wiki_asr_gate import write_sidecar


def run(root, max_tokens=8192):
    os.environ.setdefault('HF_HOME', str(root.resolve().parent / 'hf-cache'))
    import mlx.core as mx
    from huggingface_hub import snapshot_download
    from mlx_audio.stt import load
    model_id = 'mlx-community/Qwen3-ASR-1.7B-bf16'
    model_path = snapshot_download(model_id, local_files_only=True)
    settings = {'model': model_id, 'revision': Path(model_path).name,
                'mlx_audio_version': importlib.metadata.version('mlx-audio'),
                'mlx_version': importlib.metadata.version('mlx'),
                'language': 'Russian', 'temperature': 0, 'max_tokens': max_tokens,
                'chunk_duration': 30.0, 'timestamps': 'chunk boundaries, not word alignment'}
    start = time.monotonic()
    model = load(model_path)
    save(root / 'qwen' / 'run.json', {'settings': settings, 'setup_seconds': time.monotonic() - start})
    for clip in json.loads((root / 'manifest.json').read_text())['clips']:
        target = root / 'qwen' / (clip['id'] + '.json')
        if sha256(clip['path']) != clip['sha256']:
            raise ValueError('Audio changed')
        if target.exists():
            prior = json.loads(target.read_text())
            if prior['audio_sha256'] != clip['sha256'] or prior['settings'] != settings:
                raise ValueError('Cached result mismatch')
            write_sidecar(target, root / 'quality' / 'qwen' / target.name)
            continue
        mx.reset_peak_memory()
        start = time.monotonic()
        result = model.generate(clip['path'], language='Russian', temperature=0,
                                max_tokens=max_tokens, chunk_duration=30.0, verbose=False)
        elapsed = time.monotonic() - start
        save(target, {'clip_id': clip['id'], 'audio_sha256': clip['sha256'],
                      'settings': settings, 'text': result.text,
                      'seconds': clip['seconds'], 'elapsed_seconds': elapsed,
                      'peak_mlx_bytes': mx.get_peak_memory(),
                      'generation_tokens': result.generation_tokens,
                      'possibly_truncated': result.generation_tokens >= max_tokens,
                      'verified_by_listener': False})
        write_sidecar(target, root / 'quality' / 'qwen' / target.name)
        print(clip['id'], round(elapsed, 2), 'seconds', flush=True)
        mx.clear_cache()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--max-tokens', type=int, default=8192)
    args = parser.parse_args()
    if args.max_tokens < 1: parser.error('--max-tokens must be positive')
    run(args.root, args.max_tokens)
