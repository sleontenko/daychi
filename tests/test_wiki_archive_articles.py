"""Synthetic archive contracts; no private corpus or live credentials."""
import copy
import json
import sqlite3

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from practice_api.admin import password_hash
from practice_api.daychee_app import create_daychee_app
from practice_api.invitations import Invitations
from practice_api.public_wiki import public_article, public_material
from practice_api.wiki_app import WikiSettings
from practice_api.wiki_archive_models import ArchiveBatch
from practice_api.wiki_archive_sources import catalog_rows, source_url
from practice_api.wiki_articles import ArticleStore
from practice_api.wiki_article_models import ArticleBatch
from practice_api.wiki_content import ContentStore
from tests.test_wiki_articles import article_payload, stores


def archive_payload():
    data = article_payload(('1' * 32, '2' * 32))
    data['format'] = 'daychi-wiki-archive-articles/1'
    data['batch_id'] = 'archive-fixture'
    ids = ('drive:fixtureRecording01', 'drive:fixtureRecording02')
    for i, source in enumerate(data['sources']):
        source['resource_id'] = ids[i]
        aliases = [dict(resource_id=ids[i], title='Файл архива', original_sha256='0'*64, original_bytes=123)]
        if i == 0:
            aliases.append(dict(aliases[0], resource_id='drive:fixtureRecording03'))
        source['archive'] = dict(collection_id='archive-neidan', cohort='retreat2017', aliases=aliases,
            pcm_sha256='1'*64, pcm_seconds=120.0, paired_asr_sha256={'turbo':'2'*64,'parakeet':'3'*64},
            provenance_sha256='4'*64, quarantine_sha256='5'*64, source_warnings=['decoder_warning'])
        article = data['articles'][i]
        article.update(resource_id=ids[i], status='text_reviewed_asr_draft',
            coverage_note='Изложены поддержанные двумя машинными текстами фрагменты; аудио не прослушано.')
        data['links'][i]['resource_id'] = ids[i]
        data['evidence'][i].update(resource_id=ids[i], admission=dict(basis='paired_asr_text_supported',
            reason='Обе машинные версии поддерживают смысл этого конкретного фрагмента.',
            clip_ids=[f'fixture-{i:04d}'], source_warning_codes=['decoder_warning'],
            clip_warning_codes=['model_disagreement'], unresolved_issue_codes=[], audio_verified=False))
    data['concepts'][0]['status'] = 'text_reviewed_asr_draft'
    return data


@pytest.mark.parametrize('change', [
    lambda d: d['sources'][0].update(resource_id='drive:not-valid!'),
    lambda d: d['sources'][0].update(material_id='legacy-material'),
    lambda d: d['sources'][0]['archive']['aliases'][1].update(original_sha256='9'*64),
    lambda d: d['sources'][0]['archive'].update(pcm_seconds=float('nan')),
    lambda d: d['articles'][0].update(status='source_checked_draft'),
    lambda d: d['articles'][0].update(coverage_note=''),
    lambda d: d['evidence'][0].update(admission=None),
    lambda d: d['evidence'][0]['admission'].update(unresolved_issue_codes=['negation_inversion']),
    lambda d: d['evidence'][0]['admission'].update(audio_verified=True),
    lambda d: d['evidence'][0]['admission'].update(source_warning_codes=[]),
    lambda d: d['evidence'][0]['admission'].update(source_basis='corrected_pair'),
    lambda d: d['evidence'][0].update(end_seconds=121),
    lambda d: d['concepts'][0].update(status='source_checked_draft'),
    lambda d: d['articles'][0]['claims'][0].update(text='Источник fixtureRecording03 раскрывает тему.'),
])
def test_archive_claims_fail_closed(change):
    data = archive_payload(); change(data)
    with pytest.raises(ValidationError):
        ArchiveBatch(**data)


def corrected(data):
    data['sources'][0]['archive']['corrected_asr'] = dict(
        full_text_sha256={'turbo_auto':'6'*64,'large_v3_auto':'7'*64},
        model_ids={'turbo_auto':'whisper-large-v3-turbo','large_v3_auto':'whisper-large-v3'},
        provenance_sha256='8'*64, quarantine_sha256='9'*64)
    data['evidence'][0]['admission']['source_basis'] = 'corrected_pair'
    return data


def test_truthful_corrected_models_keep_original_pins():
    data = corrected(archive_payload())
    model = ArchiveBatch(**data)
    assert model.sources[0].archive.paired_asr_sha256.parakeet == '3'*64
    assert model.sources[0].archive.corrected_asr.model_ids['large_v3_auto'] == 'whisper-large-v3'
    data['sources'][0]['archive']['corrected_asr']['model_ids']['parakeet'] = 'wrong'
    with pytest.raises(ValidationError): ArchiveBatch(**data)


def test_atomic_overlay_replay_private_provenance_and_no_legacy_mutation(tmp_path):
    content, store, rows = stores(tmp_path)
    for row in rows:
        row.update(date='Дата',timestamp=1,category='test',category_name='Раздел',
                   subtopic='',subtopic_key='',description='Описание')
    before = [content.get(r['id'], r['links']) for r in rows]
    base = copy.deepcopy(rows)
    batch = ArchiveBatch(**archive_payload())
    assert store.import_archive_batch(batch, rows) == dict(articles=2,concepts=1,links=2,already_imported=False)
    overlay = store.archive_catalog(rows)
    assert rows == base and overlay[:2] == rows and len(overlay) == 4
    inventory = store.source_inventory(overlay)['materials']
    assert inventory[-2]['archive_source'] == batch.sources[0].model_dump()
    assert inventory[-2]['archive_article'] == dict(format=batch.format, revision=1, status='text_reviewed_asr_draft')
    assert 'archive_article' not in inventory[0]
    assert len(inventory[-2]['links']) == 2 and 'annotation' not in inventory[-2]
    body = store.article('1'*32, rows)
    assert body['status'] == 'text_reviewed_asr_draft' and body['coverage_note']
    assert body['evidence'][0]['source_url'] == source_url(batch.sources[0].resource_id)
    assert body['evidence'][0]['time_basis'] == 'pcm_clip'
    assert all(secret not in json.dumps(body) for secret in ('sha256','admission','audio_verified','reviewer'))
    assert store.concept('fixture-topic', rows)['status'] == 'text_reviewed_asr_draft'
    assert store.import_archive_batch(batch, rows)['already_imported']
    assert store.article('1'*32, rows) == body
    assert [content.get(r['id'], r['links']) for r in rows] == before
    with pytest.raises(ValueError, match='endpoint'): store.import_batch(batch, rows)
    with sqlite3.connect(content.path) as con:
        assert con.execute('SELECT count(*) FROM archive_source_versions').fetchone()[0] == 2


def test_registration_rolls_back_with_article_conflict(tmp_path):
    store = ArticleStore(ContentStore(tmp_path/'content.sqlite3'), enabled=True)
    data = archive_payload()
    store.import_archive_batch(ArchiveBatch(**data), [])
    bad = copy.deepcopy(data); bad['batch_id']='rollback'
    bad['sources'][0]['content_revision']=2; bad['sources'][0]['transcript_sha256']='f'*64
    bad['articles'][0]['claims'][0]['text']='Изменённый текст без новой редакции.'
    with pytest.raises(ValueError): store.import_archive_batch(ArchiveBatch(**bad), [])
    assert store.article('1'*32, []) is not None
    with sqlite3.connect(store.content.path) as con:
        assert con.execute('SELECT max(revision) FROM archive_source_versions').fetchone()[0] == 1


def test_source_change_invalidates_all_projections_and_replay_cannot_reactivate(tmp_path):
    store = ArticleStore(ContentStore(tmp_path/'content.sqlite3'), enabled=True)
    batch = ArchiveBatch(**archive_payload()); store.import_archive_batch(batch, [])
    # An independently revised source cannot silently authorize the old bundle.
    with sqlite3.connect(store.content.path) as con:
        source = batch.sources[0].model_dump(); source['content_revision']=2
        source['transcript_sha256']='e'*64
        con.execute('UPDATE archive_sources SET payload=? WHERE resource_id=?',
                    (json.dumps(source), source['resource_id']))
    assert store.article('1'*32, []) is None and store.article('2'*32, []) is None
    assert store.concept('fixture-topic', []) is None
    assert store.projection([]) == {'nodes':[], 'edges':[], 'updates':{}}
    assert store.import_archive_batch(batch, [])['already_imported']
    assert store.active_bundles([]) == []
    inventory = store.source_inventory(store.archive_catalog([]))['materials']
    assert all('archive_source' in row and 'archive_article' not in row for row in inventory)


def test_corrected_revision_preserves_original_and_does_not_replay_old_source(tmp_path):
    store=ArticleStore(ContentStore(tmp_path/'content.sqlite3'),enabled=True)
    old=ArchiveBatch(**archive_payload()); store.import_archive_batch(old,[])
    data=corrected(archive_payload()); data['batch_id']='corrected-pair'
    data['sources'][0].update(content_revision=2,transcript_sha256='6'*64,subtitles_sha256='a'*64)
    for article in data['articles']: article['revision']=2
    data['concepts'][0]['revision']=2
    store.import_archive_batch(ArchiveBatch(**data),[])
    body=store.article('1'*32,[])
    assert body['revision']==2
    assert store.import_archive_batch(old,[])['already_imported']
    assert store.article('1'*32,[])==body
    with sqlite3.connect(store.content.path) as con:
        assert con.execute('SELECT count(*) FROM archive_source_versions').fetchone()[0]==3
        pin=json.loads(con.execute('SELECT payload FROM archive_sources WHERE material_id=?',('1'*32,)).fetchone()[0])
    assert pin['archive']['paired_asr_sha256']==old.sources[0].archive.paired_asr_sha256.model_dump()


def test_mixed_whole_page_supplement_retains_legacy_sources_and_claims(tmp_path):
    content,store,rows=stores(tmp_path)
    legacy=ArticleBatch(**article_payload()); store.import_batch(legacy,rows)
    before=[content.get(r['id'],r['links']) for r in rows]
    new=archive_payload()
    # Editorial IDs are namespaced; source and object identities retain authority.
    new=json.loads(json.dumps(new).replace('"e0"','"archive:e0"').replace('"e1"','"archive:e1"')
                   .replace('"l0"','"archive:l0"').replace('"l1"','"archive:l1"')
                   .replace('"definition"','"archive:definition"'))
    old=legacy.model_dump()
    for article in old['articles']: article['revision']=2
    new['sources']+=old['sources']; new['articles']+=old['articles']
    new['links']+=old['links']; new['evidence']+=old['evidence']
    new['concepts'][0]['claims']+=old['concepts'][0]['claims']; new['concepts'][0]['revision']=2
    store.import_archive_batch(ArchiveBatch(**new),rows)
    assert store.article('stable',rows)['status']=='source_checked_draft'
    assert len(store.concept('fixture-topic',rows)['claims'])==2
    assert len(store.concept('fixture-topic',rows)['links'])==4
    assert [content.get(r['id'],r['links']) for r in rows]==before
    bad=copy.deepcopy(new); bad['batch_id']='destructive'; bad['concepts'][0]['revision']=3
    bad['concepts'][0]['claims'][1]['text']='Удалён прежний смысл с сохранёнными ссылками.'
    with pytest.raises(ValueError,match='сохранять'): store.import_archive_batch(ArchiveBatch(**bad),rows)


@pytest.mark.parametrize('kind', ['alias','material','warning','original','pair','pcm','duration','collection','cohort'])
def test_sources_cannot_take_existing_bindings_or_erase_provenance(tmp_path, kind):
    store = ArticleStore(ContentStore(tmp_path/'content.sqlite3'), enabled=True)
    data = archive_payload(); batch=ArchiveBatch(**data)
    store.import_archive_batch(batch, [])
    bad=copy.deepcopy(data); bad['batch_id']='conflict'
    for source in bad['sources']: source['content_revision']=2
    for article in bad['articles']: article['revision']=2
    bad['concepts'][0]['revision']=2
    rows=[]
    if kind=='alias':
        rows=[dict(id='base',links=[{'url':source_url(batch.sources[0].resource_id)}])]
    elif kind=='material': rows=[dict(id='1'*32,links=[])]
    elif kind=='warning':
        bad['sources'][0]['archive']['source_warnings']=[]
        bad['evidence'][0]['admission']['source_warning_codes']=[]
    elif kind=='original':
        for a in bad['sources'][0]['archive']['aliases']: a['original_sha256']='f'*64
    elif kind=='pair': bad['sources'][0]['archive']['paired_asr_sha256']['turbo']='f'*64
    elif kind=='pcm': bad['sources'][0]['archive']['pcm_sha256']='f'*64
    elif kind=='duration': bad['sources'][0]['archive']['pcm_seconds']=121.0
    elif kind=='collection': bad['sources'][0]['archive']['collection_id']='different-archive'
    else: bad['sources'][0]['archive']['cohort']='neidan'
    with pytest.raises(ValueError): store.import_archive_batch(ArchiveBatch(**bad), rows)


def test_public_drive_docs_stay_available_but_archive_recordings_never_do():
    batch = ArchiveBatch(**archive_payload())
    row=catalog_rows({batch.sources[0].resource_id:batch.sources[0].model_dump()})[0]
    row['links'][0]['type']='doc'  # A bad label cannot weaken recording protection.
    assert public_material(row)['links'] == []
    normal=dict(row); normal.pop('_archive_recording'); normal['links']=row['links'][:1]
    assert len(public_material(normal)['links']) == 1
    safe=public_article({'evidence':[dict(id='fixtureRecording01:e', resource_id=batch.sources[0].resource_id,
        source_url=source_url(batch.sources[0].resource_id), text='Фраза', start_seconds=10)]})
    assert all(secret not in json.dumps(safe) for secret in ('fixtureRecording01','resource_id','source_url','drive.google'))


def test_owner_import_auth_csrf_cached_catalog_and_public_projection(tmp_path, monkeypatch):
    origin='https://daychee.test'; password='synthetic-owner-password'
    monkeypatch.setenv('DAYCHEE_PUBLIC_ORIGIN',origin)
    monkeypatch.setenv('DAYCHEE_ADMIN_PASSWORD_HASH',password_hash(password))
    monkeypatch.setenv('DAYCHEE_PUBLIC_WIKI_ENABLED','1')
    monkeypatch.setenv('DAYCHEE_WIKI_ARTICLES_ENABLED','1')
    index=tmp_path/'index.json'
    index.write_text(json.dumps([dict(id='legacy',title='Урок',source_timestamp_ms=1,source_date_label='Дата',
        category_id='test',category_name='Раздел',subtopic='',subtopic_key='',source_text='Описание',links=[])]))
    invitations=Invitations(tmp_path/'access.sqlite3')
    app=create_daychee_app(WikiSettings(index,tmp_path/'wiki.sqlite3','',''),invitations,tmp_path/'zoom.json')
    client=TestClient(app,base_url=origin); baseline=app.state.wiki_catalog()
    body=ArchiveBatch(**archive_payload()).model_dump()
    assert client.post('/api/admin/wiki/archive-articles',json=body).status_code==401
    login=client.post('/api/admin/login',json={'password':password},headers={'Origin':origin})
    assert client.post('/api/admin/wiki/archive-articles',json=body,headers={'Origin':origin}).status_code==403
    headers={'Origin':origin,'X-CSRF-Token':login.json()['csrf']}
    assert client.post('/api/admin/wiki/archive-articles',json=body,headers=headers).status_code==200
    assert app.state.wiki_catalog()[:1]==baseline and len(app.state.wiki_catalog())==3
    inventory=client.get('/api/admin/wiki/articles/sources').json()['materials']
    assert len(inventory)==3 and inventory[1]['archive_source']['resource_id'].startswith('drive:')
    assert client.get('/api/wiki/articles/materials/'+'1'*32).status_code==401
    public=client.get('/api/public/wiki/articles/materials/'+'1'*32)
    assert public.status_code==200 and public.json()['status']=='text_reviewed_asr_draft'
    for url in ('/api/public/wiki/materials/'+'1'*32, '/api/public/wiki/graph?articles=1',
                '/api/public/wiki/articles/concepts/fixture-topic'):
        result=client.get(url); assert result.status_code==200
        assert all(secret not in result.text for secret in ('fixtureRecording','drive.google','resource_id','sha256'))
    assert len(client.get('/api/public/wiki/recent?articles=1').json()['items'])==3
    _,code=invitations.issue_code(); token=invitations.redeem(code)
    private=client.get('/api/wiki/articles/materials/'+'1'*32,headers={'Authorization':'Bearer '+token})
    assert private.status_code==200 and 'https://drive.google.com/' in private.text


@pytest.mark.parametrize('archive_concept_support', [False, True])
def test_coherent_replacement_keeps_legacy_article_reader_format(tmp_path, archive_concept_support):
    content, store, rows = stores(tmp_path)
    for row in rows:
        row.update(date='Дата', timestamp=1, category='test', category_name='Раздел',
                   subtopic='', subtopic_key='', description='Описание')
    old = ArticleBatch(**article_payload()).model_dump()
    store.import_batch(ArticleBatch(**old), rows)
    before = {identity: store.article(identity, rows) for identity in ('stable', 'other')}
    value = copy.deepcopy(old)
    value.update(format='daychi-wiki-archive-articles/1', batch_id='coherent-archive-replacement')
    value['sources'].append(copy.deepcopy(archive_payload()['sources'][0]))
    for article in value['articles']:
        article['revision'] += 1
    value['concepts'][0]['revision'] += 1
    if archive_concept_support:
        quote = copy.deepcopy(archive_payload()['evidence'][0]); quote['id'] = 'archive-quote'
        value['evidence'].append(quote)
        value['concepts'][0]['status'] = 'text_reviewed_asr_draft'
        value['concepts'][0]['claims'].append(dict(id='archive-example', text='Архивный пример в общей теме.', evidence_ids=['archive-quote']))
        value['links'].append(dict(id='archive-link', resource_id=quote['resource_id'], concept_id='fixture-topic',
            relation='explains', rationale='Архивный пример поясняет эту тему.', evidence_ids=['archive-quote']))
    store.import_archive_batch(ArchiveBatch(**value), rows)
    assert store.summary()['articles'] == 2
    assert store.summary()['concepts'] == 1
    inventory = store.source_inventory(store.archive_catalog(rows))['materials']
    registered = next(row for row in inventory if row['id'] == '1'*32)
    assert 'archive_source' in registered and 'archive_article' not in registered
    assert all('archive_article' not in row for row in inventory)
    for identity, prior in before.items():
        current = store.article(identity, rows)
        assert current['format'] == 'daychi-wiki-articles/1'
        assert current['revision'] == 2
        for field in ('resource_id', 'status', 'introduction', 'sections', 'related', 'links'):
            assert current[field] == prior[field]
    expected = 'daychi-wiki-archive-articles/1' if archive_concept_support else 'daychi-wiki-articles/1'
    assert store.concept('fixture-topic', rows)['format'] == expected
    assert store.import_archive_batch(ArchiveBatch(**value), rows)['already_imported'] is True


def test_owner_inventory_never_pairs_old_source_with_new_active_article(tmp_path, monkeypatch):
    store = ArticleStore(ContentStore(tmp_path/'content.sqlite3'), enabled=True)
    old = ArchiveBatch(**archive_payload())
    store.import_archive_batch(old, [])
    catalog = store.archive_catalog([])
    value = corrected(archive_payload()); value['batch_id'] = 'interleaved-corrected-source'
    value['sources'][0].update(content_revision=2, transcript_sha256='6'*64, subtitles_sha256='a'*64)
    for article in value['articles']: article['revision'] = 2
    value['concepts'][0]['revision'] = 2
    original_active = store.active_bundles
    def change_between_snapshots(rows):
        store.import_archive_batch(ArchiveBatch(**value), [])
        return original_active(rows)
    monkeypatch.setattr(store, 'active_bundles', change_between_snapshots)
    inventory = store.source_inventory(catalog)['materials']
    assert inventory[0]['archive_source'] == old.sources[0].model_dump()
    assert 'archive_article' not in inventory[0]
    assert inventory[1]['archive_article']['revision'] == 2
    monkeypatch.setattr(store, 'active_bundles', original_active)
    refreshed = store.source_inventory(store.archive_catalog([]))['materials']
    current = next(row for row in refreshed if row['id'] == old.sources[0].material_id)
    assert current['archive_source']['content_revision'] == 2
    assert current['archive_article']['revision'] == 2
