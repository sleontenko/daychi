import json
import sqlite3

import pytest
from fastapi.testclient import TestClient

from practice_api.admin import password_hash
from practice_api.daychee_app import create_daychee_app
from practice_api.invitations import Invitations
from practice_api.wiki_app import WikiSettings
from practice_api.wiki_content import Batch, ContentStore, youtube_id


def payload(resource='abcdefghijk', summary='Краткий конспект содержания записанного занятия.'):
    return {'resource_id':resource,'expected_title':'Урок','revision':1,'summary':summary,
            'points':[{'text':'Точная фраза из расшифровки','start_seconds':10,'end_seconds':15},
                      {'text':'Вторая фраза из расшифровки','start_seconds':20,'end_seconds':25}],
            'transcript_sha256':'a'*64,'subtitles_sha256':'b'*64}


def catalog(resource='abcdefghijk', identity='stable'):
    return [{'id':identity,'title':'Урок','links':[{'url':f'https://www.youtube.com/watch?v={resource}'}]}]


def test_source_bound_idempotent_import_revision_and_retained_versions(tmp_path):
    s=ContentStore(tmp_path/'content.sqlite3');b=Batch(batch_id='first',records=[payload()])
    assert s.import_batch(b,catalog())=={'count':1,'already_imported':False}
    assert s.import_batch(b,catalog())['already_imported']
    assert s.get('stable',catalog()[0]['links'])['status']=='source_checked_draft'
    assert s.get('stable',catalog('otherid1234')[0]['links']) is None
    changed=payload(summary='Изменённый конспект содержания записанного занятия.')
    with pytest.raises(ValueError):s.import_batch(Batch(batch_id='second',records=[changed]),catalog())
    assert s.summary()['materials']==1
    changed['revision']=2;s.import_batch(Batch(batch_id='second',records=[changed]),catalog())
    with sqlite3.connect(s.path) as c:assert c.execute('SELECT count(*) FROM versions').fetchone()[0]==2


def test_invalid_batch_is_atomic_and_ambiguous_sources_rejected(tmp_path):
    s=ContentStore(tmp_path/'content.sqlite3')
    with pytest.raises(ValueError):s.import_batch(Batch(batch_id='bad',records=[payload(),payload('unknown1234')]),catalog())
    assert s.summary()['materials']==0
    with pytest.raises(ValueError):s.import_batch(Batch(batch_id='bad',records=[payload()]),catalog()+catalog(identity='duplicate'))
    assert youtube_id('https://evil.test/watch?v=abcdefghijk') is None


def test_import_requires_owner_session_origin_csrf_and_keeps_participant_auth(tmp_path,monkeypatch):
    origin='https://daychee.test';password='test-owner-password'
    monkeypatch.setenv('DAYCHEE_PUBLIC_ORIGIN',origin)
    monkeypatch.setenv('DAYCHEE_ADMIN_PASSWORD_HASH',password_hash(password))
    row={'id':'nikita:base:1','title':'Урок','source_timestamp_ms':1,'source_date_label':'Дата',
         'category_id':'test','category_name':'Раздел','subtopic':'','subtopic_key':'',
         'source_text':'Исходное описание','links':[{'url':'https://www.youtube.com/watch?v=abcdefghijk','label':'Видео','type':'youtube'}]}
    p=tmp_path/'index.json';p.write_text(json.dumps([row]))
    cfg=WikiSettings(p,tmp_path/'wiki.sqlite3','','');store=Invitations(tmp_path/'access.sqlite3')
    client=TestClient(create_daychee_app(cfg,store,tmp_path/'zoom.json'),base_url=origin)
    batch=Batch(batch_id='first',records=[payload()]).model_dump()
    assert client.post('/api/admin/wiki/content',json=batch).status_code==401
    _,code=store.issue_code();token=store.redeem(code);h={'Authorization':'Bearer '+token}
    mid=client.get('/api/wiki/materials',headers=h).json()['items'][0]['id']
    original=client.get('/api/wiki/materials/'+mid,headers=h).json()
    assert client.post('/api/admin/wiki/content',json=batch,headers=h).status_code==401
    login=client.post('/api/admin/login',json={'password':password},headers={'Origin':origin})
    assert login.status_code==200
    assert client.post('/api/admin/wiki/content',json=batch,headers={'Origin':origin}).status_code==403
    headers={'Origin':origin,'X-CSRF-Token':login.json()['csrf']}
    assert client.post('/api/admin/wiki/content',json=batch,headers=headers).status_code==200
    detail=client.get('/api/wiki/materials/'+mid,headers=h).json()
    assert detail['annotation']['summary']==batch['records'][0]['summary']
    assert detail['description']==original['description'] and detail['id']==mid
    assert 'transcript_sha256' not in detail['annotation']
    assert client.get('/api/wiki/materials/'+mid).status_code==401
    changed=Batch(batch_id='first',records=[payload(summary='Другой текст того же конспекта записанного занятия.')]).model_dump()
    assert client.post('/api/admin/wiki/content',json=changed,headers=headers).status_code==409
