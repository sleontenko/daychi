import copy
import json
import sqlite3

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from practice_api.admin import password_hash
from practice_api.daychee_app import create_daychee_app
from practice_api.invitations import Invitations
from practice_api.wiki_app import WikiSettings
from practice_api.wiki_content import Batch, ContentStore
from practice_api.wiki_semantics import SemanticBatch, SemanticStore
from tests.test_wiki_content import catalog, payload


def semantic_payload():
    source=payload()
    return {'batch_id':'semantic-fixture','review':{'editor':'editor','reviewer':'reviewer',
        'editorial_sha256':'c'*64,'review_sha256':'d'*64,'verdict':'pass','full_text_read':True},
        'pages':[{'concept_id':'fixture-topic','kind':'topic','title':'Тема для проверки','aliases':[],
            'revision':1,'claims':[{'text':'Это описание поддержано опубликованной цитатой из урока.', 'evidence_indexes':[0]}],
            'links':[{'resource_id':source['resource_id'],'expected_title':source['expected_title'],
                'source_revision':1,'transcript_sha256':source['transcript_sha256'],
                'subtitles_sha256':source['subtitles_sha256'],'relation':'explains',
                'rationale':'Урок объясняет эту тему в указанном проверенном фрагменте.', 'points':[source['points'][0]]}]}]}


def stores(tmp_path):
    content=ContentStore(tmp_path/'content.sqlite3')
    content.import_batch(Batch(batch_id='source',records=[payload()]),catalog())
    return content,SemanticStore(content)


def test_exact_evidence_import_replay_and_same_revision_preserve_times(tmp_path):
    content,store=stores(tmp_path);data=semantic_payload();batch=SemanticBatch(**data)
    assert store.import_batch(batch,catalog())=={'pages':1,'links':1,'already_imported':False}
    before=store.active_pages(catalog())
    assert store.import_batch(batch,catalog())['already_imported']
    assert store.active_pages(catalog())==before
    data['batch_id']='another-receipt'
    store.import_batch(SemanticBatch(**data),catalog())
    assert store.active_pages(catalog())==before
    graph=store.graph(catalog())
    assert graph['nodes'][0]['type']=='topic' and graph['edges'][0]['k']=='semantic'
    assert graph['nodes'][0]['updated_ts']==int(before[0]['updated_at']*1000)
    assert graph['edges'][0]['evidence_count']==1
    assert len(store.material_links('stable',catalog()))==1
    assert content.summary()['materials']==1
    for hidden in ['transcript_sha256','subtitles_sha256','reviewer','editorial_sha256']:
        assert hidden not in json.dumps(before)


def test_fabricated_quote_bad_hash_and_failed_multi_page_import_are_atomic(tmp_path):
    _,store=stores(tmp_path)
    data=semantic_payload();second=copy.deepcopy(data['pages'][0]);second['concept_id']='another-topic';second['title']='Другая тема'
    second['links'][0]['points'][0]['text']='Придуманная фраза, отсутствующая в опубликованной расшифровке.'
    data['pages'].append(second)
    with pytest.raises(ValueError,match='Цитата'):store.import_batch(SemanticBatch(**data),catalog())
    assert store.summary()['pages']==0 and store.summary()['batches']==[]
    data=semantic_payload();data['pages'][0]['links'][0]['transcript_sha256']='e'*64
    with pytest.raises(ValueError,match='хеш'):store.import_batch(SemanticBatch(**data),catalog())
    assert store.summary()['pages']==0


def test_changed_source_hides_page_and_all_edges_until_re_review(tmp_path):
    content,store=stores(tmp_path);batch=SemanticBatch(**semantic_payload())
    store.import_batch(batch,catalog())
    revised=payload();revised['revision']=2
    content.import_batch(Batch(batch_id='revised-source',records=[revised]),catalog())
    assert store.active_pages(catalog())==[]
    assert store.graph(catalog())=={'nodes':[],'edges':[]}
    assert store.material_links('stable',catalog())==[]
    assert store.import_batch(batch,catalog())['already_imported']  # archived receipt only
    assert store.active_pages(catalog())==[]
    with pytest.raises(ValueError):store.import_batch(batch.model_copy(update={'batch_id':'new'}),catalog())
    data=semantic_payload();data['batch_id']='re-review';data['pages'][0]['revision']=2
    data['pages'][0]['links'][0]['source_revision']=2
    store.import_batch(SemanticBatch(**data),catalog())
    assert len(store.active_pages(catalog()))==1
    with sqlite3.connect(content.path) as db:
        assert db.execute('SELECT count(*) FROM semantic_versions').fetchone()[0]==2


def test_active_pages_use_one_snapshot_during_concurrent_source_and_page_updates(tmp_path, monkeypatch):
    content, store = stores(tmp_path)
    rows = catalog() + catalog('otherid1234', identity='other')
    second = payload()
    second['resource_id'] = 'otherid1234'
    content.import_batch(Batch(batch_id='second-source', records=[second]), rows)
    store.import_batch(SemanticBatch(**semantic_payload()), rows)
    # WAL permits a committed writer between the reader's two SELECTs.
    with sqlite3.connect(content.path) as con:
        con.execute('PRAGMA journal_mode=WAL')
    original_db = store.db
    fired = False

    class InterleavedRead:
        def __init__(self):
            self.con = original_db()

        def execute(self, sql, *args):
            nonlocal fired
            if sql.startswith('SELECT payload,updated FROM semantic_pages') and not fired:
                fired = True
                revised = payload()
                revised['revision'] = 2
                content.import_batch(Batch(batch_id='source-update', records=[revised]), rows)
                data = semantic_payload()
                data['batch_id'] = 'new-page'
                data['pages'][0]['concept_id'] = 'second-topic'
                data['pages'][0]['title'] = 'Другая проверенная тема'
                data['pages'][0]['links'][0]['resource_id'] = 'otherid1234'
                SemanticStore(content).import_batch(SemanticBatch(**data), rows)
            return self.con.execute(sql, *args)

        def close(self):
            self.con.close()

    monkeypatch.setattr(store, 'db', InterleavedRead)
    # A result may precede the update, but cannot mix its two database versions.
    assert [p['id'] for p in store.active_pages(rows)] == ['fixture-topic']
    assert fired
    assert [p['id'] for p in SemanticStore(content).active_pages(rows)] == ['second-topic']


def test_changed_title_url_ambiguous_identity_and_unreviewed_content_fail_closed(tmp_path):
    _,store=stores(tmp_path);batch=SemanticBatch(**semantic_payload());store.import_batch(batch,catalog())
    changed=catalog();changed[0]['title']='Переименованный урок'
    for rows in [changed,catalog('otherid1234'),catalog()+catalog(identity='other')]:
        assert store.active_pages(rows)==[]
        with pytest.raises(ValueError):store.import_batch(batch.model_copy(update={'batch_id':'new'}),rows)
    unreviewed=SemanticStore(ContentStore(tmp_path/'empty.sqlite3'))
    with pytest.raises(ValueError):unreviewed.import_batch(batch,catalog())


def test_alias_conflicts_do_not_merge_distinct_concepts_and_revisions_are_required(tmp_path):
    _,store=stores(tmp_path);data=semantic_payload();data['pages'][0]['title']='Балансная точка покоя'
    store.import_batch(SemanticBatch(**data),catalog())
    other=semantic_payload();other['batch_id']='other';other['pages'][0]['concept_id']='contrast-rest'
    other['pages'][0]['title']='Контрастно-балансная точка покоя'
    store.import_batch(SemanticBatch(**other),catalog())
    conflict=copy.deepcopy(other);conflict['batch_id']='alias';conflict['pages'][0]['revision']=2
    conflict['pages'][0]['aliases']=[' балансная  точка ПОКОЯ ']
    with pytest.raises(ValueError,match='псевдоним'):store.import_batch(SemanticBatch(**conflict),catalog())
    changed=copy.deepcopy(data);changed['batch_id']='edit';changed['pages'][0]['claims'][0]['text']='Изменённое описание, которое требует новой редакции страницы.'
    with pytest.raises(ValueError,match='редакцию'):store.import_batch(SemanticBatch(**changed),catalog())
    assert store.summary()['pages']==2


@pytest.mark.parametrize('mutation', ['claim','unused','nan','reviewer','extra'])
def test_unsupported_or_unreviewed_payloads_rejected(mutation):
    data=semantic_payload();page=data['pages'][0]
    if mutation=='claim':page['claims'][0]['evidence_indexes']=[1]
    if mutation=='unused':page['links'].append({**page['links'][0],'resource_id':'otherid1234'})
    if mutation=='nan':page['links'][0]['points'][0]['end_seconds']=float('nan')
    if mutation=='reviewer':data['review']['reviewer']='EDITOR'
    if mutation=='extra':page['teacher_approved']=True
    with pytest.raises(ValidationError):SemanticBatch(**data)


def api_fixture(tmp_path,monkeypatch,*,enabled=True,public=True):
    origin='https://daychee.test';password='test-owner-password'
    monkeypatch.setenv('DAYCHEE_PUBLIC_ORIGIN',origin)
    monkeypatch.setenv('DAYCHEE_ADMIN_PASSWORD_HASH',password_hash(password))
    monkeypatch.setenv('DAYCHEE_WIKI_SEMANTICS_ENABLED','1' if enabled else '0')
    monkeypatch.setenv('DAYCHEE_PUBLIC_WIKI_ENABLED','1' if public else '0')
    row={'id':'fixture:source','title':'Урок','source_timestamp_ms':1,'source_date_label':'Дата',
        'category_id':'test','category_name':'Раздел','subtopic':'','subtopic_key':'','source_text':'Описание',
        'links':[{'url':'https://youtu.be/abcdefghijk','label':'Видео','type':'video'}]}
    index=tmp_path/'index.json';index.write_text(json.dumps([row]))
    access=Invitations(tmp_path/'access.sqlite3')
    app=create_daychee_app(WikiSettings(index,tmp_path/'wiki.sqlite3','',''),access,tmp_path/'zoom.json')
    app.state.wiki_content.import_batch(Batch(batch_id='source',records=[payload()]),app.state.wiki_catalog())
    return app,TestClient(app,base_url=origin),origin,password


def test_owner_origin_csrf_protection_public_allowlist_and_graph_navigation(tmp_path,monkeypatch):
    app,client,origin,password=api_fixture(tmp_path,monkeypatch)
    data=semantic_payload();endpoint='/api/admin/wiki/semantic-content'
    assert client.post(endpoint,json=data).status_code==401
    assert client.get(endpoint).status_code==401
    login=client.post('/api/admin/login',json={'password':password},headers={'Origin':origin})
    assert client.post(endpoint,json=data,headers={'Origin':origin}).status_code==403
    headers={'Origin':origin,'X-CSRF-Token':login.json()['csrf']}
    assert client.post(endpoint,json=data,headers=headers).status_code==200
    assert client.post(endpoint,json=data,headers=headers).json()['already_imported']
    assert client.get('/api/wiki/concepts').status_code==401
    graph=client.get('/api/public/wiki/graph').json()
    concept=next(n for n in graph['nodes'] if n['type']=='topic')
    page=client.get('/api/public/wiki/concepts/'+concept['concept_id'])
    assert page.status_code==200 and page.headers['cache-control']=='no-store'
    assert page.json()['links'][0]['material_id'] in {n['id'] for n in graph['nodes'] if n['type']=='material'}
    material=page.json()['links'][0]['material_id']
    assert client.get('/api/public/wiki/materials/'+material+'/concepts').json()['items'][0]['id']==concept['concept_id']
    assert client.get('/api/public/wiki/concepts?q=ТЕМА').json()['items'][0]['id']==concept['concept_id']
    assert client.get('/api/public/wiki/concepts?kind=term').json()['items']==[]
    for secret in ['transcript_sha256','subtitles_sha256','reviewer','expected_title']:
        assert secret not in page.text
    assert client.get('/api/public/wiki/concepts/missing').status_code==404


def test_new_layer_and_public_access_remain_off_without_explicit_flags(tmp_path,monkeypatch):
    app,client,_,_=api_fixture(tmp_path,monkeypatch,enabled=False)
    assert client.get('/api/public/wiki/concepts').status_code==404
    graph=client.get('/api/public/wiki/graph').json()
    assert 'semantic_enabled' not in graph and all(e['k']!='semantic' for e in graph['edges'])
    with pytest.raises(ValueError):app.state.wiki_semantics.import_batch(SemanticBatch(**semantic_payload()),app.state.wiki_catalog())
    monkeypatch.setenv('DAYCHEE_WIKI_SEMANTICS_ENABLED','1');monkeypatch.setenv('DAYCHEE_PUBLIC_WIKI_ENABLED','0')
    second=create_daychee_app(WikiSettings(tmp_path/'index.json',tmp_path/'other.sqlite3','',''),Invitations(tmp_path/'other-access.sqlite3'))
    hidden=TestClient(second)
    for path in ['concepts','concepts/fixture-topic','materials/anything/concepts']:
        assert hidden.get('/api/public/wiki/'+path).status_code==404
