from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import sqlite3
import time
from fastapi.testclient import TestClient
from practice_api.invitations import Invitations, normalize_code
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


def test_code_is_one_use_case_insensitive_and_revocable(tmp_path):
    store = Invitations(tmp_path / 'access.db')
    cfg = WikiSettings(tmp_path / 'index.json', tmp_path / 'wiki.db', '', '')
    client = TestClient(create_daychee_app(cfg, store))
    identity, code = store.issue_code()
    assert len(code) == 12 and normalize_code(code) == code
    assert code.encode() not in store.path.read_bytes()
    formatted = ' ' + '-'.join(code[i:i+4] for i in range(0, 12, 4)).lower() + ' '
    response = client.post('/api/access/redeem-code', json={'code': formatted})
    assert response.status_code == 200
    session = response.json()['token']
    assert store.authorized(session)
    assert client.post('/api/access/redeem-code', json={'code': code}).status_code == 401
    assert store.revoke(identity)
    assert not store.authorized(session)
    for invalid in ['0000-1111-OOOO', '<script>evil</script>', 'A' * 41]:
        response = client.post('/api/access/redeem-code', json={'code': invalid})
        assert response.status_code == 422
        assert invalid not in response.text


def test_code_expiry_atomic_redeem_and_shared_throttle(tmp_path):
    store = Invitations(tmp_path / 'access.db')
    identity, code = store.issue_code()
    with ThreadPoolExecutor(max_workers=4) as executor:
        sessions = list(executor.map(store.redeem, [code] * 4))
    assert len([s for s in sessions if s]) == 1
    expired_id, expired = store.issue_code()
    with sqlite3.connect(store.path) as con:
        con.execute('UPDATE invites SET expires=0 WHERE id=?', (expired_id,))
    assert store.redeem(expired) is None
    cfg = WikiSettings(tmp_path / 'index.json', tmp_path / 'wiki.db', '', '')
    client = TestClient(create_daychee_app(cfg, store))
    for _ in range(5):
        assert client.post('/api/access/redeem-code', json={'code': 'A' * 12}).status_code == 401
        assert client.post('/api/access/redeem', json={'token': 'x' * 43}).status_code == 401
    assert client.post('/api/access/redeem-code', json={'code': 'A' * 12}).status_code == 429


def test_public_invitation_page_never_redeems_or_exposes_private_data(tmp_path):
    store = Invitations(tmp_path / 'access.db')
    identity, code = store.issue_code()
    cfg = WikiSettings(tmp_path / 'index.json', tmp_path / 'wiki.db', '', '')
    client = TestClient(create_daychee_app(cfg, store))
    page = client.get('/invite')
    assert page.status_code == 200
    assert code not in page.text
    assert page.headers['cache-control'] == 'no-store'
    assert page.headers['referrer-policy'] == 'no-referrer'
    assert "frame-ancestors 'none'" in page.headers['content-security-policy']
    assert client.get('/invitation-assets/invitation.js').status_code == 200
    assert client.get('/invitation-assets/invitation.css').status_code == 200
    assert client.get('/invitation-assets/other').status_code == 404
    assert client.get('/api/wiki/materials').status_code == 401
    assert store.redeem(code)  # Previewing a message/link must not consume the invitation.


def test_rejection_states_are_distinct_without_credentials_or_identity(tmp_path):
    store = Invitations(tmp_path / 'access.db')
    cfg = WikiSettings(tmp_path / 'index.json', tmp_path / 'wiki.db', '', '')
    client = TestClient(create_daychee_app(cfg, store))
    for state in ['invalid', 'expired', 'used', 'revoked']:
        identity, code = store.issue_code()
        if state == 'invalid':
            code = 'A' * 12
        elif state == 'expired':
            with sqlite3.connect(store.path) as con:
                con.execute('UPDATE invites SET expires=? WHERE id=?', (time.time() - 1, identity))
        elif state == 'used':
            assert store.redeem(code)
        else:
            store.revoke(identity)
        response = client.post('/api/access/redeem-code', json={'code': code})
        assert response.status_code == 401
        assert response.json() == {'detail': {'code': state}}
        assert code not in response.text and identity not in response.text
        assert response.headers['cache-control'] == 'no-store'
