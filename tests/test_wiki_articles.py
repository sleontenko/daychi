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
from practice_api.wiki_article_models import ArticleBatch
from practice_api.wiki_articles import ArticleStore
from practice_api.wiki_content import Batch, ContentStore
from practice_api.wiki_graph import build_graph
from practice_api.wiki_semantics import SemanticBatch, SemanticStore
from tests.test_wiki_content import catalog, payload
from tests.test_wiki_semantics import semantic_payload


def article_payload(ids=('stable', 'other')):
    sources, articles, evidence, links = [], [], [], []
    for index, (resource, material) in enumerate(zip(('abcdefghijk', 'otherid1234'), ids)):
        sources.append({'resource_id': resource, 'material_id': material, 'expected_title': 'Урок',
                        'content_revision': 1, 'transcript_sha256': 'a' * 64, 'subtitles_sha256': 'b' * 64})
        evidence.append({'id': f'e{index}', 'resource_id': resource, 'text': 'Точная фраза из расшифровки',
                         'start_seconds': 10, 'end_seconds': 15})
        links.append({'id': f'l{index}', 'resource_id': resource, 'concept_id': 'fixture-topic',
                      'relation': 'explains', 'rationale': 'Источник объясняет тему.', 'evidence_ids': [f'e{index}']})
        articles.append({'material_id': material, 'resource_id': resource, 'revision': 1,
                         'introduction_claim_ids': ['intro'], 'sections': [{'id': 'first', 'heading': 'Смысл раздела', 'claim_ids': ['body']}],
                         'claims': [{'id': 'intro', 'text': 'Короткое введение.', 'evidence_ids': [f'e{index}']},
                                    {'id': 'body', 'text': '🪷 Это понятие в контексте урока.', 'evidence_ids': [f'e{index}'],
                                     'mentions': [{'start': 6, 'end': 13, 'link_id': f'l{index}'}]}],
                         'related': [{'material_id': ids[1-index], 'via_concept_id': 'fixture-topic',
                                      'supporting_link_ids': ['l0', 'l1'], 'reason': 'Оба занятия объясняют понятие.'}]})
    return {'format': 'daychi-wiki-articles/1', 'batch_id': 'article-fixture', 'sources': sources,
            'articles': articles, 'concepts': [{'id': 'fixture-topic', 'kind': 'topic', 'title': 'Понятие',
                'aliases': [], 'revision': 1, 'claims': [{'id': 'definition', 'text': 'Описание понятия по двум занятиям.',
                    'evidence_ids': ['e0', 'e1']}]}], 'links': links, 'evidence': evidence,
            'review': {'editor': 'editor', 'reviewer': 'reviewer', 'editorial_sha256': 'c' * 64,
                       'review_sha256': 'd' * 64, 'decision': 'pass', 'full_source_read': True}}


def stores(tmp_path):
    rows = catalog() + catalog('otherid1234', 'other')
    content = ContentStore(tmp_path / 'content.sqlite3')
    content.import_batch(Batch(batch_id='sources', records=[payload(), payload('otherid1234')]), rows)
    return content, ArticleStore(content, enabled=True), rows


def test_owner_inventory_keeps_source_pins_without_connection_credentials(tmp_path):
    _, store, rows = stores(tmp_path)
    row = rows[0]
    row.update(date='Дата', timestamp=1, category='test', category_name='Раздел',
               subtopic='', subtopic_key='', description='Описание',
               zoom_password='PRIVATE-ZOOM-PASSWORD', unknown_secret='PRIVATE-UNKNOWN')
    video = dict(row['links'][0], type='video', label='Запись', password='PRIVATE-LINK-FIELD')
    row['links'] = [video] + [
        {'url': url, 'type': 'video', 'label': 'PRIVATE-ZOOM-LINK'} for url in (
            'https://us02web.zoom.us/j/123?pwd=secret',
            'https://ZOOM.COM./j/123',
            'https://%7Aoom.us/j/123',
            'https://ｚｏｏｍ.us/j/123',
            'https://zoom.us\\@example.test/j/123',
            'https://example.test/video?%70assword=secret',
            'https://user:secret@example.test/video',
        )
    ] + [{'url': 'https://example.test/video', 'type': 'zoom', 'label': 'PRIVATE-ZOOM-LINK'}]
    inventory = store.source_inventory([row])['materials'][0]
    assert inventory['annotation']['resource_id'] == 'abcdefghijk'
    assert inventory['annotation']['transcript_sha256'] == 'a' * 64
    assert inventory['links'] == [{key: video[key] for key in ('url', 'type', 'label')}]
    assert 'PRIVATE-' not in json.dumps(inventory)
    assert set(inventory) == {'id', 'title', 'date', 'timestamp', 'category', 'category_name',
                              'subtopic', 'subtopic_key', 'description', 'links', 'annotation'}


def test_structure_destinations_replay_and_processing_noop(tmp_path):
    content, store, rows = stores(tmp_path)
    legacy = [content.get(r['id'], r['links']) for r in rows]
    data = article_payload()
    receipt = store.import_batch(ArticleBatch(**data), rows)
    assert receipt == {'articles': 2, 'concepts': 1, 'links': 2, 'already_imported': False}
    before = store.article('stable', rows)
    paragraph = before['sections'][0]['paragraphs'][0]
    mention = paragraph['mentions'][0]
    assert paragraph['text'][mention['start']:mention['end']] == 'понятие'
    assert before['introduction'][0]['text'] == 'Короткое введение.'
    assert before['related'][0]['material_id'] == 'other'
    assert store.concept('fixture-topic', rows)['links'][0]['id'] == mention['link_id']
    assert store.projection(rows)['edges'][0]['link_ids'] == [mention['link_id']]
    assert store.import_batch(ArticleBatch(**data), rows)['already_imported']
    data['batch_id'] = 'another-review'; data['review']['review_sha256'] = 'e' * 64
    store.import_batch(ArticleBatch(**data), rows)
    assert store.article('stable', rows) == before
    assert [content.get(r['id'], r['links']) for r in rows] == legacy
    with sqlite3.connect(content.path) as con:
        assert con.execute('SELECT count(*) FROM article_versions').fetchone()[0] == 3
    reader = json.dumps([before, store.concept('fixture-topic', rows)])
    assert all(secret not in reader for secret in ('sha256', 'reviewer', 'expected_title', 'content_revision'))


@pytest.mark.parametrize('change', [
    lambda d: d['articles'][0]['claims'][1]['mentions'][0].update(end=100),
    lambda d: d['articles'][0]['claims'][1]['mentions'].append({'start': 7, 'end': 10, 'link_id': 'l0'}),
    lambda d: d['articles'][0]['claims'][1]['mentions'][0].update(link_id='l1'),
    lambda d: d['articles'][0]['sections'][0].update(claim_ids=['intro', 'body']),
    lambda d: d['articles'][0]['related'][0].update(supporting_link_ids=['l0', 'l0']),
    lambda d: d['articles'][0]['claims'][0].update(evidence_ids=['e1']),
    lambda d: d['evidence'][0].update(end_seconds=10),
    lambda d: d['evidence'][0].update(start_seconds=float('nan')),
    lambda d: d['articles'][0]['claims'][0].update(text='пароль: секрет'),
    lambda d: d['sources'][0].update(expected_title='Урок https://private.test'),
    lambda d: d['articles'][0]['claims'][0].update(html='<b>unsupported</b>'),
    lambda d: d['review'].update(reviewer='EDITOR'),
    lambda d: d['articles'][0].update(revision=True),
])
def test_invalid_editorial_references_and_text_rejected(change):
    data = article_payload(); change(data)
    with pytest.raises(ValidationError):
        ArticleBatch(**data)


def test_atomic_conflict_revision_history_and_retained_whole_page(tmp_path):
    content, store, rows = stores(tmp_path)
    data = article_payload(); bad = copy.deepcopy(data); bad['sources'][1]['transcript_sha256'] = 'e' * 64
    with pytest.raises(ValueError): store.import_batch(ArticleBatch(**bad), rows)
    assert store.summary()['articles'] == 0
    store.import_batch(ArticleBatch(**data), rows)
    changed = copy.deepcopy(data); changed['articles'][0]['claims'][0]['text'] = 'Уточнённое введение.'
    with pytest.raises(ValueError): store.import_batch(ArticleBatch(**changed), rows)
    changed['batch_id'] = 'revision-two'
    with pytest.raises(ValueError): store.import_batch(ArticleBatch(**changed), rows)
    changed['articles'][0]['revision'] = 2
    store.import_batch(ArticleBatch(**changed), rows)
    assert store.article('stable', rows)['revision'] == 2
    assert store.article('other', rows)['revision'] == 1
    destructive = copy.deepcopy(changed); destructive['batch_id'] = 'lost-definition'
    destructive['concepts'][0]['revision'] = 2
    destructive['concepts'][0]['claims'][0]['text'] = 'Только новое определение.'
    with pytest.raises(ValueError, match='сохранять'): store.import_batch(ArticleBatch(**destructive), rows)
    assert store.concept('fixture-topic', rows)['revision'] == 1


def test_source_change_hides_every_projection_and_replay_does_not_reactivate(tmp_path):
    content, store, rows = stores(tmp_path); batch = ArticleBatch(**article_payload())
    store.import_batch(batch, rows)
    revised = payload(); revised['revision'] = 2
    content.import_batch(Batch(batch_id='revised-source', records=[revised]), rows)
    assert store.article('stable', rows) is None and store.article('other', rows) is None
    assert store.concept('fixture-topic', rows) is None
    assert store.projection(rows) == {'nodes': [], 'edges': [], 'updates': {}}
    assert store.import_batch(batch, rows)['already_imported']
    assert store.active_bundles(rows) == []
    with pytest.raises(ValueError): store.import_batch(batch.model_copy(update={'batch_id': 'new'}), rows)


@pytest.mark.parametrize('change', [
    lambda rows: rows[0].update(title='Другой заголовок'),
    lambda rows: rows[0].update(id='replacement'),
    lambda rows: rows.append(dict(rows[0], id='ambiguous')),
    lambda rows: rows[0].update(links=[{'url': 'https://youtu.be/different12'}]),
])
def test_catalog_change_hides_bundle(tmp_path, change):
    _, store, rows = stores(tmp_path); store.import_batch(ArticleBatch(**article_payload()), rows)
    change(rows)
    assert store.active_bundles(rows) == []


def test_existing_semantic_identity_and_alias_cannot_be_reassigned(tmp_path):
    content, store, rows = stores(tmp_path)
    semantic = semantic_payload(); semantic['pages'][0]['aliases'] = ['Понятие']
    SemanticStore(content).import_batch(SemanticBatch(**semantic), rows)
    data = article_payload(); data['concepts'][0]['kind'] = 'term'
    with pytest.raises(ValueError, match='Тип'): store.import_batch(ArticleBatch(**data), rows)
    data = article_payload(); data['concepts'][0]['id'] = 'other-topic'
    for link in data['links']: link['concept_id'] = 'other-topic'
    for article in data['articles']: article['related'][0]['via_concept_id'] = 'other-topic'
    with pytest.raises(ValueError, match='псевдоним'): store.import_batch(ArticleBatch(**data), rows)


def test_private_public_owner_access_and_default_v1_compatibility(tmp_path, monkeypatch):
    origin = 'https://daychee.test'; password = 'test-owner-password'
    monkeypatch.setenv('DAYCHEE_PUBLIC_ORIGIN', origin)
    monkeypatch.setenv('DAYCHEE_ADMIN_PASSWORD_HASH', password_hash(password))
    monkeypatch.setenv('DAYCHEE_PUBLIC_WIKI_ENABLED', '1')
    monkeypatch.setenv('DAYCHEE_WIKI_ARTICLES_ENABLED', '1')
    raw = [{'id': f'fixture:{i}', 'title': 'Урок', 'source_timestamp_ms': i + 1, 'source_date_label': 'Дата',
            'category_id': 'test', 'category_name': 'Раздел', 'subtopic': '', 'subtopic_key': '',
            'source_text': 'Описание', 'links': [{'url': f'https://youtu.be/{r}', 'type': 'video', 'label': 'Видео'}]}
           for i, r in enumerate(('abcdefghijk', 'otherid1234'))]
    index = tmp_path / 'index.json'; index.write_text(json.dumps(raw))
    invitations = Invitations(tmp_path / 'access.sqlite3')
    app = create_daychee_app(WikiSettings(index, tmp_path / 'wiki.sqlite3', '', ''), invitations, tmp_path / 'zoom.json')
    client = TestClient(app, base_url=origin)
    rows = app.state.wiki_catalog(); ids = tuple(r['id'] for r in rows)
    app.state.wiki_content.import_batch(Batch(batch_id='sources', records=[payload(), payload('otherid1234')]), rows)
    baseline = client.get('/api/public/wiki/graph').json(); recent = client.get('/api/public/wiki/recent').json()
    body = ArticleBatch(**article_payload(ids)).model_dump()
    # Editorial IDs often embed a recording ID; public DTOs must not expose it.
    body = json.loads(json.dumps(body).replace('"e0"', '"abcdefghijk:e0"').replace('"l0"', '"abcdefghijk:l0"'))
    body['articles'][0]['claims'][1]['id'] = 'abcdefghijk:body'
    body['articles'][0]['sections'][0]['claim_ids'] = ['abcdefghijk:body']
    assert client.get('/api/wiki/articles/materials/' + ids[0]).status_code == 401
    assert client.post('/api/admin/wiki/articles', json=body).status_code == 401
    assert client.get('/api/admin/wiki/articles/sources').status_code == 401
    login = client.post('/api/admin/login', json={'password': password}, headers={'Origin': origin})
    assert client.post('/api/admin/wiki/articles', json=body, headers={'Origin': origin}).status_code == 403
    headers = {'Origin': origin, 'X-CSRF-Token': login.json()['csrf']}
    inventory = client.get('/api/admin/wiki/articles/sources').json()['materials']
    assert len(inventory) == 2 and inventory[0]['annotation']['resource_id'] == 'abcdefghijk'
    assert inventory[0]['annotation']['transcript_sha256'] == 'a' * 64
    assert all(link['type'] != 'zoom' for row in inventory for link in row['links'])
    assert client.post('/api/admin/wiki/articles', json=body, headers=headers).status_code == 200
    assert client.get('/api/public/wiki/graph').json() == baseline
    assert client.get('/api/public/wiki/recent').json() == recent
    opted = client.get('/api/public/wiki/graph?articles=1').json()
    assert opted['articles_enabled'] and len(opted['nodes']) == len(baseline['nodes']) + 1
    public = client.get('/api/public/wiki/articles/materials/' + ids[0])
    assert public.json()['sections'][0]['heading'] == 'Смысл раздела'
    concept = client.get('/api/public/wiki/articles/concepts/fixture-topic')
    assert concept.status_code == 200 and concept.json()['id'] == 'fixture-topic'
    for response in (public, concept):
        assert all(secret not in response.text for secret in ('resource_id', 'abcdefghijk', 'otherid1234', 'sha256', 'youtube'))
    mention = public.json()['sections'][0]['paragraphs'][0]['mentions'][0]
    assert mention['link_id'] == concept.json()['links'][0]['id']
    assert mention['link_id'] in next(e for e in opted['edges'] if e.get('article_relation') and e['s'] == ids[0])['link_ids']
    assert public.json()['sections'][0]['paragraphs'][0]['evidence_ids'][0] == public.json()['evidence'][0]['id']
    _, code = invitations.issue_code(); token = invitations.redeem(code)
    auth = {'Authorization': 'Bearer ' + token}
    assert client.get('/api/wiki/articles/materials/' + ids[0], headers=auth).status_code == 200
    monkeypatch.setenv('DAYCHEE_PUBLIC_WIKI_ENABLED', '0')
    assert client.get('/api/public/wiki/articles/materials/' + ids[0]).status_code == 404
    assert client.get('/api/wiki/articles/materials/' + ids[0], headers=auth).status_code == 200
    monkeypatch.setenv('DAYCHEE_PUBLIC_WIKI_ENABLED', '1')
    app.state.wiki_articles.enabled = False
    assert client.get('/api/public/wiki/articles/materials/' + ids[0]).status_code == 404
