from concurrent.futures import ThreadPoolExecutor
import json
import sqlite3
import time
from uuid import uuid4

from fastapi.testclient import TestClient
import pytest

from practice_api.admin import COOKIE, password_hash
from practice_api.daychee_app import create_daychee_app
from practice_api.invitations import Invitations
from practice_api.wiki_app import WikiSettings

ORIGIN = 'https://daychee.test'
PASSWORD = 'only-for-local-tests-not-production'


@pytest.fixture
def configured(tmp_path, monkeypatch):
    monkeypatch.setenv('DAYCHEE_PUBLIC_ORIGIN', ORIGIN)
    monkeypatch.setenv('DAYCHEE_ADMIN_PASSWORD_HASH', password_hash(PASSWORD))
    store = Invitations(tmp_path / 'access.sqlite3')
    settings = WikiSettings(tmp_path / 'index.json', tmp_path / 'wiki.sqlite3', '', '')
    app = create_daychee_app(settings, store, tmp_path / 'zoom.json')
    client = TestClient(app, base_url=ORIGIN)
    return client, store, settings


def login(client):
    r = client.post('/api/admin/login', headers={'Origin': ORIGIN}, json={'password': PASSWORD})
    assert r.status_code == 200
    assert 'HttpOnly' in r.headers['set-cookie'] and 'Secure' in r.headers['set-cookie']
    assert 'SameSite=strict' in r.headers['set-cookie']
    assert r.headers['cache-control'] == 'no-store'
    return {'Origin': ORIGIN, 'X-CSRF-Token': r.json()['csrf']}


def test_no_participant_or_anonymous_admin(configured):
    c, store, _ = configured
    _, token = store.issue_code()
    participant = store.redeem(token)
    for headers in ({}, {'Authorization': 'Bearer ' + participant}):
        assert c.get('/api/admin/invitations', headers=headers).status_code == 401
        assert c.post('/api/admin/invitations', headers=headers, json={'operation_id': str(uuid4())}).status_code == 401
    assert c.get('/admin').status_code == 200
    assert 'frame-ancestors' in c.get('/admin').headers['content-security-policy']
    assert c.get('/admin-assets/admin.sqlite3').status_code == 404


def test_login_origin_csrf_and_logout(configured):
    c, _, _ = configured
    assert c.post('/api/admin/login', json={'password': PASSWORD}).status_code == 403
    assert c.post('/api/admin/login', headers={'Origin': 'https://evil.test'}, json={'password': PASSWORD}).status_code == 403
    headers = login(c)
    assert c.get('/api/admin/session').status_code == 200
    body = {'operation_id': str(uuid4())}
    assert c.post('/api/admin/invitations', json=body).status_code == 403
    assert c.post('/api/admin/invitations', headers={**headers, 'Origin': 'https://evil.test'}, json=body).status_code == 403
    assert c.post('/api/admin/invitations', headers={**headers, 'Sec-Fetch-Site': 'cross-site'}, json=body).status_code == 403
    assert c.post('/api/admin/logout', headers=headers).status_code == 200
    assert c.get('/api/admin/session').status_code == 401


def test_create_replay_activate_revoke_and_no_secrets(configured):
    c, store, _ = configured
    headers = login(c)
    operation = str(uuid4())
    body = {'operation_id': operation, 'label': '<script>alert(1)</script>'}
    first = c.post('/api/admin/invitations', json=body, headers=headers).json()
    assert len(first['code']) == 12 and first['url'] == ORIGIN + '/invite#' + first['code']
    replay = c.post('/api/admin/invitations', json=body, headers=headers).json()
    assert replay == {'id': first['id'], 'code': None, 'url': None, 'already_created': True}
    assert c.post('/api/admin/invitations', json={**body, 'label': 'different'}, headers=headers).status_code == 409
    listing = c.get('/api/admin/invitations').json()
    assert len(listing['items']) == 1
    assert first['code'] not in json.dumps(listing) and 'token_hash' not in json.dumps(listing)
    participant = store.redeem(first['code'])
    assert store.authorized(participant)
    assert c.get('/api/admin/invitations').json()['summary']['active_accesses'] == 1
    for _ in range(2):
        assert c.post('/api/admin/invitations/' + first['id'] + '/revoke', headers=headers).status_code == 200
    assert not store.authorized(participant)
    with sqlite3.connect(store.path) as con:
        assert con.execute('SELECT action FROM admin_audit ORDER BY id').fetchall() == [('issue',), ('revoke',)]
    assert first['code'].encode() not in store.path.read_bytes()


def test_concurrent_retries_only_issue_once(configured):
    _, store, _ = configured
    operation = str(uuid4())
    with ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(lambda _: store.admin_issue('one', operation), range(6)))
    assert len({r[0] for r in results}) == 1
    assert sum(r[1] is not None for r in results) == 1
    assert len(store.inventory()) == 1


def test_expired_session_and_password_rotation(configured, monkeypatch):
    c, store, settings = configured
    login(c)
    cookie = c.cookies.get(COOKIE)
    monkeypatch.setenv('DAYCHEE_ADMIN_PASSWORD_HASH', password_hash('rotated'))
    other = TestClient(create_daychee_app(settings, store), base_url=ORIGIN)
    other.cookies.set(COOKIE, cookie)
    assert other.get('/api/admin/session').status_code == 401
    with sqlite3.connect(store.path.with_name('admin.sqlite3')) as con:
        con.execute('UPDATE sessions SET expires=?', (time.time() - 1,))
    assert c.get('/api/admin/session').status_code == 401


def test_persistent_login_throttle(configured):
    c, store, settings = configured
    for _ in range(8):
        assert c.post('/api/admin/login', headers={'Origin': ORIGIN}, json={'password': 'bad'}).status_code == 401
    other = TestClient(create_daychee_app(settings, store), base_url=ORIGIN)
    r = other.post('/api/admin/login', headers={'Origin': ORIGIN}, json={'password': PASSWORD})
    assert r.status_code == 429 and r.headers['retry-after'] == '900'


def test_missing_config_fails_closed(tmp_path, monkeypatch):
    monkeypatch.delenv('DAYCHEE_ADMIN_PASSWORD_HASH', raising=False)
    monkeypatch.delenv('DAYCHEE_PUBLIC_ORIGIN', raising=False)
    c = TestClient(create_daychee_app(invitations=Invitations(tmp_path / 'access.sqlite3')))
    assert c.get('/api/admin/invitations').status_code == 503
    assert c.post('/api/admin/login', headers={'Origin': ORIGIN}, json={'password': PASSWORD}).status_code == 503


def test_migration_keeps_existing_session(configured):
    c, store, _ = configured
    _, code = store.issue()
    session = store.redeem(code)
    headers = login(c)
    assert c.post('/api/admin/invitations', json={'operation_id': str(uuid4())}, headers=headers).status_code == 200
    assert store.authorized(session)
