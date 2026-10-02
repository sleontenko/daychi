"""Bounded, resumable local retry queue for disputed ASR audio. No approval/export."""
import argparse
import fcntl
import json
import os
from pathlib import Path
import signal
import subprocess
import time
import wave

try:
    from .wiki_asr_pilot import save, sha256
    from .wiki_asr_gate import GATE_VERSION, reasons, write_sidecar
    from .wiki_asr_score import errors, words
except ImportError:
    from wiki_asr_pilot import save, sha256
    from wiki_asr_gate import GATE_VERSION, reasons, write_sidecar
    from wiki_asr_score import errors, words


def read(path):
    return json.loads(Path(path).read_text())


def split_audio(clip, directory, max_seconds):
    """Partition PCM frames exactly once; preserve absolute source timestamps."""
    if max_seconds <= 0:
        raise ValueError('Positive chunk limit required')
    if sha256(clip['path']) != clip['sha256']:
        raise ValueError('Source audio changed')
    directory.mkdir(parents=True, exist_ok=True)
    pieces = []
    with wave.open(clip['path']) as src:
        params = src.getparams()
        if params.comptype != 'NONE':
            raise ValueError('PCM audio required')
        limit = int(max_seconds * params.framerate)
        if limit < 1:
            raise ValueError('Chunk shorter than one frame')
        for index, start in enumerate(range(0, params.nframes, limit)):
            count = min(limit, params.nframes - start)
            path = directory / f"{clip['id']}-part-{index:03d}.wav"
            with wave.open(str(path), 'wb') as dst:
                dst.setparams(params)
                dst.writeframes(src.readframes(count))
            pieces.append({**clip, 'id': path.stem, 'parent_clip_id': clip['id'],
                           'path': str(path.resolve()), 'sha256': sha256(path),
                           'source_offset_seconds': clip['source_offset_seconds'] + start / params.framerate,
                           'seconds': count / params.framerate, 'parent_start_frame': start,
                           'frame_count': count})
    return pieces


def prepare(root, source, max_seconds=30, additional_mechanical_only=False):
    source = source.resolve()
    config = {'source_root': str(source), 'source_manifest_sha256': sha256(source/'manifest.json'),
              'review_queue_sha256': sha256(source/'review-queue.json'),
              'max_seconds': max_seconds, 'model': 'large'}
    if additional_mechanical_only:
        config['additional_mechanical_only'] = True
        config['gate_version'] = GATE_VERSION
    if (root/'queue.json').exists():
        prior = read(root/'queue.json')
        if prior['config'] != config:
            raise ValueError('Existing queue differs: choose another directory')
        for job in prior['jobs']:
            if sha256(job['manifest_path']) != job['manifest_sha256']:
                raise ValueError('Job manifest changed')
            for clip in read(job['manifest_path'])['clips']:
                if sha256(clip['path']) != clip['sha256']:
                    raise ValueError('Retry audio changed')
        print('validated existing queue', len(prior['jobs']), flush=True)
        return prior
    manifest = read(source/'manifest.json')
    clips = {c['id']: c for c in manifest['clips']}
    candidates = read(source/'review-queue.json')['items']
    if additional_mechanical_only:
        prior_ids = {i['clip_id'] for i in candidates}
        candidates = []
        for clip in manifest['clips']:
            if clip['id'] in prior_ids:
                continue
            flags = [name+'_'+flag for name in ['turbo','parakeet']
                     for flag in reasons(read(source/name/(clip['id']+'.json')))]
            if flags:
                candidates.append({'clip_id':clip['id'], 'reasons':flags})
    jobs = []
    seen = set()
    for item in candidates:
        cid = item['clip_id']
        if cid in seen:
            raise ValueError('Duplicate job')
        seen.add(cid)
        jobroot = root/'jobs'/cid
        pieces = split_audio(clips[cid], jobroot/'audio', max_seconds)
        path = jobroot/'manifest.json'
        save(path, {'schema': 1, 'clips': pieces, 'vad': manifest.get('vad'),
                    'grouping': {'max_seconds': max_seconds, 'method': 'exact_frame_partition'},
                    'parent_clip_id': cid, 'note': 'No transcript is a verified reference.'})
        jobs.append({'id': cid, 'manifest_path': str(path.resolve()),
                     'manifest_sha256': sha256(path), 'parts': len(pieces),
                     'original_reasons': item['reasons']})
    queue = {'schema': 1, 'config': config, 'jobs': jobs}
    save(root/'queue.json', queue)
    print('prepared', len(jobs), 'jobs', sum(j['parts'] for j in jobs), 'parts', flush=True)
    return queue


def bounded_process(command, log_path, timeout_seconds, env=None):
    """Own and terminate only this worker process group on timeout."""
    if timeout_seconds <= 0:
        raise ValueError('Positive timeout required')
    with Path(log_path).open('ab') as log:
        process = subprocess.Popen(command, stdout=log, stderr=subprocess.STDOUT,
                                   env=env, start_new_session=True)
        try:
            code = process.wait(timeout=timeout_seconds)
            return {'status': 'finished' if code == 0 else 'failed', 'returncode': code}
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGTERM)
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()
            return {'status': 'timeout', 'returncode': process.returncode}


def validate_job(job):
    path = Path(job['manifest_path'])
    if sha256(path) != job['manifest_sha256']:
        raise ValueError('Job manifest changed')
    gates = []
    for clip in read(path)['clips']:
        if sha256(clip['path']) != clip['sha256']:
            raise ValueError('Retry audio changed')
        response = path.parent/'large'/(clip['id']+'.json')
        if not response.exists():
            return None
        data = read(response)
        if data['clip_id'] != clip['id'] or data['audio_sha256'] != clip['sha256']:
            raise ValueError('Result/input mismatch')
        if data['settings']['model'] != 'mlx-community/whisper-large-v3-mlx':
            raise ValueError('Unexpected model')
        gates.append(write_sidecar(response, path.parent/'quality'/'large'/response.name))
    return gates


def run(root, python, timeout_seconds=90, max_attempts=2):
    queue = read(root/'queue.json')
    state_path = root/'state.json'
    state = read(state_path) if state_path.exists() else {'jobs': {}}
    env = {**os.environ, 'HF_HOME': str(Path(queue['config']['source_root']).parent/'hf-cache'),
           'HF_HUB_OFFLINE': '1', 'HF_HUB_DISABLE_PROGRESS_BARS': '1'}
    runner = Path(__file__).with_name('wiki_asr_pilot.py')
    subprocess.run([str(python), '-c', 'import mlx.core; import mlx_whisper'],
                   env=env, check=True, timeout=30, capture_output=True)
    started = time.monotonic()
    for index, job in enumerate(queue['jobs'], 1):
        prior = state['jobs'].get(job['id'], {})
        gates = validate_job(job)
        if gates is not None:
            if prior.get('result_sha256') and prior['result_sha256'] != [g['result_sha256'] for g in gates]:
                raise ValueError('Completed responses changed')
            state['jobs'][job['id']] = {**prior, 'status': 'processed',
                                      'result_sha256': [g['result_sha256'] for g in gates],
                                      'quarantined_parts': sum(bool(g['reasons']) for g in gates)}
            save(state_path, state)
            continue
        attempts = prior.get('attempts', 0)
        if attempts >= max_attempts:
            continue
        jobroot = Path(job['manifest_path']).parent
        print('start', index, '/', len(queue['jobs']), job['id'], flush=True)
        state['jobs'][job['id']] = {**prior, 'status': 'running', 'attempts': attempts+1,
                                   'timeout_seconds': timeout_seconds}
        save(state_path, state)
        t0 = time.monotonic()
        result = bounded_process([str(python), str(runner), 'run', '--output', str(jobroot),
                                  '--model', 'large'], jobroot/'worker.log', timeout_seconds, env)
        gates = validate_job(job) if result['status'] == 'finished' else None
        if result['status'] == 'finished' and gates is None:
            result['status'] = 'incomplete'
        state['jobs'][job['id']].update({**result, 'elapsed_seconds': time.monotonic()-t0})
        if gates is not None:
            state['jobs'][job['id']].update({'status': 'processed',
                'result_sha256': [g['result_sha256'] for g in gates],
                'quarantined_parts': sum(bool(g['reasons']) for g in gates)})
        save(state_path, state)
        print(job['id'], state['jobs'][job['id']]['status'], round(time.monotonic()-t0, 2), flush=True)
    state['last_run_seconds'] = time.monotonic()-started
    save(state_path, state)


def distance(a, b):
    aa, bb = words(a), words(b)
    return errors(aa, bb)['errors']/max(len(aa), len(bb)) if aa or bb else 0


def report(root):
    queue = read(root/'queue.json')
    source = Path(queue['config']['source_root'])
    if sha256(source/'manifest.json') != queue['config']['source_manifest_sha256']:
        raise ValueError('Original manifest changed')
    original = {c['id']: c for c in read(source/'manifest.json')['clips']}
    items = []
    for job in queue['jobs']:
        gates = validate_job(job)
        item = {'clip_id': job['id'], 'original_reasons': job['original_reasons'],
                'content_approved': False, 'source_offset_seconds': original[job['id']]['source_offset_seconds']}
        if gates is None:
            items.append({**item, 'status': 'retry_incomplete'})
            continue
        path = Path(job['manifest_path'])
        results = [read(path.parent/'large'/(c['id']+'.json')) for c in read(path)['clips']]
        retry = ' '.join(r['text'].strip() for r in results)
        originals = {name: read(source/name/(job['id']+'.json')) for name in ['turbo','parakeet']}
        for r in originals.values():
            if r['audio_sha256'] != original[job['id']]['sha256']:
                raise ValueError('Original result/audio mismatch')
        ratios = {name: distance(r['text'], retry) for name, r in originals.items()}
        # Corroboration is triage only. Shared Whisper ancestry is a known limitation.
        status = 'retry_quarantined' if any(g['reasons'] for g in gates) else (
            'turbo_corroborated_by_large' if ratios['turbo'] <= .15 else 'persistent_disagreement')
        items.append({**item, 'status': status, 'large_text': retry,
                      'turbo_text': originals['turbo']['text'], 'parakeet_text': originals['parakeet']['text'],
                      'normalized_distance_to_large': ratios,
                      'retry_gates': gates,
                      'retry_segments': [s for r in results for s in r['segments']]})
    counts = {status: sum(i['status'] == status for i in items) for status in sorted({i['status'] for i in items})}
    value = {'counts': counts, 'items': items, 'approved': 0,
             'limitations': 'Automatic triage, not ground truth. Turbo and large share model ancestry. Splitting changes context.'}
    save(root/'report.json', value)
    lines = ['# Повторный разбор спорных фрагментов', '',
             'Автоматическое сопоставление, точность не измерена. Одобрений: 0.', '',
             'Turbo и large принадлежат одному семейству; совпадение не даёт независимого эталона. Разбиение меняет контекст.', '',
             json.dumps(counts, ensure_ascii=False), '']
    for i in items:
        lines += [f"## {i['clip_id']} — {i['status']}", '',
                  f"[Исходный аудиофрагмент]({original[i['clip_id']]['path']})", '']
        if 'large_text' in i:
            lines += ['**Turbo**', '', i['turbo_text'], '', '**Large, части до 30 секунд**', '', i['large_text'], '',
                      '**Parakeet**', '', i['parakeet_text'], '',
                      'Расхождение с large: '+json.dumps(i['normalized_distance_to_large']), '']
    (root/'README.md').write_text('\n'.join(lines)+'\n')
    print(json.dumps(counts), flush=True)
    return value


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['prepare', 'run', 'report'])
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--source', type=Path)
    parser.add_argument('--python', type=Path)
    parser.add_argument('--max-seconds', type=float, default=30)
    parser.add_argument('--timeout-seconds', type=float, default=90)
    parser.add_argument('--max-attempts', type=int, default=2)
    parser.add_argument('--additional-mechanical-only', action='store_true')
    args = parser.parse_args()
    if args.command == 'prepare' and args.source is None:
        parser.error('--source required')
    if args.command == 'run' and args.python is None:
        parser.error('--python required')
    if args.max_attempts < 1 or args.timeout_seconds <= 0:
        parser.error('Positive bounds required')
    args.root.mkdir(parents=True, exist_ok=True)
    with (args.root/'.queue.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if args.command == 'prepare':
            prepare(args.root, args.source, args.max_seconds, args.additional_mechanical_only)
        elif args.command == 'run':
            # Resolving a venv interpreter symlink loses its environment packages.
            run(args.root, args.python.absolute(), args.timeout_seconds, args.max_attempts)
        else:
            report(args.root)
