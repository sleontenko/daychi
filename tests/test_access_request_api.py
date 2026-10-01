import secrets

from fastapi.testclient import TestClient

from practice_api.admin import password_hash
from practice_api.daychee_app import create_daychee_app
from practice_api.invitations import Invitations
from practice_api.wiki_app import WikiSettings


def test_disabled_until_both_interfaces_are_ready(tmp_path, monkeypatch):
    monkeypatch.delenv('DAYCHEE_ACCESS_REQUESTS_ENABLED', raising=False)
    app = create_daychee_app(WikiSettings(tmp_path / 'index.json', tmp_path / 'wiki.sqlite3', '', ''),
                             Invitations(tmp_path / 'access.sqlite3'), tmp_path / 'zoom.json')
    client = TestClient(app)
    assert client.get('/api/access/request').status_code == 404
    assert client.get('/api/admin/requests').status_code == 404
    assert client.get('/health').status_code == 200


def test_request_approval_e2e_and_authorization(tmp_path, monkeypatch):
    origin = 'https://requests.test'
    monkeypatch.setenv('DAYCHEE_ACCESS_REQUESTS_ENABLED', '1')
    monkeypatch.setenv('DAYCHEE_PUBLIC_ORIGIN', origin)
    monkeypatch.setenv('DAYCHEE_ADMIN_PASSWORD_HASH', password_hash('test-only-password'))
    store = Invitations(tmp_path / 'access.sqlite3')
    settings = WikiSettings(tmp_path / 'index.json', tmp_path / 'wiki.sqlite3', '', '')
    app = create_daychee_app(settings, store, tmp_path / 'zoom.json')
    client = TestClient(app, base_url=origin)
    key, session = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
    headers = {'Authorization': 'Bearer ' + key}
    body = {'first_name': 'Test', 'last_name': 'Person'}
    response = client.post('/api/access/request', headers=headers, json=body)
    assert response.status_code == 200
    assert response.headers['cache-control'] == 'no-store'
    assert 'notification_status' not in response.json()
    identity = response.json()['id']
    assert client.post('/api/access/request', headers=headers, json=body).json()['id'] == identity
    assert client.get('/api/access/session', headers=headers).status_code == 401
    assert client.get('/api/admin/requests', headers=headers).status_code == 401
    assert client.post(f'/api/admin/requests/{identity}/approve', headers=headers).status_code == 401
    other = {'Authorization': 'Bearer ' + secrets.token_urlsafe(32)}
    assert client.get('/api/access/request', headers=other).status_code == 404
    assert client.post('/api/access/request', headers={**headers, 'Origin': 'https://evil.test'}, json=body).status_code == 403
    assert client.post('/api/access/request', headers=headers, content='x' * 5000).status_code == 413
    invalid = client.post('/api/access/request/claim', headers=headers, json={'session_token': 'private-bad-token'})
    assert invalid.status_code == 422 and 'private-bad-token' not in invalid.text
    login = client.post('/api/admin/login', headers={'Origin': origin}, json={'password': 'test-only-password'})
    csrf = {'Origin': origin, 'X-CSRF-Token': login.json()['csrf']}
    admin_row = client.get('/api/admin/requests').json()['items'][0]
    assert admin_row['first_name'] == 'Test'
    assert admin_row['notification_status'] == 'pending'
    assert client.post(f'/api/admin/requests/{identity}/approve').status_code == 403
    for _ in range(2):
        assert client.post(f'/api/admin/requests/{identity}/approve', headers=csrf).json()['status'] == 'approved'
    assert client.get('/api/access/request', headers=headers).json()['status'] == 'approved'
    for _ in range(2):
        assert client.post('/api/access/request/claim', headers=headers, json={'session_token': session}).json()['status'] == 'active'
    access = {'Authorization': 'Bearer ' + session}
    assert client.get('/api/access/session', headers=access).status_code == 200
    client.post('/api/admin/logout', headers=csrf)
    assert client.get('/api/admin/requests', headers=access).status_code == 401
    assert client.get('/api/access/request', headers=access).status_code == 404
