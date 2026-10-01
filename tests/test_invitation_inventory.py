"""Owner inventory migration: preserve old access without fabricating analytics."""
from concurrent.futures import ThreadPoolExecutor
import json
import sqlite3
import time
import pytest
from practice_api.invitations import Invitations, digest


def test_legacy_database_migrates_concurrently_without_changing_access(tmp_path):
    path = tmp_path / 'legacy.db'
    with sqlite3.connect(path) as con:
        con.execute('CREATE TABLE invites (id TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, expires REAL NOT NULL, used INTEGER NOT NULL DEFAULT 0, revoked INTEGER NOT NULL DEFAULT 0)')
        con.execute('CREATE TABLE access_sessions (token_hash TEXT PRIMARY KEY, invite_id TEXT NOT NULL)')
        con.execute('INSERT INTO invites VALUES (?,?,?,?,?)', ('legacy', digest('old-code'), 0, 1, 0))
        con.execute('INSERT INTO access_sessions VALUES (?,?)', (digest('old-session'), 'legacy'))
    store = Invitations(path)
    with ThreadPoolExecutor(max_workers=4) as pool:
        inventories = list(pool.map(lambda _: store.inventory(), range(4)))
    assert all(rows == inventories[0] for rows in inventories)
    assert store.authorized('old-session')
    row = inventories[0][0]
    assert row['status'] == 'active'  # Expired invitation doesn't expire access.
    assert row['created_at'] is row['activated_at'] is row['revoked_at'] is None
    summary = store.summary(since=0)
    assert summary['issued'] == summary['activated'] == 0
    assert summary['active_accesses'] == summary['legacy_activated_unknown'] == 1
    store.revoke('legacy')
    assert not store.authorized('old-session')
    assert store.summary(since=0)['legacy_activated_unknown'] == 1


def test_statuses_counters_and_no_credentials(tmp_path):
    store = Invitations(tmp_path / 'access.db')
    start = time.time() - 1
    pending, code1 = store.issue_code(' Участник А ')
    active, code2 = store.issue_code('Участник Б')
    signed_out, code3 = store.issue_code()
    revoked, code4 = store.issue_code()
    expired, code5 = store.issue_code()
    session = store.redeem(code2)
    store.logout(store.redeem(code3))
    store.revoke(revoked)
    first_revoke = next(r['revoked_at'] for r in store.inventory() if r['id'] == revoked)
    store.revoke(revoked)
    with sqlite3.connect(store.path) as con:
        con.execute('UPDATE invites SET expires=0 WHERE id IN (?,?)', (expired, active))
    rows = store.inventory()
    statuses = {r['id']: r['status'] for r in rows}
    assert statuses == {pending: 'pending', active: 'active', signed_out: 'signed_out', revoked: 'revoked', expired: 'expired'}
    assert next(r['label'] for r in rows if r['id'] == pending) == 'Участник А'
    assert next(r['revoked_at'] for r in rows if r['id'] == revoked) == first_revoke
    assert store.summary(since=start) == {
        'issued': 5, 'activated': 2, 'active_accesses': 1, 'pending': 1, 'expired': 1,
        'legacy_created_unknown': 0, 'legacy_activated_unknown': 0,
    }
    assert store.summary(since=time.time() + 10)['issued'] == 0
    serialized = json.dumps(rows)
    for credential in [code1, code2, code3, code4, code5, session]:
        assert credential not in serialized
        assert digest(credential) not in serialized


@pytest.mark.parametrize('label', ['x' * 81, 'name\nline', 'name\x00', 'name\x7f'])
def test_invalid_label_does_not_issue(tmp_path, label):
    store = Invitations(tmp_path / 'access.db')
    with pytest.raises(ValueError):
        store.issue_code(label)
    assert store.inventory() == []
