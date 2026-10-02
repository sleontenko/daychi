"""Export local ASR with original-video timestamps and immutable source provenance."""
import argparse
import hashlib
import json
from pathlib import Path

from scripts.wiki_asr_gate import reasons
from practice_api.wiki_content import youtube_id


def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def export(root, output, index):
    manifest=json.loads((root/'manifest.json').read_text())
    labels=json.loads((root/'catalog-labels.json').read_text())
    catalog=json.loads(index.read_text())
    output.mkdir(parents=True,exist_ok=True)
    sources=[]
    def stamp(seconds):
        ms=round(seconds*1000)
        return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
    for source in manifest['sources']:
        label=labels[source['id']][0];resource=label['resource_id']
        matches=[r for r in catalog if resource in {youtube_id(l['url']) for l in r['links']}]
        if len(matches)!=1 or matches[0]['id']!=label['catalog_id'] or matches[0]['title']!=label['title']:
            raise ValueError('Catalog source mismatch')
        if sha(source['path'])!=source['sha256']:raise ValueError('Source audio changed')
        segments=[];raw=[]
        for clip in [c for c in manifest['clips'] if c['recording_id']==source['id']]:
            if sha(clip['path'])!=clip['sha256']:raise ValueError('Clip audio changed')
            responses={}
            for model in ['turbo','parakeet']:
                p=root/model/(clip['id']+'.json');result=json.loads(p.read_text())
                if result['audio_sha256']!=clip['sha256'] or result['clip_id']!=clip['id']:
                    raise ValueError('ASR/audio mismatch')
                responses[model]={'path':str(p.resolve()),'sha256':sha(p),'flags':reasons(result)}
            d=json.loads(Path(responses['turbo']['path']).read_text())
            raw.append({'clip_id':clip['id'],'audio_sha256':clip['sha256'],'responses':responses})
            for n,s in enumerate(d['segments']):
                segments.append({'clip_id':clip['id'],'segment_index':n,'text':s['text'].strip(),
                    'start_seconds':s['source_start'],'end_seconds':s['source_end'],
                    'turbo_flags':responses['turbo']['flags'],'parakeet_flags':responses['parakeet']['flags']})
        txt='\n'.join(f"[{stamp(s['start_seconds'])}] {s['text']}" for s in segments)+'\n'
        valid=[s for s in segments if s['text'] and 0<=s['start_seconds']<s['end_seconds']<=source['seconds']]
        srt='\n\n'.join(f"{n}\n{stamp(s['start_seconds'])} --> {stamp(s['end_seconds'])}\n{s['text']}" for n,s in enumerate(valid,1))+'\n'
        for suffix,text in [('txt',txt),('srt',srt)]:
            p=output/(resource+'.'+suffix)
            if p.exists() and p.read_text()!=text:raise ValueError('Export exists with different content')
            p.write_text(text);p.chmod(0o600)
        record={'resource_id':resource,'title':label['title'],'catalog_id':label['catalog_id'],
            'source_audio_path':source['path'],'source_audio_sha256':source['sha256'],
            'source_seconds':source['seconds'],'excluded_intervals':source['excluded_intervals'],
            'txt_path':str((output/(resource+'.txt')).resolve()),'txt_sha256':sha(output/(resource+'.txt')),
            'srt_path':str((output/(resource+'.srt')).resolve()),'srt_sha256':sha(output/(resource+'.srt')),
            'srt_omitted_segments':len(segments)-len(valid),'raw_results':raw,'segments':segments,
            'status':'machine_unverified','verified_by_listener':False,'content_approved':False}
        sources.append(record)
    value={'manifest_sha256':sha(root/'manifest.json'),'sources':sources}
    p=output/'provenance.json';text=json.dumps(value,ensure_ascii=False,indent=2)+'\n'
    if p.exists() and p.read_text()!=text:raise ValueError('Provenance exists with different content')
    p.write_text(text);p.chmod(0o600)
    return value


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--root',type=Path,required=True);p.add_argument('--output',type=Path,required=True)
    p.add_argument('--index',type=Path,required=True);a=p.parse_args()
    result=export(a.root,a.output,a.index)
    print('exported',len(result['sources']),'machine transcripts; no approvals')
