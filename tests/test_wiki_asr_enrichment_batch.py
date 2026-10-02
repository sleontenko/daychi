import json
import pytest
from scripts.wiki_asr_enrichment_batch import build
from scripts.wiki_asr_export import sha


def test_enrichment_rejects_quarantine_and_forged_quotes(tmp_path):
    def save(name,value):
        p=tmp_path/name;p.write_text(json.dumps(value));return p
    audio=tmp_path/'audio.wav';audio.write_bytes(b'audio')
    txt=tmp_path/'transcript.txt';txt.write_text('Текст исходника')
    srt=tmp_path/'transcript.srt';srt.write_text('Таймкоды исходника')
    segs=[{'text':f'Точная фраза номер {n}.','source_start':10+n*10,'source_end':15+n*10} for n in range(2)]
    raw=save('raw.json',{'segments':segs})
    source={'resource_id':'abcdefghijk','title':'Урок','txt_path':str(txt),'txt_sha256':sha(txt),
        'srt_path':str(srt),'srt_sha256':sha(srt),'source_audio_path':str(audio),'source_audio_sha256':sha(audio),
        'source_seconds':60,'segments':[{'clip_id':'clip','segment_index':n,'text':s['text'],
            'start_seconds':s['source_start'],'end_seconds':s['source_end'],'turbo_flags':[],'parakeet_flags':[]} for n,s in enumerate(segs)],
        'raw_results':[{'clip_id':'clip','responses':{m:{'path':str(raw),'sha256':sha(raw)} for m in ['turbo','parakeet']}}]}
    prov=save('provenance.json',{'sources':[source]})
    edit=save('editorial.json',{'records':[{'resource_id':'abcdefghijk','summary':'Краткий конспект по исходному тексту занятия.',
        'evidence':[{'clip_id':'clip','segment_indexes':[n]} for n in range(2)],'review_notes':'Проверено по тексту, не прослушано.'}]})
    review=save('review.json',{'items':[]})
    payload,audit=build(prov,edit,review,'batch')
    assert payload['records'][0]['points'][0]['text']==segs[0]['text']
    assert audit[0]['teacher_approved'] is False
    source['segments'][0]['text']='Выдуманная цитата преподавателя.'
    save('provenance.json',{'sources':[source]})
    with pytest.raises(ValueError,match='differs from raw'):build(prov,edit,review,'batch')
    save('review.json',{'items':[{'clip_id':'clip'}]})
    with pytest.raises(ValueError,match='review queue'):build(prov,edit,review,'batch')
