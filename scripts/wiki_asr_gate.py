"""Quarantine visibly defective ASR responses; passing is not content approval."""
import argparse
import hashlib
import json
import re
from pathlib import Path

GATE_VERSION = 3


def reasons(result):
    text = result.get('text', '')
    tokens = re.findall(r'\w+', text.lower())
    flags = []
    if not tokens:
        flags.append('empty_response')
    if '<unk>' in text.lower():
        flags.append('unknown_token')
    if re.search(r'([^\W\d_])\1{19,}', text.lower()):
        flags.append('character_run')
    if re.search(r'продолжение\s+следует', text.lower()):
        flags.append('subtitle_boilerplate_candidate')
    limit = result.get('settings', {}).get('max_tokens')
    if result.get('possibly_truncated') or (limit and result.get('generation_tokens', 0) >= limit):
        flags.append('generation_limit')
    # Eight adjacent repetitions of any phrase of one to eight words.
    if any(all(tokens[i:i+n] == tokens[i+j*n:i+(j+1)*n] for j in range(1, 8))
           for n in range(1, 9) for i in range(len(tokens)-8*n+1)):
        flags.append('repetition_loop')
    if result.get('seconds', 0) > 0 and len(tokens) / result['seconds'] > 5:
        flags.append('high_word_rate')
    for segment in result.get('segments', []):
        if segment.get('avg_logprob', 0) < -1 or segment.get('compression_ratio', 0) > 2.4:
            flags.append('low_confidence_or_compression')
        if 'start' in segment and 'end' in segment and result.get('seconds') is not None:
            if not 0 <= float(segment['start']) <= float(segment['end']) <= result['seconds'] + 1:
                flags.append('timestamp_out_of_bounds')
    return sorted(set(flags))


def write_sidecar(result_path, output):
    """Bind gate decisions to immutable raw responses without rewriting them."""
    result_path, output = Path(result_path), Path(output)
    raw = result_path.read_bytes()
    data = json.loads(raw)
    flags = reasons(data)
    value = {'gate_version': GATE_VERSION, 'clip_id': data['clip_id'],
             'audio_sha256': data['audio_sha256'],
             'result_sha256': hashlib.sha256(raw).hexdigest(),
             'status': 'quarantined' if flags else 'no_mechanical_flags',
             'reasons': flags, 'content_approved': False}
    output.parent.mkdir(parents=True, exist_ok=True)
    temp = output.with_suffix('.json.tmp')
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n')
    temp.replace(output)
    return value


def audit(paths):
    items = []
    for path in paths:
        data = json.loads(path.read_text())
        if 'clip_id' not in data:
            continue
        flags = reasons(data)
        items.append({'path': str(path.resolve()), 'clip_id': data['clip_id'],
                      'status': 'quarantined' if flags else 'no_mechanical_flags',
                      'reasons': flags, 'content_approved': False})
    return {'scope': 'Mechanical checks only; no accuracy or publication approval.',
            'checked': len(items), 'quarantined': sum(bool(i['reasons']) for i in items),
            'items': items}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directories', nargs='+', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    result = audit(sorted(p for d in args.directories for p in d.glob('*.json')))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({k:v for k,v in result.items() if k != 'items'}))
