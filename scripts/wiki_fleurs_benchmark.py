"""Prepare fixed FLEURS test rows and score local engines against supplied references."""
import argparse
import io
import json
from pathlib import Path

from wiki_asr_pilot import save, sha256
from wiki_asr_score import errors, words


def prepare(root):
    import pyarrow.parquet as pq
    import soundfile as sf
    if (root / 'manifest.json').exists():
        raise ValueError('Manifest exists; do not change a benchmark after inference')
    source = json.loads((root / 'source.json').read_text())
    rows = next(pq.ParquetFile(source['file']).iter_batches(batch_size=100)).to_pylist()
    clips = []
    for index, row in enumerate(rows):
        audio = row['audio']
        samples, sr = sf.read(io.BytesIO(audio['bytes']))
        target = root / 'audio' / f'fleurs-{index:03d}.wav'
        target.parent.mkdir(exist_ok=True)
        sf.write(target, samples, sr, subtype='PCM_16')
        clips.append({'id': target.stem, 'dataset_id': row['id'],
                      'path': str(target.resolve()), 'sha256': sha256(target),
                      'seconds': len(samples) / sr, 'source_offset_seconds': 0,
                      'reference_text': row['transcription'],
                      'raw_reference_text': row['raw_transcription'],
                      'reference_status': 'dataset_supplied_not_locally_listened'})
    save(root / 'manifest.json', {'schema': 1, 'source': source, 'clips': clips,
        'note': 'First 100 official Russian FLEURS test rows; read speech, not school lectures.'})
    print(json.dumps({'clips': len(clips), 'seconds': sum(c['seconds'] for c in clips)}))


def report(root):
    manifest = json.loads((root / 'manifest.json').read_text())
    rows = []
    for name in ['large', 'turbo', 'parakeet', 'qwen']:
        totals = {'errors': 0, 'reference_words': 0, 'char_errors': 0, 'reference_chars': 0,
                  'elapsed_seconds': 0, 'audio_seconds': 0, 'peak_mlx_bytes': 0}
        details = []
        for clip in manifest['clips']:
            result = json.loads((root / name / (clip['id'] + '.json')).read_text())
            if result['audio_sha256'] != clip['sha256'] or sha256(clip['path']) != clip['sha256']:
                raise ValueError('Audio mismatch')
            if result.get('possibly_truncated'):
                raise ValueError('Possibly truncated output')
            ref, hyp = words(clip['reference_text']), words(result['text'])
            word_result = errors(ref, hyp)
            char_result = errors(list(' '.join(ref)), list(' '.join(hyp)))
            details.append({'id': clip['id'], **word_result,
                            'reference': clip['reference_text'], 'hypothesis': result['text']})
            totals['errors'] += word_result['errors']
            totals['reference_words'] += len(ref)
            totals['char_errors'] += char_result['errors']
            totals['reference_chars'] += len(' '.join(ref))
            totals['elapsed_seconds'] += result['elapsed_seconds']
            totals['audio_seconds'] += clip['seconds']
            totals['peak_mlx_bytes'] = max(totals['peak_mlx_bytes'], result['peak_mlx_bytes'])
        rows.append({'model': name, **totals, 'wer': totals['errors'] / totals['reference_words'],
                     'cer': totals['char_errors'] / totals['reference_chars'], 'clips': details})
    save(root / 'benchmark.json', {'source': manifest['source'], 'selection': manifest['note'],
        'normalization': 'NFC lowercase, ё=е, punctuation removed; CER includes spaces; numbers unchanged',
        'limitations': 'Read speech; possible training contamination; not domain accuracy or full test split.',
        'results': rows})
    for row in rows:
        print(json.dumps({k: v for k, v in row.items() if k != 'clips'}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['prepare', 'report'])
    parser.add_argument('--root', type=Path, required=True)
    args = parser.parse_args()
    (prepare if args.command == 'prepare' else report)(args.root)
