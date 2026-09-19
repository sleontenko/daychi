import json
import sqlite3

from fastapi.testclient import TestClient
from practice_api.wiki_app import WikiSettings, create_wiki_app


def record(n, title='Трёхмерность в нейгун'):
    return {'id': f'nikita:base:{n}', 'title': title, 'source_date_label': '18 сен 2026',
            'source_timestamp_ms': n, 'category_id': 'neigong', 'category_name': 'Нэйгун',
            'subtopic': 'Трёхмерность', 'subtopic_key': 'трёхмерность',
            'source_text': f'{title} Код доступа: private-code https://example.com/{n}',
            'links': [{'url': f'https://example.com/{n}', 'type': 'zoom', 'label': 'Zoom'}]}


def setup(tmp_path, count=1, seconds=3600):
    path = tmp_path / 'index.json'
    path.write_text(json.dumps([record(n) for n in range(count)]))
    cfg = WikiSettings(path, tmp_path / 'wiki.sqlite3', 'student', 'test-password', session_seconds=seconds)
    return cfg, TestClient(create_wiki_app(cfg))


def auth(client):
    response = client.post('/api/wiki/login', json={'username': 'student', 'password': 'test-password'})
    assert response.status_code == 200
    return {'Authorization': 'Bearer ' + response.json()['token']}


def test_auth_and_redaction(tmp_path):
    cfg, client = setup(tmp_path)
    for url in ['/api/wiki/categories', '/api/wiki/materials', '/api/wiki/materials/anything']:
        assert client.get(url).status_code == 401
    assert client.post('/api/wiki/login', json={'username': 'student', 'password': 'wrong'}).status_code == 401
    headers = auth(client)
    response = client.get('/api/wiki/materials', headers=headers)
    assert response.headers['cache-control'] == 'no-store'
    assert 'private-code' not in response.text and 'example.com' not in response.text
    row = response.json()['items'][0]
    detail = client.get('/api/wiki/materials/' + row['id'], headers=headers).json()
    assert detail['zoom_password'] == 'private-code'
    assert 'private-code' not in detail['description']
    assert 'source_record' not in detail
    with sqlite3.connect(cfg.database) as con:
        assert headers['Authorization'].split()[1] not in str(con.execute('SELECT * FROM sessions').fetchall())
    assert client.get('/api/wiki/materials?ids=missing', headers=headers).json()['missing_ids'] == ['missing']
    invalid = client.post('/api/wiki/login', json={'username': '', 'password': 'do-not-echo'})
    assert invalid.status_code == 422 and 'do-not-echo' not in invalid.text
    assert client.post('/api/wiki/logout', headers=headers).status_code == 200
    assert client.get('/api/wiki/materials', headers=headers).status_code == 401


def test_pagination_search_filters_and_stability(tmp_path):
    cfg, client = setup(tmp_path, 315)
    headers = auth(client)
    ids = []
    for offset in range(0, 315, 100):
        result = client.get('/api/wiki/materials', params={'offset': offset, 'limit': 100, 'q': 'ТРЕХМЕРНОСТЬ'}, headers=headers).json()
        assert result['total'] == 315
        ids += [r['id'] for r in result['items']]
    assert len(set(ids)) == 315
    assert client.get('/api/wiki/materials?category=missing', headers=headers).json()['total'] == 0
    assert client.get('/api/wiki/materials?q=private-code', headers=headers).json()['total'] == 0
    assert client.get('/api/wiki/materials', params={'ids': ids[0]}, headers=headers).json()['total'] == 1
    first = client.get('/api/wiki/materials', headers=headers).json()['items'][0]['id']
    updated = [record(n, 'Обновлённое название') for n in range(315)]
    for row in updated:
        row['id'] += '-edited'
        row['links'][0]['url'] += '?edited=true'
    cfg.index.write_text(json.dumps(updated))
    assert client.get('/api/wiki/materials', headers=headers).json()['items'][0]['id'] == first
    # Restart preserves sessions and identity mapping.
    restarted = TestClient(create_wiki_app(cfg))
    assert restarted.get('/api/wiki/materials', headers=headers).json()['items'][0]['id'] == first
    cfg.index.write_text('invalid')
    assert restarted.get('/api/wiki/materials', headers=headers).json()['total'] == 315


def test_expiry_rotation_and_rate_limit(tmp_path):
    cfg, client = setup(tmp_path, seconds=-1)
    headers = auth(client)
    assert client.get('/api/wiki/categories', headers=headers).status_code == 401
    cfg.session_seconds = 3600
    headers = auth(client)
    cfg.password = 'rotated'
    assert TestClient(create_wiki_app(cfg)).get('/api/wiki/categories', headers=headers).status_code == 401
    for _ in range(10):
        response = client.post('/api/wiki/login', json={'username': 'student', 'password': 'wrong'})
    assert response.status_code == 429


def test_missing_config_and_missing_catalog(tmp_path):
    cfg, client = setup(tmp_path)
    headers = auth(client)
    cfg.index.unlink()
    assert client.get('/api/wiki/materials', headers=headers).status_code == 503
    cfg.password = ''
    client = TestClient(create_wiki_app(cfg))
    assert client.post('/api/wiki/login', json={'username': 'student', 'password': 'wrong'}).status_code == 503
    assert client.get('/api/wiki/materials').status_code == 503
