from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import sqlite3
import time
from fastapi.testclient import TestClient
from practice_api.invitations import Invitations
from practice_api.daychee_app import create_daychee_app
from practice_api.wiki_app import WikiSettings


def test_one_use_atomic_revocable_and_hashed(tmp_path):
    store = Invitations(tmp_path / 'access.db')
    identity, token = store.issue()
    with ThreadPoolExecutor(max_workers=4) as executor:
        results = list(executor.map(store.redeem, [token] * 4))
    sessions = [x for x in results if x]
    assert len(sessions) == 1
    assert store.authorized(sessions[0])
    assert token.encode() not in store.path.read_bytes()
    assert sessions[0].encode() not in store.path.read_bytes()
    assert store.revoke(identity)
    assert not store.authorized(sessions[0])
    assert store.redeem(token) is None


def test_expiration_logout_and_separate_phone(tmp_path):
    store = Invitations(tmp_path / 'access.db')
    first, token = store.issue()
    second, second_token = store.issue()
    session = store.redeem(token)
    second_session = store.redeem(second_token)
    store.logout(session)
    assert not store.authorized(session)
    assert store.authorized(second_session)
    assert store.redeem(token) is None
    identity, expired = store.issue()
    with sqlite3.connect(store.path) as con:
        con.execute('UPDATE invites SET expires=? WHERE id=?', (time.time() - 1, identity))
    assert store.redeem(expired) is None
    # A redeemed session has no invitation TTL: it survives until explicit revoke.
    with sqlite3.connect(store.path) as con:
        con.execute('UPDATE invites SET expires=0 WHERE id=?', (second,))
    assert store.authorized(second_session)


def test_all_private_routes_deny_anonymous_and_revoke_immediately(tmp_path):
    store = Invitations(tmp_path / 'access.db')
    zoom = tmp_path / 'zoom.json'
    zoom.write_text(json.dumps([{'url': 'https://zoom.us/j/123456', 'password': 'synthetic'}]))
    cfg = WikiSettings(tmp_path / 'missing-index.json', tmp_path / 'wiki.db', '', '')
    client = TestClient(create_daychee_app(cfg, store, zoom))
    for path in ['/api/wiki/categories', '/api/wiki/materials', '/api/wiki/materials/abc', '/api/access/zoom', '/api/access/session']:
        response = client.get(path)
        assert response.status_code == 401
        assert response.headers['cache-control'] == 'no-store'
        assert 'synthetic' not in response.text
    identity, token = store.issue()
    response = client.post('/api/access/redeem', json={'token': token})
    assert response.status_code == 200
    headers = {'Authorization': 'Bearer ' + response.json()['token']}
    assert client.get('/api/access/zoom', headers=headers).status_code == 200
    assert client.post('/api/access/redeem', json={'token': token}).status_code == 401
    store.revoke(identity)
    assert client.get('/api/access/zoom', headers=headers).status_code == 401
    assert client.get('/api/access/session', headers=headers).status_code == 401
    assert client.post('/api/wiki/login', json={'username': 'old', 'password': 'old'}).status_code == 410
    bad = client.post('/api/access/redeem', json={'token': 'secret'})
    assert bad.status_code == 422 and 'secret' not in bad.text


def test_redeem_throttled(tmp_path):
    store = Invitations(tmp_path / 'access.db')
    cfg = WikiSettings(tmp_path / 'index.json', tmp_path / 'wiki.db', '', '')
    client = TestClient(create_daychee_app(cfg, store))
    for _ in range(10):
        assert client.post('/api/access/redeem', json={'token': 'x' * 43}).status_code == 401
    assert client.post('/api/access/redeem', json={'token': 'x' * 43}).status_code == 429
