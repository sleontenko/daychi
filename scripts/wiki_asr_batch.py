"""Bounded, resumable Turbo/Parakeet passes for a prepared private audio batch."""
import argparse
import fcntl
import json
import os
from pathlib import Path
import time

from scripts.wiki_asr_pilot import save, sha256
from scripts.wiki_asr_queue import bounded_process


def run(root, python, hf_cache, timeout=600):
    manifest=json.loads((root/'manifest.json').read_text())
    config={'manifest_sha256':sha256(root/'manifest.json'),'python':str(python.absolute()),
            'hf_cache':str(hf_cache.absolute()),'timeout_seconds':timeout,'models':['turbo','parakeet']}
    path=root/'worker-state.json'
    state=json.loads(path.read_text()) if path.exists() else {'config':config,'models':{}}
    if state['config']!=config:raise ValueError('Batch configuration changed')
    env={**os.environ,'HF_HOME':str(hf_cache.absolute()),'HF_HUB_OFFLINE':'1','HF_HUB_DISABLE_PROGRESS_BARS':'1'}
    for model in config['models']:
        for cid,digest in state['models'].get(model,{}).get('response_sha256',{}).items():
            if sha256(root/model/(cid+'.json'))!=digest:raise ValueError('Saved ASR response changed')
        for clip in manifest['clips']:
            if sha256(clip['path'])!=clip['sha256']:raise ValueError('Batch audio changed')
        command=[str(python.absolute()),str(Path(__file__).with_name('wiki_asr_pilot.py').absolute()),
                 'run','--output',str(root.absolute()),'--model',model]
        print('start',model,flush=True);start=time.monotonic()
        result=bounded_process(command,root/(model+'-worker.log'),timeout,env)
        files=[root/model/(c['id']+'.json') for c in manifest['clips']]
        completed=[p for p in files if p.exists()]
        state['models'][model]={**result,'wall_seconds':time.monotonic()-start,
            'completed_clips':len(completed),'response_sha256':{p.stem:sha256(p) for p in completed}}
        save(path,state)
        print(model,result['status'],len(completed),'clips',round(time.monotonic()-start,2),'s',flush=True)
        if result['returncode']!=0 or len(completed)!=len(files):raise RuntimeError('Incomplete model pass')
    return state


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for name in ['root','python','hf-cache']:p.add_argument('--'+name,type=Path,required=True)
    p.add_argument('--timeout-seconds',type=float,default=600);a=p.parse_args()
    if a.timeout_seconds<=0:p.error('Positive timeout required')
    with (a.root/'.batch.lock').open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        run(a.root,a.python,a.hf_cache,a.timeout_seconds)
