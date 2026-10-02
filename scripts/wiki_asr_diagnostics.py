"""Compare four local engines on identical bounded audio partitions; no gold labels."""
import argparse
import fcntl
import itertools
import json
import os
from pathlib import Path
import time
import wave

try:
    from .wiki_asr_pilot import save, sha256
    from .wiki_asr_gate import reasons, write_sidecar
    from .wiki_asr_queue import split_audio, bounded_process, distance
except ImportError:
    from wiki_asr_pilot import save, sha256
    from wiki_asr_gate import reasons, write_sidecar
    from wiki_asr_queue import split_audio, bounded_process, distance

MODELS = ['turbo', 'large', 'parakeet', 'qwen']
FAMILIES = {'turbo': 'whisper', 'large': 'whisper', 'parakeet': 'parakeet', 'qwen': 'qwen'}


def read(p):
    return json.loads(Path(p).read_text())


def prepare(root, source, review, max_seconds=20):
    source, review = source.resolve(), review.resolve()
    config = {'source_root': str(source), 'source_manifest_sha256': sha256(source/'manifest.json'),
              'review_path': str(review), 'review_sha256': sha256(review), 'max_seconds': max_seconds}
    if (root/'manifest.json').exists():
        manifest = read(root/'manifest.json')
        if manifest['diagnostic_config'] != config:
            raise ValueError('Diagnostic inputs changed; choose a new root')
        verify_audio(manifest)
        return manifest
    original = read(source/'manifest.json')
    by_id = {c['id']: c for c in original['clips']}
    clips, seen = [], set()
    for item in read(review)['items']:
        cid = item['clip_id']
        if cid in seen:
            raise ValueError('Duplicate review input')
        seen.add(cid)
        clips.extend(split_audio(by_id[cid], root/'audio', max_seconds))
    manifest = {'schema': 1, 'clips': clips, 'diagnostic_config': config,
                'vad': original.get('vad'),
                'grouping': {'max_seconds': max_seconds, 'method': 'exact_frame_partition'},
                'note': 'All four engines receive identical audio. Shared Whisper ancestry is not independent evidence.'}
    save(root/'manifest.json', manifest)
    print('prepared', len(seen), 'parents', len(clips), 'parts', flush=True)
    return manifest


def verify_audio(manifest):
    for clip in manifest['clips']:
        if sha256(clip['path']) != clip['sha256']:
            raise ValueError('Diagnostic audio changed')


def prepare_context(root, diagnostic_root, padding=3):
    """Add real source context around weak partitions, preserving focal bounds."""
    diagnostic_root = diagnostic_root.resolve()
    prior = read(diagnostic_root/'manifest.json')
    source = Path(prior['diagnostic_config']['source_root'])
    config = {'source_root':str(source), 'previous_manifest_sha256':sha256(diagnostic_root/'manifest.json'),
              'previous_report_sha256':sha256(diagnostic_root/'report.json'), 'padding_seconds':padding}
    if (root/'manifest.json').exists():
        m = read(root/'manifest.json')
        if m['diagnostic_config'] != config:
            raise ValueError('Context inputs changed')
        verify_audio(m)
        return m
    original = read(source/'manifest.json')
    originals = {c['id']:c for c in original['clips']}
    prior_clips = {c['id']:c for c in prior['clips']}
    weak = [i for i in read(diagnostic_root/'report.json')['items']
            if i['status'] not in ['three_family_agreement','two_family_agreement']]
    clips, verified_sources = [], set()
    for item in weak:
        focus = prior_clips[item['clip_id']]
        origin = originals[focus['parent_clip_id']]
        path = Path(origin['source_path'])
        if path not in verified_sources:
            if sha256(path) != origin['source_sha256']:
                raise ValueError('Original recording changed')
            verified_sources.add(path)
        with wave.open(str(path)) as src:
            params = src.getparams()
            first = max(0, round((focus['source_offset_seconds']-padding)*params.framerate))
            last = min(params.nframes, round((focus['source_offset_seconds']+focus['seconds']+padding)*params.framerate))
            src.setpos(first)
            target = root/'audio'/(focus['id']+'-context.wav')
            target.parent.mkdir(parents=True,exist_ok=True)
            with wave.open(str(target),'wb') as dst:
                dst.setparams(params)
                dst.writeframes(src.readframes(last-first))
        clips.append({**focus, 'id':target.stem, 'path':str(target.resolve()), 'sha256':sha256(target),
                      'source_offset_seconds':first/params.framerate, 'seconds':(last-first)/params.framerate,
                      'focus_clip_id':focus['id'], 'focus_source_start':focus['source_offset_seconds'],
                      'focus_source_end':focus['source_offset_seconds']+focus['seconds'],
                      'parent_start_frame':first, 'frame_count':last-first})
    m = {'schema':1, 'clips':clips, 'diagnostic_config':config,
         'grouping':{'max_seconds':26,'method':'focal_audio_with_context'},
         'note':'Agreement on context does not validate every word in the focal phrase; no VAD claim for context.'}
    save(root/'manifest.json',m)
    print('context prepared',len(clips),'parts',flush=True)
    return m


def outputs(root, model, clips):
    results = {}
    for clip in clips:
        p = root/model/(clip['id']+'.json')
        if not p.exists():
            continue
        d = read(p)
        if d['clip_id'] != clip['id'] or d['audio_sha256'] != clip['sha256']:
            raise ValueError('Diagnostic response/input mismatch')
        gate = write_sidecar(p, root/'quality'/model/p.name)
        results[clip['id']] = {'data': d, 'gate': gate, 'path': str(p.resolve())}
    return results


def run(root, python, qwen_python, timeout=180, max_tokens=512, models=None, hf_cache=None):
    selected = list(MODELS if models is None else models)
    if not selected or len(set(selected)) != len(selected) or any(m not in MODELS for m in selected):
        raise ValueError('Invalid engine selection')
    manifest = read(root/'manifest.json')
    verify_audio(manifest)
    source = Path(manifest['diagnostic_config']['source_root'])
    env = {**os.environ, 'HF_HOME': str(hf_cache or source.parent/'hf-cache'), 'HF_HUB_OFFLINE': '1',
           'HF_HUB_DISABLE_PROGRESS_BARS': '1'}
    config = {'timeout_seconds': timeout, 'qwen_max_tokens': max_tokens,
              'manifest_sha256': sha256(root/'manifest.json')}
    if models is not None:
        config['models'] = selected
    if hf_cache is not None:
        config['hf_cache'] = str(hf_cache.absolute())
    state_path = root/'state.json'
    state = read(state_path) if state_path.exists() else {'config': config, 'models': {}}
    if state['config'] != config:
        raise ValueError('Run configuration changed')
    for model in selected:
        previous = state['models'].get(model, {})
        before = outputs(root, model, manifest['clips'])
        for cid, digest in previous.get('response_sha256', {}).items():
            if cid not in before or before[cid]['gate']['result_sha256'] != digest:
                raise ValueError('Saved diagnostic response changed')
        if len(before) == len(manifest['clips']):
            continue
        attempts = previous.get('attempts', 0)
        if attempts >= 2:
            continue
        runner = Path(__file__).with_name('wiki_qwen_asr.py' if model == 'qwen' else 'wiki_asr_pilot.py')
        command = [str(qwen_python if model == 'qwen' else python), str(runner)]
        command += ['--root', str(root), '--max-tokens', str(max_tokens)] if model == 'qwen' else [
            'run', '--output', str(root), '--model', model]
        state['models'][model] = {**previous, 'status': 'running', 'attempts': attempts+1}
        save(state_path, state)
        start = time.monotonic()
        print('start', model, 'missing', len(manifest['clips'])-len(before), flush=True)
        result = bounded_process(command, root/(model+'-worker.log'), timeout, env)
        after = outputs(root, model, manifest['clips'])
        state['models'][model].update({**result, 'elapsed_seconds': time.monotonic()-start,
            'completed_parts': len(after), 'response_sha256': {k:r['gate']['result_sha256'] for k,r in after.items()}})
        save(state_path, state)
        print(model, result['status'], len(after), 'parts', round(time.monotonic()-start, 2), flush=True)


def classify(results, threshold=.15):
    """Require a mutually close clique, and count Whisper as one family."""
    valid = {m:r for m,r in results.items() if not reasons(r)}
    pairs = {f'{a}/{b}': distance(valid[a]['text'], valid[b]['text'])
             for a,b in itertools.combinations(sorted(valid), 2)}
    cliques = []
    for size in range(2, len(valid)+1):
        for group in itertools.combinations(sorted(valid), size):
            if all(pairs[f'{a}/{b}'] <= threshold for a,b in itertools.combinations(group,2)):
                cliques.append({'models': list(group), 'families': sorted({FAMILIES[m] for m in group})})
    families = max((len(c['families']) for c in cliques), default=0)
    status = ('three_family_agreement' if families == 3 else
              'two_family_agreement' if families == 2 else
              'whisper_only_agreement' if cliques else 'unresolved')
    return {'status': status, 'valid_models': sorted(valid), 'pairwise_distance': pairs,
            'agreement_cliques': cliques, 'content_approved': False}


def machine_reference(items):
    """Partial machine reference, deliberately incompatible with listened gold labels."""
    clips = []
    for item in items:
        if item['status'] != 'three_family_agreement':
            continue
        clique = next(c for c in item['agreement_cliques'] if len(c['families']) == 3)
        # Preserve a raw variant instead of blending words or inventing corrections.
        selected = 'parakeet'
        response = item['responses'][selected]
        clips.append({'id':item['clip_id'], 'parent_clip_id':item['parent_clip_id'],
                      'audio_sha256':item['audio_sha256'], 'source_offset_seconds':item['source_offset_seconds'],
                      'seconds':item['seconds'], 'text':response['text'], 'selected_engine':selected,
                      'supporting_models':clique['models'], 'supporting_families':clique['families'],
                      'response_sha256':{m:item['responses'][m]['sha256'] for m in clique['models']},
                      'status':'machine_unverified', 'verified_by_listener':False,
                      'content_approved':False,
                      'focus_source_start':item.get('focus_source_start'),
                      'focus_source_end':item.get('focus_source_end'),
                      'context_does_not_validate_each_focal_word':bool(item.get('focus_clip_id'))})
    return {'clips':clips, 'purpose':'Partial automatic comparison reference; not ground truth or measured accuracy.',
            'omitted_clips':len(items)-len(clips), 'approved':0}


def report(root):
    manifest = read(root/'manifest.json')
    verify_audio(manifest)
    state = read(root/'state.json') if (root/'state.json').exists() else {}
    selected = state.get('config', {}).get('models', MODELS)
    engines = {m: outputs(root,m,manifest['clips']) for m in selected}
    items = []
    for clip in manifest['clips']:
        raw = {m:rs[clip['id']]['data'] for m,rs in engines.items() if clip['id'] in rs}
        classification = classify(raw)
        if len(raw) != len(selected):
            classification['status'] = 'incomplete'
        items.append({'clip_id': clip['id'], 'parent_clip_id': clip['parent_clip_id'],
                      'source_offset_seconds': clip['source_offset_seconds'], 'seconds': clip['seconds'],
                      'audio_path': clip['path'], 'audio_sha256': clip['sha256'], **classification,
                      'focus_clip_id':clip.get('focus_clip_id'),
                      'focus_source_start':clip.get('focus_source_start'),
                      'focus_source_end':clip.get('focus_source_end'),
                      'responses': {m:{'text':r['text'], 'reasons':reasons(r),
                                      'path':engines[m][clip['id']]['path'],
                                      'sha256':engines[m][clip['id']]['gate']['result_sha256']} for m,r in raw.items()}})
    parents = []
    for cid in sorted({i['parent_clip_id'] for i in items}):
        group = [i for i in items if i['parent_clip_id'] == cid]
        counts = {s:sum(i['status']==s for i in group) for s in sorted({i['status'] for i in group})}
        parents.append({'clip_id':cid, 'parts':len(group), 'counts':counts,
                        'all_parts_three_families':all(i['status']=='three_family_agreement' for i in group),
                        'all_parts_cross_family':all(i['status'] in ['three_family_agreement','two_family_agreement'] for i in group),
                        'content_approved':False})
    counts = {s:sum(i['status']==s for i in items) for s in sorted({i['status'] for i in items})}
    value = {'counts':counts, 'parents':parents, 'items':items, 'models':selected, 'approved':0,
             'limitations':'Cross-family agreement is automatic triage, not a verified reference. Repeated exercises can trip heuristic gates.'}
    save(root/'report.json', value)
    save(root/'machine-reference.json', machine_reference(items))
    save(root/'remaining.json', {'items':[p for p in parents if not p['all_parts_three_families']], 'approved':0})
    limit = manifest['grouping']['max_seconds']
    lines = ['# Проверка спорных фрагментов ASR', '', 'Модели: '+', '.join(selected), '',
        f'Одинаковые части аудио ≤{limit} с. Qwen: максимум 512 токенов. Согласие — сигнал для черновика; одобрений 0.', '',
        'Turbo и large считаются одним семейством. Сравнение учитывает только ответы без механических флагов. Порог 15% — эвристика; ошибку по эталону здесь не измеряем.', '',
        'При добавлении контекста совпадение всего ответа не подтверждает каждое слово исходной спорной фразы.', '',
        json.dumps(counts, ensure_ascii=False), '', '## Охват исходных фрагментов', '']
    for p in parents:
        lines += [f"- {p['clip_id']}: {json.dumps(p['counts'])}; все части, 3 семейства: {p['all_parts_three_families']}"]
    for i in items:
        lines += ['',f"## {i['clip_id']} · {i['source_offset_seconds']:.2f} с · {i['status']}",'',f"[Аудио]({i['audio_path']})",'']
        for m,r in i['responses'].items():
            lines += [f'**{m}** · '+(', '.join(r['reasons']) or 'без флагов'),'',r['text'],'']
    (root/'README.md').write_text('\n'.join(lines)+'\n')
    print(json.dumps(counts), 'parents fully 3 families:',sum(p['all_parts_three_families'] for p in parents), flush=True)
    return value


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command',choices=['prepare','context','run','report'])
    parser.add_argument('--root',type=Path,required=True)
    parser.add_argument('--source',type=Path)
    parser.add_argument('--review',type=Path)
    parser.add_argument('--python',type=Path)
    parser.add_argument('--qwen-python',type=Path)
    parser.add_argument('--timeout-seconds',type=float,default=180)
    parser.add_argument('--models',nargs='+',choices=MODELS)
    parser.add_argument('--hf-cache',type=Path)
    args = parser.parse_args()
    if args.command == 'prepare' and (args.source is None or args.review is None):
        parser.error('--source and --review required')
    if args.command == 'context' and args.source is None:
        parser.error('--source diagnostic root required')
    if args.command == 'run' and (args.python is None or args.qwen_python is None):
        parser.error('Both interpreters required')
    if args.timeout_seconds <= 0:
        parser.error('Positive timeout required')
    args.root.mkdir(parents=True,exist_ok=True)
    with (args.root/'.diagnostics.lock').open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX | fcntl.LOCK_NB)
        if args.command == 'prepare':prepare(args.root,args.source,args.review)
        elif args.command == 'context':prepare_context(args.root,args.source)
        elif args.command == 'run':run(args.root,args.python.absolute(),args.qwen_python.absolute(),args.timeout_seconds,
                                       models=args.models,hf_cache=args.hf_cache)
        else:report(args.root)
