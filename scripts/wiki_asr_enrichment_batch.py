"""Bind edited ASR summaries to exact, unflagged source segments for private import."""
import argparse
import json
from pathlib import Path

from practice_api.wiki_content import Batch
from scripts.wiki_asr_export import sha


def build(provenance, editorial, review, batch_id):
    sources={s['resource_id']:s for s in json.loads(provenance.read_text())['sources']}
    blocked={i['clip_id'] for i in json.loads(review.read_text())['items']}
    records=[];audit=[]
    for edit in json.loads(editorial.read_text())['records']:
        source=sources[edit['resource_id']]
        for kind in ['txt','srt']:
            if sha(source[kind+'_path'])!=source[kind+'_sha256']:raise ValueError('Export changed')
        if sha(source['source_audio_path'])!=source['source_audio_sha256']:raise ValueError('Audio changed')
        segments={(s['clip_id'],s['segment_index']):s for s in source['segments']}
        raw={r['clip_id']:r for r in source['raw_results']}
        points=[];evidence=[]
        for selection in edit['evidence']:
            cid=selection['clip_id'];indexes=selection['segment_indexes']
            if cid in blocked:raise ValueError('Selected clip is in review queue')
            if not indexes or indexes!=list(range(indexes[0],indexes[-1]+1)):raise ValueError('Non-contiguous excerpt')
            selected=[segments[(cid,n)] for n in indexes]
            if any(s['turbo_flags'] or s['parakeet_flags'] for s in selected):raise ValueError('Flagged evidence')
            for model in ['turbo','parakeet']:
                response=raw[cid]['responses'][model]
                if sha(response['path'])!=response['sha256']:raise ValueError('Raw ASR changed')
            original=json.loads(Path(raw[cid]['responses']['turbo']['path']).read_text())
            for n,s in zip(indexes,selected):
                actual=original['segments'][n]
                if (s['text'],s['start_seconds'],s['end_seconds']) != (
                    actual['text'].strip(),actual['source_start'],actual['source_end']):
                    raise ValueError('Excerpt differs from raw ASR')
            point={'text':' '.join(s['text'] for s in selected),
                   'start_seconds':selected[0]['start_seconds'],'end_seconds':selected[-1]['end_seconds']}
            if not 0<=point['start_seconds']<point['end_seconds']<=source['source_seconds']:
                raise ValueError('Excerpt outside recording')
            points.append(point);evidence.append({**selection,'source':raw[cid],'point':point})
        points.sort(key=lambda p:p['start_seconds'])
        records.append({'resource_id':source['resource_id'],'expected_title':source['title'],
            'revision':1,'summary':edit['summary'],'points':points,'transcript_sha256':source['txt_sha256'],
            'subtitles_sha256':source['srt_sha256'],'status':'source_checked_draft'})
        audit.append({'resource_id':source['resource_id'],'evidence':evidence,
            'review_notes':edit['review_notes'],'verified_by_listener':False,'teacher_approved':False})
    if len({r['resource_id'] for r in records})!=len(records):raise ValueError('Duplicate resource')
    return Batch(batch_id=batch_id,records=records).model_dump(),audit


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for name in ['provenance','editorial','review','output']:p.add_argument('--'+name,type=Path,required=True)
    p.add_argument('--batch-id',required=True);a=p.parse_args()
    payload,audit=build(a.provenance,a.editorial,a.review,a.batch_id)
    a.output.parent.mkdir(parents=True,exist_ok=True)
    for path,value in [(a.output,payload),(a.output.with_name('evidence-audit.json'),audit)]:
        text=json.dumps(value,ensure_ascii=False,indent=2)+'\n'
        if path.exists() and path.read_text()!=text:raise ValueError('Existing batch changed; use another output')
        path.write_text(text);path.chmod(0o600)
    print('prepared',len(payload['records']),'drafts;',sum(len(r['points']) for r in payload['records']),'exact excerpts')
