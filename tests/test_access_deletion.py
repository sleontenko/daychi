from concurrent.futures import ThreadPoolExecutor
import secrets
import sqlite3

import pytest
from fastapi.testclient import TestClient

from practice_api.access_deletion import AccessDeletion
from practice_api.access_requests import AccessRequests, RequestConflict
from practice_api.daychee_app import create_daychee_app
from practice_api.invitations import Invitations
from practice_api.wiki_app import WikiSettings


def key():
    return secrets.token_urlsafe(32)


@pytest.mark.parametrize('state', ['pending', 'rejected', 'approved', 'active', 'revoked', 'signed_out'])
def test_deletes_own_profile_and_grant_only_in_all_states(tmp_path, state):
    invites = Invitations(tmp_path / 'access.db')
    requests = AccessRequests(invites)
    own, other, session = key(), key(), key()
    own_id = requests.submit(own, 'Delete', 'Me', 'test_user')['id']
    other_id = requests.submit(other, 'Keep', 'Me')['id']
    if state == 'rejected':
        requests.decide(own_id, 'rejected')
    elif state != 'pending':
        requests.decide(own_id, 'approved')
        if state != 'approved':
            requests.claim(own, session)
        if state == 'signed_out':
            invites.logout(session)
        if state == 'revoked':
            invites.revoke(next(row['invite_id'] for row in requests.inventory() if row['id'] == own_id))
    deletion = AccessDeletion(invites)
    op = key()
    assert deletion.delete([own], op) == {'deleted': True}
    assert deletion.delete([own], op) == {'deleted': True}
    assert requests.status(own) is None
    assert requests.status(other)['id'] == other_id
    assert not invites.authorized(session)
    with sqlite3.connect(invites.path) as con:
        assert con.execute('SELECT count(*) FROM invites').fetchone()[0] == 0
        assert con.execute('SELECT count(*) FROM admin_audit').fetchone()[0] == 0
        assert con.execute('SELECT request_id FROM access_request_notifications').fetchall() == [(other_id,)]
    with pytest.raises(RequestConflict):
        requests.submit(own, 'Delete', 'Me')  # a stale request retry cannot recreate the profile
    with pytest.raises(RequestConflict):
        deletion.delete([other], op)


@pytest.mark.parametrize('state', ['active', 'revoked', 'signed_out'])
def test_legacy_session_proves_deletion_without_content_access(tmp_path, state):
    invites = Invitations(tmp_path / 'access.db')
    own_id, code = invites.admin_issue('Delete Person', key())
    other_id, other_code = invites.admin_issue('Keep Person', key())
    session, other_session = invites.redeem(code), invites.redeem(other_code)
    if state == 'revoked':
        invites.revoke(own_id)
    elif state == 'signed_out':
        invites.logout(session)
    deletion = AccessDeletion(invites)
    op = key()
    with ThreadPoolExecutor(max_workers=4) as executor:
        results = list(executor.map(lambda _: deletion.delete([session], op), range(4)))
    assert results == [{'deleted': True}] * 4
    assert not invites.authorized(session) and invites.authorized(other_session)
    assert [row['id'] for row in invites.inventory()] == [other_id]
    with sqlite3.connect(invites.path) as con:
        assert not con.execute('SELECT 1 FROM invitation_operations WHERE invite_id=?', (own_id,)).fetchone()
        assert not con.execute('SELECT 1 FROM admin_audit WHERE invite_id=?', (own_id,)).fetchone()
    assert deletion.delete([key()], key()) is None


def test_session_proof_also_removes_linked_request(tmp_path):
    invites = Invitations(tmp_path / 'access.db')
    requests = AccessRequests(invites)
    own, session = key(), key()
    identity = requests.submit(own, 'Delete', 'Me')['id']
    requests.decide(identity, 'approved')
    requests.claim(own, session)
    assert AccessDeletion(invites).delete([session], key())['deleted']
    assert requests.status(own) is None


def test_transport_default_off_proof_validation_origin_and_no_echo(tmp_path, monkeypatch):
    invites = Invitations(tmp_path / 'access.db')
    cfg = WikiSettings(tmp_path / 'index.json', tmp_path / 'wiki.db', '', '')
    monkeypatch.delenv('DAYCHEE_DATA_DELETION_ENABLED', raising=False)
    assert TestClient(create_daychee_app(cfg, invites)).post('/api/access/delete', json={}).status_code == 404
    monkeypatch.setenv('DAYCHEE_DATA_DELETION_ENABLED', '1')
    monkeypatch.setenv('DAYCHEE_PUBLIC_ORIGIN', 'https://test.invalid')
    client = TestClient(create_daychee_app(cfg, invites))
    own = key()
    AccessRequests(invites).submit(own, 'Delete', 'Me')
    body = {'operation_id': key(), 'credentials': [own]}
    assert client.post('/api/access/delete', headers={'Origin': 'https://evil.invalid'}, json=body).status_code == 403
    response = client.post('/api/access/delete', json={'operation_id': 'do-not-echo', 'credentials': [own]})
    assert response.status_code == 422 and own not in response.text and 'do-not-echo' not in response.text
    assert client.post('/api/access/delete', content='x' * 9000).status_code == 413
    response = client.post('/api/access/delete', json=body)
    assert response.status_code == 200 and response.json() == {'deleted': True}
    assert response.headers['cache-control'] == 'no-store'
    assert client.post('/api/access/delete', json=body).json() == response.json()
