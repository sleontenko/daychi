import secrets
import time
from fastapi.testclient import TestClient

from practice_api.access_deletion import AccessDeletion
from practice_api.invitations import Invitations, digest
from practice_api.retention import DAY, prune
from practice_api.daychee_app import create_daychee_app
from practice_api.wiki_app import WikiSettings


def test_review_reusable_access_is_explicit_expiring_and_deletion_is_per_device(tmp_path, monkeypatch):
    store = Invitations(tmp_path / 'access.db')
    token = secrets.token_urlsafe(32)
    monkeypatch.delenv('DAYCHEE_REVIEW_CREDENTIAL_SHA256', raising=False)
    assert store.redeem(token) is None
    monkeypatch.setenv('DAYCHEE_REVIEW_CREDENTIAL_SHA256', digest(token))
    monkeypatch.setenv('DAYCHEE_REVIEW_EXPIRES_AT', str(time.time() + 30 * DAY))
    first, second = store.redeem(token), store.redeem(token)
    assert first != second and store.authorized(first) and store.authorized(second)
    AccessDeletion(store).delete([first], secrets.token_urlsafe(32))
    assert not store.authorized(first) and store.authorized(second)
    third = store.redeem(token)
    assert store.authorized(third)
    monkeypatch.setenv('DAYCHEE_REVIEW_CREDENTIAL_SHA256', digest('rotated'))
    assert not store.authorized(second) and not store.authorized(third)
    assert store.redeem(token) is None
    monkeypatch.setenv('DAYCHEE_REVIEW_CREDENTIAL_SHA256', digest(token))
    monkeypatch.setenv('DAYCHEE_REVIEW_EXPIRES_AT', str(time.time() - 1))
    assert not store.authorized(second) and store.redeem(token) is None


def test_review_setting_does_not_change_normal_invitation_lifetime(tmp_path, monkeypatch):
    store = Invitations(tmp_path / 'access.db')
    _, token = store.issue()
    session = store.redeem(token)
    for expires in ('nan', 'infinity', 'invalid', '0', str(time.time() + 91 * DAY)):
        monkeypatch.setenv('DAYCHEE_REVIEW_CREDENTIAL_SHA256', digest('review'))
        monkeypatch.setenv('DAYCHEE_REVIEW_EXPIRES_AT', expires)
        assert store.authorized(session)
        assert store.redeem('review') is None


def test_expired_review_grant_is_retained_for_90_days_then_purged(tmp_path, monkeypatch):
    store = Invitations(tmp_path / 'access.db')
    token, now = secrets.token_urlsafe(32), time.time()
    deadline = now + DAY
    monkeypatch.setenv('DAYCHEE_REVIEW_CREDENTIAL_SHA256', digest(token))
    monkeypatch.setenv('DAYCHEE_REVIEW_EXPIRES_AT', str(deadline))
    session = store.redeem(token)
    assert prune(store, now=deadline + 89 * DAY)['grants'] == 0
    assert prune(store, now=deadline + 91 * DAY)['grants'] == 1
    assert not store.authorized(session)


def test_review_uses_normal_invitation_transport_and_session_deletion(tmp_path, monkeypatch):
    token = secrets.token_urlsafe(32)
    monkeypatch.setenv('DAYCHEE_REVIEW_CREDENTIAL_SHA256', digest(token))
    monkeypatch.setenv('DAYCHEE_REVIEW_EXPIRES_AT', str(time.time() + 30 * DAY))
    monkeypatch.setenv('DAYCHEE_DATA_DELETION_ENABLED', '1')
    cfg = WikiSettings(tmp_path / 'index.json', tmp_path / 'wiki.db', '', '')
    client = TestClient(create_daychee_app(cfg, Invitations(tmp_path / 'access.db')))
    first = client.post('/api/access/redeem', json={'token': token}).json()['token']
    second = client.post('/api/access/redeem', json={'token': token}).json()['token']
    assert client.get('/api/access/session', headers={'Authorization': 'Bearer ' + first}).status_code == 200
    assert client.post('/api/access/delete', json={'operation_id': secrets.token_urlsafe(32), 'credentials': [first]}).json() == {'deleted': True}
    assert client.get('/api/access/session', headers={'Authorization': 'Bearer ' + first}).status_code == 401
    assert client.get('/api/access/session', headers={'Authorization': 'Bearer ' + second}).status_code == 200
    monkeypatch.delenv('DAYCHEE_REVIEW_CREDENTIAL_SHA256')
    assert client.get('/api/access/session', headers={'Authorization': 'Bearer ' + second}).status_code == 401
