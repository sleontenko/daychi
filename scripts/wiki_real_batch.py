"""Prepare full local recordings with VAD and report paired ASR discrepancies."""
import argparse
import importlib.metadata
import json
from pathlib import Path
import time

try:
    from .wiki_asr_pilot import save, sha256
    from .wiki_asr_score import errors, words
except ImportError:
    from wiki_asr_pilot import save, sha256
    from wiki_asr_score import errors, words


def windows(intervals, max_samples=120 * 16000, gap_samples=2 * 16000):
    """Group nearby VAD spans without joining long pauses or overlapping chunks."""
    output = []
    for span in intervals:
        start, end = int(span['start']), int(span['end'])
        if end <= start or start < 0 or (output and start < output[-1]['end']):
            raise ValueError('Invalid/overlapping VAD spans')
        if end - start > max_samples:
            raise ValueError('VAD span exceeds chunk limit')
        if output and start - output[-1]['end'] <= gap_samples and end - output[-1]['start'] <= max_samples:
            output[-1]['end'] = end
        else:
            output.append({'start': start, 'end': end})
    return output


def prepare(root, source):
    import numpy as np
    import soundfile as sf
    import torch
    from silero_vad import load_silero_vad, get_speech_timestamps
    if (root / 'manifest.json').exists():
        raise ValueError('Manifest exists: use existing batch or another directory')
    torch.set_num_threads(1)
    model = load_silero_vad()
    settings = {'package': 'silero-vad', 'version': importlib.metadata.version('silero-vad'),
                'sampling_rate': 16000, 'threshold': 0.5, 'min_speech_duration_ms': 250,
                'min_silence_duration_ms': 500, 'speech_pad_ms': 300,
                'max_speech_duration_s': 60}
    params = {k: v for k, v in settings.items() if k not in ['package', 'version']}
    controls = {}
    rng = np.random.default_rng(20260928)
    for name, data in [('silence', np.zeros(16000 * 15, dtype='float32')),
                       ('white_noise', rng.normal(0, 0.01, 16000 * 15).astype('float32'))]:
        controls[name] = get_speech_timestamps(torch.from_numpy(data), model, **params)
    if any(controls.values()):
        raise ValueError('VAD failed negative controls')
    clips, sources, seen = [], [], set()
    started = time.monotonic()
    root.mkdir(parents=True, exist_ok=True)
    for index, path in enumerate(sorted(source.glob('*.wav')), 1):
        digest = sha256(path)
        if digest in seen:
            continue
        seen.add(digest)
        audio, sr = sf.read(path, dtype='float32')
        if sr != 16000 or audio.ndim != 1:
            raise ValueError('Pilot requires 16 kHz mono WAV inputs')
        spans = get_speech_timestamps(torch.from_numpy(audio), model, **params)
        chunks = windows(spans)
        sid = f'recording-{index:02d}'
        gaps, cursor = [], 0
        for span in chunks:
            if span['start'] > cursor:
                gaps.append({'start': cursor / sr, 'end': span['start'] / sr})
            cursor = span['end']
        if cursor < len(audio):
            gaps.append({'start': cursor / sr, 'end': len(audio) / sr})
        sources.append({'id': sid, 'path': str(path.resolve()), 'sha256': digest,
                        'seconds': len(audio) / sr, 'vad_spans': spans, 'excluded_intervals': gaps,
                        'chunk_count': len(chunks), 'kept_seconds': sum(c['end']-c['start'] for c in chunks) / sr})
        for part, chunk in enumerate(chunks):
            target = root / 'audio' / f'{sid}-{part:04d}.wav'
            target.parent.mkdir(exist_ok=True)
            sf.write(target, audio[chunk['start']:chunk['end']], sr, subtype='PCM_16')
            clips.append({'id': target.stem, 'recording_id': sid, 'path': str(target.resolve()),
                          'sha256': sha256(target), 'source_path': str(path.resolve()),
                          'source_sha256': digest, 'source_offset_seconds': chunk['start'] / sr,
                          'seconds': (chunk['end']-chunk['start']) / sr,
                          'reference_status': 'real_recording_unverified'})
        print(sid, round(len(audio)/sr), 'seconds', len(chunks), 'chunks', flush=True)
    save(root / 'manifest.json', {'schema': 1, 'clips': clips, 'sources': sources,
         'vad': settings, 'grouping': {'max_seconds': 120, 'join_gap_seconds': 2},
         'controls': controls, 'prepare_seconds': time.monotonic()-started,
         'note': 'Full old local recordings, exact-file dedup only; VAD omissions require validation.'})
    print('prepared', len(sources), 'recordings', len(clips), 'chunks', flush=True)


def stamp(seconds):
    seconds = int(seconds)
    return f'{seconds//3600:02}:{seconds%3600//60:02}:{seconds%60:02}'


def report(root):
    manifest = json.loads((root / 'manifest.json').read_text())
    label_path = root / 'catalog-labels.json'
    labels = json.loads(label_path.read_text()) if label_path.exists() else {}
    rows, problems = [], []
    index = ['# Пилот на полных записях', '', 'Расхождения моделей не являются измеренной ошибкой. Тексты не одобрены для вики.', '']
    for source in manifest['sources']:
        counts = {'distance': 0, 'denominator': 0, 'flagged_chunks': 0,
                  'turbo_seconds': 0, 'parakeet_seconds': 0}
        title = labels.get(source['id'], [{}])[0].get('title', source['id'])
        lines = [f'# {title}', '', f'[Исходное аудио]({source["path"]})', '',
                 'Черновик Whisper Turbo с таймкодами исходника. Не проверен прослушиванием.', '']
        for clip in [c for c in manifest['clips'] if c['recording_id'] == source['id']]:
            results = {name: json.loads((root/name/(clip['id']+'.json')).read_text()) for name in ['turbo','parakeet']}
            for name, r in results.items():
                if r['audio_sha256'] != clip['sha256'] or sha256(clip['path']) != clip['sha256']:
                    raise ValueError('Audio/result mismatch')
                counts[name+'_seconds'] += r['elapsed_seconds']
            a, b = (words(results[n]['text']) for n in ['turbo','parakeet'])
            distance = errors(a,b)['errors']
            denom = max(len(a),len(b))
            ratio = distance / denom if denom else 0
            counts['distance'] += distance
            counts['denominator'] += denom
            reasons = []
            if ratio > .15:
                reasons.append('word_disagreement_above_15_percent')
            if bool(a) != bool(b):
                reasons.append('one_engine_empty')
            if not a and not b:
                reasons.append('both_empty_on_vad_speech')
            for name, tokens in [('turbo',a),('parakeet',b)]:
                if '<unk>' in results[name]['text']:
                    reasons.append(name+'_invalid_unknown_tokens')
                if tokens and len(tokens)/clip['seconds'] > 5:
                    reasons.append(name+'_high_word_rate')
                for segment in results[name]['segments']:
                    if segment.get('avg_logprob', 0) < -1 or segment.get('compression_ratio', 0) > 2.4:
                        reasons.append(name+'_low_confidence_or_repetition')
                    if not 0 <= float(segment['start']) <= float(segment['end']) <= clip['seconds']+1:
                        reasons.append(name+'_timestamp_out_of_bounds')
                        break
            reasons = sorted(set(reasons))
            if reasons:
                counts['flagged_chunks'] += 1
                problems.append({'clip_id':clip['id'],'recording_id':source['id'],
                    'source_offset_seconds':clip['source_offset_seconds'], 'seconds':clip['seconds'],
                    'audio_path':clip['path'],'normalized_distance':ratio,'reasons':reasons,
                    'turbo':results['turbo']['text'],'parakeet':results['parakeet']['text']})
            for segment in results['turbo']['segments']:
                lines += [f'[{stamp(segment["source_start"])}] {segment["text"].strip()}', '']
        target=root/(source['id']+'.md')
        target.write_text('\n'.join(lines)+'\n')
        row = {'recording_id':source['id'],'source_seconds':source['seconds'],
               'kept_seconds':source['kept_seconds'],'chunks':source['chunk_count'],**counts,
               'normalized_distance':counts['distance']/counts['denominator'] if counts['denominator'] else None}
        rows.append(row)
        index += [f'- [{title}]({target.resolve()}): {stamp(source["seconds"])}, {row["flagged_chunks"]}/{row["chunks"]} фрагментов требуют проверки.']
    save(root/'summary.json',{'recordings':rows,'flags_are_heuristic':True,
                             'controls':manifest['controls'],'vad':manifest['vad']})
    problems.sort(key=lambda p:p['normalized_distance'],reverse=True)
    save(root/'review-queue.json',{'items':problems})
    review=['# Фрагменты для дополнительной проверки', '', 'Порог 15% — эвристика для сортировки, не порог истинной ошибки.', '']
    for p in problems:
        review += [f'## {p["clip_id"]} — {stamp(p["source_offset_seconds"])}', '',
            f'[Аудиофрагмент]({p["audio_path"]})', '', f'Расхождение: {p["normalized_distance"]:.1%}; {", ".join(p["reasons"])}', '',
            '**Turbo**', '',p['turbo'],'','**Parakeet**','',p['parakeet'],'']
    (root/'review-queue.md').write_text('\n'.join(review)+'\n')
    index += ['', f'[Спорные фрагменты]({(root/"review-queue.md").resolve()})']
    (root/'README.md').write_text('\n'.join(index)+'\n')
    print(json.dumps(rows,indent=2))


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command',choices=['prepare','report'])
    parser.add_argument('--root',type=Path,required=True)
    parser.add_argument('--source',type=Path)
    args=parser.parse_args()
    if args.command=='prepare':
        if args.source is None:parser.error('--source required for prepare')
        prepare(args.root,args.source)
    else:report(args.root)
