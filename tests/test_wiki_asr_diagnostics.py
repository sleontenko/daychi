from scripts.wiki_asr_diagnostics import classify, machine_reference, prepare_context


def answer(text):
    return {'text':text, 'seconds':20}


def test_whisper_pair_counts_as_one_family():
    r=classify({'turbo':answer('Наблюдаем за дыханием'), 'large':answer('Наблюдаем за дыханием')})
    assert r['status']=='whisper_only_agreement'
    assert r['content_approved'] is False


def test_quarantined_vote_cannot_create_three_family_agreement():
    r=classify({'turbo':answer('Наблюдаем за дыханием'),
                'parakeet':answer('Наблюдаем за дыханием <unk>'),
                'qwen':answer('Наблюдаем за дыханием')})
    assert r['status']=='two_family_agreement'
    assert 'parakeet' not in r['valid_models']


def test_three_families_must_agree_mutually_not_by_transitive_chain():
    a='один два три четыре пять шесть семь восемь девять десять'
    b='ноль два три четыре пять шесть семь восемь девять десять'
    c='ноль два три четыре пять шесть семь восемь девять сто'
    assert classify({'turbo':answer(a),'parakeet':answer(b),'qwen':answer(c)})['status']=='two_family_agreement'
    assert classify({'turbo':answer(a),'parakeet':answer(a),'qwen':answer(a)})['status']=='three_family_agreement'


def test_machine_reference_is_partial_raw_and_never_marked_listened():
    raw={'turbo':answer('Наблюдаем за дыханием'), 'parakeet':answer('Наблюдаем за дыханием.'),
         'qwen':answer('Наблюдаем за дыханием')}
    item={'clip_id':'a', 'parent_clip_id':'parent', 'audio_sha256':'audio',
          'source_offset_seconds':10, 'seconds':20, **classify(raw),
          'responses':{m:{'text':r['text'], 'sha256':m+'-digest'} for m,r in raw.items()}}
    omitted={**item,'status':'two_family_agreement','clip_id':'b'}
    reference=machine_reference([item,omitted])
    assert reference['omitted_clips']==1
    assert reference['clips'][0]['text']==raw['parakeet']['text']
    assert reference['clips'][0]['verified_by_listener'] is False
    assert reference['clips'][0]['content_approved'] is False


def test_context_clips_to_recording_bounds_and_preserves_focal_interval(tmp_path):
    import json
    import wave
    from scripts.wiki_asr_pilot import save, sha256
    source=tmp_path/'original';source.mkdir()
    wav=source/'audio.wav';raw=b'\x01\x00'*400
    with wave.open(str(wav),'wb') as f:
        f.setnchannels(1);f.setsampwidth(2);f.setframerate(100);f.writeframes(raw)
    save(source/'manifest.json',{'clips':[{'id':'parent','source_path':str(wav),'source_sha256':sha256(wav)}]})
    prior=tmp_path/'prior';prior.mkdir()
    save(prior/'manifest.json',{'diagnostic_config':{'source_root':str(source)},'clips':[
        {'id':'part','parent_clip_id':'parent','source_offset_seconds':.5,'seconds':1}]})
    save(prior/'report.json',{'items':[{'clip_id':'part','status':'unresolved'}]})
    root=tmp_path/'context';root.mkdir()
    m=prepare_context(root,prior)
    c=m['clips'][0]
    assert c['source_offset_seconds']==0 and c['seconds']==4
    assert c['focus_source_start']==.5 and c['focus_source_end']==1.5
    with wave.open(c['path']) as f:assert f.readframes(f.getnframes())==raw
    assert prepare_context(root,prior)==m


def test_three_engine_production_report_does_not_require_large(tmp_path):
    from scripts.wiki_asr_diagnostics import report
    from scripts.wiki_asr_pilot import save, sha256
    audio=tmp_path/'part.wav';audio.write_bytes(b'audio fixture')
    clip={'id':'part','parent_clip_id':'parent','path':str(audio),'sha256':sha256(audio),
          'source_offset_seconds':40,'seconds':20}
    save(tmp_path/'manifest.json',{'clips':[clip],'grouping':{'max_seconds':20}})
    save(tmp_path/'state.json',{'config':{'models':['turbo','parakeet','qwen']}})
    for model in ['turbo','parakeet','qwen']:
        save(tmp_path/model/'part.json',{'clip_id':'part','audio_sha256':clip['sha256'],
            'text':'Наблюдаем за расслаблением тела','seconds':20})
    result=report(tmp_path)
    assert result['counts']=={'three_family_agreement':1}
    assert result['approved']==0 and 'large' not in result['models']
    (tmp_path/'qwen'/'part.json').unlink()
    assert report(tmp_path)['counts']=={'incomplete':1}
