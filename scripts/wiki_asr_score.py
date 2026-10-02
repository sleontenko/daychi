"""Score identical clips against a separately listened, hash-bound reference."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import unicodedata


def words(text):
    # Preserve lexical errors, repetitions and numbers; ignore case/punctuation/ё.
    return re.findall(r"[^\W_]+", unicodedata.normalize('NFC', text).lower().replace('ё', 'е'))


def errors(reference, hypothesis):
    """Levenshtein counts; ties prefer substitution, then deletion, then insertion."""
    previous = [(j, 0, 0, j) for j in range(len(hypothesis) + 1)]
    for i, ref in enumerate(reference, 1):
        current = [(i, 0, i, 0)]
        for j, hyp in enumerate(hypothesis, 1):
            if ref == hyp:
                current.append(previous[j - 1])
                continue
            cost, sub, delete, insert = previous[j - 1]
            substitution = (cost + 1, sub + 1, delete, insert)
            cost, sub, delete, insert = previous[j]
            deletion = (cost + 1, sub, delete + 1, insert)
            cost, sub, delete, insert = current[j - 1]
            insertion = (cost + 1, sub, delete, insert + 1)
            current.append(min([substitution, deletion, insertion], key=lambda item: item[0]))
        previous = current
    cost, sub, delete, insert = previous[-1]
    return {'errors': cost, 'substitutions': sub, 'deletions': delete,
            'insertions': insert, 'reference_words': len(reference),
            'wer': cost / len(reference) if reference else None}


def score(root, reference_path):
    manifest = json.loads((root / 'manifest.json').read_text())
    clips = {c['id']: c for c in manifest['clips'] if c['id'] != 'control-silence'}
    references = json.loads(reference_path.read_text())['clips']
    seen = set()
    accepted = []
    for ref in references:
        key = ref['id']
        if key in seen:
            raise ValueError(f'Duplicate reference: {key}')
        seen.add(key)
        if ref.get('verified_by_listener') is not True:
            continue
        if key not in clips or not isinstance(ref.get('text'), str) or not ref.get('reviewer'):
            raise ValueError(f'Incomplete listened reference: {key}')
        clip = clips[key]
        digest = hashlib.sha256(Path(clip['path']).read_bytes()).hexdigest()
        if digest != clip['sha256'] or digest != ref['audio_sha256']:
            raise ValueError(f'Reference/audio hash mismatch: {key}')
        accepted.append(ref)
    models = ['large', 'turbo', 'parakeet']
    rows = []
    for name in models:
        totals = dict.fromkeys(['errors', 'substitutions', 'deletions', 'insertions', 'reference_words'], 0)
        details = []
        for ref in accepted:
            # Fail if a model lacks a clip: never compare different subsets silently.
            record = json.loads((root / name / (ref['id'] + '.json')).read_text())
            if record['audio_sha256'] != ref['audio_sha256'] or record['clip_id'] != ref['id']:
                raise ValueError(f'Model/audio mismatch: {name}/{ref["id"]}')
            result = errors(words(ref['text']), words(record['text']))
            details.append({'id': ref['id'], **result})
            for key in totals:
                totals[key] += result[key]
        rows.append({'model': name, **totals,
                     'wer': totals['errors'] / totals['reference_words'] if totals['reference_words'] else None,
                     'clips': details})
    return {'status': 'scored_listened_subset' if accepted else 'awaiting_listened_reference',
            'verified_clips': len(accepted), 'available_clips': len(clips),
            'reference_sha256': hashlib.sha256(reference_path.read_bytes()).hexdigest(),
            'normalization': 'NFC, lowercase, ё→е, punctuation removed; no number/term corrections',
            'limitations': 'WER is word-weighted; terminology, meaning, timestamps and editing time require separate review.',
            'models': rows}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--reference', type=Path)
    args = parser.parse_args()
    result = score(args.root, args.reference or args.root / 'listening-reference.json')
    (args.root / 'quality.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(result, ensure_ascii=False, indent=2))
