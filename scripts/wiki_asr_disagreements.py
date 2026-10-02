"""Report pairwise differences without calling a model's output ground truth."""
import argparse
import itertools
import json
from pathlib import Path

from wiki_asr_pilot import save
from wiki_asr_score import errors, words


def build(root):
    clips = json.loads((root / 'manifest.json').read_text())['clips']
    names = ['large', 'turbo', 'parakeet', 'qwen']
    pairs = {pair: {'distance': 0, 'denominator': 0} for pair in itertools.combinations(names, 2)}
    rows = []
    for clip in clips:
        results = {name: json.loads((root / name / (clip['id'] + '.json')).read_text()) for name in names}
        if any(r['audio_sha256'] != clip['sha256'] for r in results.values()):
            raise ValueError('Mismatched audio')
        row = {'id': clip['id'], 'audio_path': clip['path'],
               'texts': {name: r['text'] for name, r in results.items()}, 'differences': []}
        if clip['id'] != 'control-silence':
            for pair, counts in pairs.items():
                a, b = (words(results[name]['text']) for name in pair)
                distance = errors(a, b)['errors']
                denominator = max(len(a), len(b))
                counts['distance'] += distance
                counts['denominator'] += denominator
                row['differences'].append({'pair': list(pair), 'distance': distance,
                    'normalized_distance': distance / denominator if denominator else 0})
        rows.append(row)
    payload = {'scope': 'Model disagreement, NOT accuracy or WER against truth. Whisper variants are related.',
               'pairs': [{'models': list(pair), **counts,
                          'normalized_distance': counts['distance'] / counts['denominator'] if counts['denominator'] else 0}
                         for pair, counts in pairs.items()], 'clips': rows}
    save(root / 'disagreements.json', payload)
    lines = ['# Расхождения моделей — не оценка истинной точности', '', payload['scope'], '']
    for row in rows:
        lines += [f'## {row["id"]}', '', f'[Аудио]({row["audio_path"]})', '']
        for name, text in row['texts'].items():
            lines += [f'**{name}**', '', text, '']
    (root / 'disagreements.md').write_text('\n'.join(lines) + '\n')
    print(json.dumps(payload['pairs'], indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, required=True)
    build(parser.parse_args().root)
