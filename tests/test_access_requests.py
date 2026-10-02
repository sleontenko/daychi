from concurrent.futures import ThreadPoolExecutor
import json
import secrets
import sqlite3

import pytest

from practice_api.access_requests import AccessRequests, RequestConflict, RequestLimit
from practice_api.invitations import Invitations


@pytest.fixture
def stores(tmp_path):
    invitations = Invitations(tmp_path / 'access.sqlite3')
    return invitations, AccessRequests(invitations)


def token():
    return secrets.token_urlsafe(32)


def test_approval_claim_retry_logout_and_legacy(stores):
    invitations, requests = stores
    _, old_code = invitations.issue_code('legacy')
    old_session = invitations.redeem(old_code)
    secret, session = token(), token()
    request = requests.submit(secret, 'Тест', 'Участник', '@example_test')
    assert requests.claim(secret, session)['status'] == 'pending'
    assert not invitations.authorized(secret)
    assert not invitations.authorized(session)
    requests.decide(request['id'], 'approved')
    assert requests.status(secret)['status'] == 'approved'
    assert requests.claim(secret, session)['status'] == 'active'
    assert requests.claim(secret, session)['status'] == 'active'
    assert invitations.authorized(session)
    with pytest.raises(RequestConflict):
        requests.claim(secret, token())
    assert invitations.authorized(old_session)
    invitations.logout(session)
    assert requests.status(secret)['status'] == 'signed_out'
    assert requests.claim(secret, session)['status'] == 'signed_out'
    assert not invitations.authorized(session)
    contents = invitations.path.read_bytes()
    assert secret.encode() not in contents and session.encode() not in contents
    listing = json.dumps(requests.inventory())
    assert 'secret_hash' not in listing and 'session_hash' not in listing


def test_concurrent_submit_decide_claim_and_durable_queue(stores):
    invitations, requests = stores
    secret, session = token(), token()
    with ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(lambda _: requests.submit(secret, 'Test', 'Person'), range(6)))
    assert len({row['id'] for row in results}) == 1
    identity = results[0]['id']
    with ThreadPoolExecutor(max_workers=6) as pool:
        list(pool.map(lambda _: requests.decide(identity, 'approved'), range(6)))
        claims = list(pool.map(lambda _: requests.claim(secret, session), range(6)))
    assert all(row['status'] == 'active' for row in claims)
    assert len(invitations.inventory()) == 1
    with sqlite3.connect(invitations.path) as con:
        assert con.execute('SELECT count(*) FROM access_request_notifications').fetchone()[0] == 1
        assert con.execute('SELECT count(*) FROM admin_audit').fetchone()[0] == 1
        assert con.execute('SELECT count(*) FROM access_sessions').fetchone()[0] == 1
    assert AccessRequests(Invitations(invitations.path)).status(secret)['status'] == 'active'


def test_rejection_conflict_and_wrong_secret(stores):
    invitations, requests = stores
    secret = token()
    request = requests.submit(secret, 'First', 'Last')
    with pytest.raises(RequestConflict):
        requests.submit(secret, 'Other', 'Last')
    requests.decide(request['id'], 'rejected')
    assert requests.decide(request['id'], 'rejected')['status'] == 'rejected'
    with pytest.raises(RequestConflict):
        requests.decide(request['id'], 'approved')
    assert requests.claim(secret, token())['status'] == 'rejected'
    assert requests.status(token()) is None
    assert requests.claim(token(), token()) is None
    assert invitations.inventory() == []


def test_revocation_before_and_after_claim(stores):
    invitations, requests = stores
    for claim_first in (False, True):
        secret, session = token(), token()
        request = requests.submit(secret, 'First', 'Last')
        requests.decide(request['id'], 'approved')
        if claim_first:
            requests.claim(secret, session)
        grant = next(row for row in requests.inventory() if row['id'] == request['id'])['invite_id']
        invitations.admin_revoke(grant)
        assert requests.claim(secret, session)['status'] == 'revoked'
        assert not invitations.authorized(session)


def test_limits_survive_restart_but_allow_retry(stores):
    invitations, requests = stores
    secret = token()
    requests.submit(secret, 'First', 'Last', host='test-host')
    for _ in range(29):
        requests.submit(token(), 'First', 'Last', host='test-host')
    requests = AccessRequests(Invitations(invitations.path))
    with pytest.raises(RequestLimit):
        requests.submit(token(), 'First', 'Last', host='test-host')
    assert requests.submit(secret, 'First', 'Last', host='test-host')['status'] == 'pending'
    assert requests.submit(token(), 'First', 'Last', host='different-host')['status'] == 'pending'


def test_no_overwrite_existing_session_and_input_validation(stores):
    invitations, requests = stores
    _, code = invitations.issue_code()
    existing = invitations.redeem(code)
    secret = token()
    identity = requests.submit(secret, 'First', 'Last')['id']
    requests.decide(identity, 'approved')
    with pytest.raises(RequestConflict):
        requests.claim(secret, existing)
    assert invitations.authorized(existing)
    assert requests.status(secret)['status'] == 'approved'
    with pytest.raises(ValueError):
        requests.claim(secret, secret)
    for first, last, telegram in [('', 'Last', ''), ('First', '\n', ''), ('A' * 81, 'Last', ''), ('First', 'Last', 'https://t.me/example')]:
        with pytest.raises(ValueError):
            requests.submit(token(), first, last, telegram)
    with pytest.raises(ValueError):
        requests.submit('short', 'First', 'Last')
