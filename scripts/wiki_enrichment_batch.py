"""Build source-bound enrichment from private editorial records; no fabricated approval."""
import argparse
import hashlib
import json
import re
from pathlib import Path

from practice_api.wiki_content import Batch, youtube_id


def stems(text):
    stop={'котор','препо','занят','предл','своим','этого','через','часть','участ','практ','движе'}
    return {w[:5] for w in re.findall(r'[^\W_]+',text.lower()) if len(w)>4 and w[:5] not in stop}


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def source_sentences(path):
    """Remove rolling-caption overlap without rewriting the spoken words."""
    text=Path(path).read_text().replace('\r','')
    tokens=[]
    def seconds(value):
        h,m,s=value.replace(',','.').split(':')
        return int(h)*3600+int(m)*60+float(s)
    for match in re.finditer(r'^\d+\n([\d:,]+) --> ([\d:,]+)\n(.*?)(?=\n\d+\n\d{2}:|\Z)',text,re.M|re.S):
        start,end,body=match.groups(); words=body.split()
        overlap=0
        for size in range(min(len(tokens),len(words)),0,-1):
            if [t[0] for t in tokens[-size:]]==words[:size]:
                overlap=size;break
        tokens.extend((word,seconds(start),seconds(end)) for word in words[overlap:])
    result=[];pending=[]
    for token in tokens:
        pending.append(token)
        if re.search(r'[.!?][»\"]?$',token[0]) or len(pending)>=100:
            result.append({'text':' '.join(t[0] for t in pending),
                'start_seconds':pending[0][1],'end_seconds':pending[-1][2]})
            pending=[]
    if pending:
        result.append({'text':' '.join(t[0] for t in pending),
            'start_seconds':pending[0][1],'end_seconds':pending[-1][2]})
    return result


def build(paths, index, batch_id):
    catalog=json.loads(Path(index).read_text())
    records=[]
    for path in paths:
        data=json.loads(Path(path).read_text())
        for record in data['records']:
            source=record['source'];resource=source['resource_id']
            if digest(source['txt_path'])!=source['txt_sha256'] or digest(source['srt_path'])!=source['srt_sha256']:
                raise ValueError('Transcript changed')
            matches=[r for r in catalog if resource in {youtube_id(l['url']) for l in r['links']}]
            if len(matches)!=1 or matches[0]['title']!=record['title']:
                raise ValueError('Catalog/source mismatch')
            if record['annotation']!=' '.join(record['sentences']):
                raise ValueError('Annotation sentences changed')
            points=[];quotes=[]
            contexts=source_sentences(source['srt_path'])
            for group in record['evidence']:
                if group.get('matches'):
                    quotes.extend({'text':m['phrase'],'start_seconds':m['start_seconds'],'end_seconds':m['end_seconds']} for m in group['matches'])
                else:
                    quotes.extend({'text':c['text'].strip(),'start_seconds':c['start_seconds'],'end_seconds':c['end_seconds']} for c in group['cues'] if len(c['text'].strip())>20 and c['end_seconds']>c['start_seconds'])
            used=set()
            for n,sentence in enumerate(record['sentences'],1):
                groups=[e for e in record['evidence'] if e['sentence_index']==n]
                if not groups:raise ValueError('Missing source evidence')
                # Quotes are source excerpts, not alleged word-for-word evidence
                # for each rewritten sentence. Old editorial groups can be shifted.
                candidates=[q for q in quotes if (q['text'],q['start_seconds']) not in used]
                if not candidates:raise ValueError('Missing distinct source excerpts')
                q=max(candidates,key=lambda q:(len(stems(sentence)&stems(q['text'])), -len(q['text'])))
                used.add((q['text'],q['start_seconds']))
                nearby=[c for c in contexts if c['start_seconds']<=q['end_seconds'] and c['end_seconds']>=q['start_seconds'] and 30<=len(c['text'])<=1000]
                if nearby:
                    q=max(nearby,key=lambda c:len(stems(q['text'])&stems(c['text'])))
                if any(p['text']==q['text'] for p in points):
                    raise ValueError('Duplicate contextual excerpt')
                points.append(q)
            points.sort(key=lambda p:p['start_seconds'])
            records.append({'resource_id':resource,'expected_title':record['title'],
                'revision':1,'summary':record['annotation'],'points':points,
                'transcript_sha256':source['txt_sha256'],'subtitles_sha256':source['srt_sha256'],
                'status':'source_checked_draft'})
    if len({r['resource_id'] for r in records})!=len(records):raise ValueError('Duplicate material')
    return Batch(batch_id=batch_id,records=records).model_dump()


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--annotations',type=Path,nargs='+',required=True)
    parser.add_argument('--index',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--batch-id',required=True)
    args=parser.parse_args()
    result=build(args.annotations,args.index,args.batch_id)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    args.output.chmod(0o600)
    print('prepared',len(result['records']),'materials,',sum(len(r['points']) for r in result['records']),'source points; drafts')
