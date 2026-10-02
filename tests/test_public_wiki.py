import json

from fastapi.testclient import TestClient
from practice_api.wiki_app import WikiSettings, create_wiki_app
from practice_api.public_wiki import public_link, public_material

def record(n, title):
    return {'id': f'nikita:base:{n}', 'title': title, 'source_date_label': '18 сен 2026',
            'source_timestamp_ms': n, 'category_id': 'neigong', 'category_name': 'Нэйгун',
            'subtopic': 'Трёхмерность', 'subtopic_key': 'трёхмерность',
            'source_text': f'{title} Код доступа: private-code https://example.com/{n}',
            'links': [{'url': f'https://example.com/{n}', 'type': 'zoom', 'label': 'Zoom'}]}


def test_public_wiki_is_off_until_explicit_rollout(tmp_path, monkeypatch):
    monkeypatch.delenv('DAYCHEE_PUBLIC_WIKI_ENABLED', raising=False)
    client = TestClient(create_wiki_app(WikiSettings(tmp_path/'index.json', tmp_path/'wiki.sqlite3', '', '')))
    for path in ('categories', 'materials', 'materials/x', 'graph'):
        assert client.get('/api/public/wiki/' + path).status_code == 404


def test_public_catalog_never_exposes_private_connections(tmp_path, monkeypatch):
    monkeypatch.setenv('DAYCHEE_PUBLIC_WIKI_ENABLED', '1')
    raw = record(1, 'Урок 1')
    raw['links'].append({'url': 'https://youtu.be/abcdefghijk', 'type': 'video', 'label': 'Видео'})
    index = tmp_path/'index.json'
    index.write_text(json.dumps([raw]))
    client = TestClient(create_wiki_app(WikiSettings(index, tmp_path/'wiki.sqlite3', 'student', 'pw')))
    result = client.get('/api/public/wiki/materials').json()
    identity = result['items'][0]['id']
    response = client.get('/api/public/wiki/materials/' + identity)
    assert response.status_code == 200 and response.headers['cache-control'] == 'no-store'
    public = response.json()
    assert public['links'] == [{'url': 'https://youtu.be/abcdefghijk', 'type': 'video', 'label': 'Видео'}]
    assert public['restricted_links'] is True
    for path in ('categories', 'materials', 'materials/'+identity, 'graph'):
        text = client.get('/api/public/wiki/'+path).text
        assert 'private-code' not in text and 'example.com' not in text
        assert 'zoom_password' not in text and 'source_text' not in text
    # Existing protected endpoints remain protected for old clients.
    assert client.get('/api/wiki/materials/'+identity).status_code == 401
    assert client.get('/api/public/wiki/materials?q=private-code').json()['total'] == 0
    assert client.get('/api/public/wiki/materials?ids=missing').json()['missing_ids'] == ['missing']


def test_connection_host_cannot_bypass_guard_by_mislabeling():
    for url in ('https://us02web.zoom.us/j/123?pwd=private', 'https://zoom.us/j/123',
                'https://Zoom.COM./j/123', 'https://user:pw@video.test/v', 'http://youtu.be/123',
                'https://video.test/v?token=secret', 'https://video.test/v?%74oken=secret',
                'https://video.test:bad/v', 'https://[invalid/v'):
        assert public_link({'url': url, 'label': 'Video', 'type': 'video'}) is None


def test_public_detail_does_not_copy_unknown_fields():
    row = {key: '' for key in ('id','title','date','category','category_name','subtopic','subtopic_key','description')}
    row.update(timestamp=1, links=[], zoom_password='private', source_text='private', credential='private')
    assert 'private' not in json.dumps(public_material(row))


def test_public_annotations_are_allowlisted_and_redacted():
    row = {key: '' for key in ('id','title','date','category','category_name','subtopic','subtopic_key','description')}
    row.update(timestamp=1, links=[{'type': 'video', 'label': 'Видео', 'url': 'https://youtu.be/abcdefghijk'}])
    class Content:
        def get(self, identity, links):
            return {'resource_id': 'abcdefghijk', 'revision': 1, 'status': 'source_checked_draft',
                    'summary': 'Аннотация пароль: hidden-secret https://zoom.us/j/123',
                    'points': [{'text': 'Цитата код доступа: hidden-secret', 'start_seconds': 1,
                                'end_seconds': 2, 'private_provenance': 'private'}],
                    'transcript_sha256': 'private'}
    result = json.dumps(public_material(row, Content()))
    assert 'hidden-secret' not in result and 'zoom.us' not in result and 'private' not in result
