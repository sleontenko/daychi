import json
import pytest
from scripts.wiki_asr_export import export, sha


def test_export_preserves_source_time_hashes_and_draft_status(tmp_path):
    root=tmp_path/'asr';root.mkdir();audio=tmp_path/'abcdefghijk.wav';audio.write_bytes(b'audio')
    source={'id':'recording-01','path':str(audio),'sha256':sha(audio),'seconds':60,'excluded_intervals':[]}
    clip={'id':'part','recording_id':source['id'],'path':str(audio),'sha256':sha(audio)}
    def save(p,d):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(d))
    save(root/'manifest.json',{'sources':[source],'clips':[clip]})
    save(root/'catalog-labels.json',{'recording-01':[{'resource_id':'abcdefghijk','catalog_id':'stable','title':'Урок'}]})
    index=tmp_path/'index.json';save(index,[{'id':'stable','title':'Урок','links':[{'url':'https://youtu.be/abcdefghijk'}]}])
    for model in ['turbo','parakeet']:
        save(root/model/'part.json',{'clip_id':'part','audio_sha256':sha(audio),'seconds':10,
            'text':'Движение через расслабление.',
            'segments':[{'text':'Движение через расслабление.','source_start':35,'source_end':39}]})
    output=tmp_path/'export';result=export(root,output,index)
    source=result['sources'][0]
    assert '00:00:35,000 --> 00:00:39,000' in (output/'abcdefghijk.srt').read_text()
    assert source['txt_sha256']==sha(source['txt_path'])
    assert source['srt_omitted_segments']==0 and source['verified_by_listener'] is False
    assert export(root,output,index)==result
    audio.write_bytes(b'changed')
    with pytest.raises(ValueError,match='Source audio changed'):export(root,output,index)
