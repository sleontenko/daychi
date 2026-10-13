from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
import secrets
import sqlite3

import pytest

from practice_api.access_deletion import AccessDeletion
from practice_api.access_requests import AccessRequests, RequestConflict
from practice_api.access_restore import restore_candidate
from practice_api.invitations import Invitations
from practice_api.retention import DAY, prune


def key():
    return secrets.token_urlsafe(32)


def test_retention_preserves_active_recent_and_legacy_records(tmp_path):
    invites = Invitations(tmp_path / 'access.db')
    requests = AccessRequests(invites)
    old, active, recent, signed_out = key(), key(), key(), key()
    rows = [requests.submit(token, 'Synthetic', 'Person')['id'] for token in (old, active, recent, signed_out)]
    requests.decide(rows[0], 'rejected')
    requests.decide(rows[1], 'approved')
    requests.claim(active, key())
    requests.decide(rows[3], 'approved')
    session = key()
    requests.claim(signed_out, session)
    invites.logout(session)
    legacy, _ = invites.issue()
    now = __import__('time').time()
    with closing(requests.db()) as con, con:
        con.execute('UPDATE access_requests SET created_at=?,decided_at=?', (now - 100 * DAY, now - 100 * DAY))
        con.execute('UPDATE access_requests SET created_at=? WHERE id=?', (now - DAY, rows[2]))
        con.execute('UPDATE invites SET created_at=?,activated_at=?', (now - 100 * DAY, now - 100 * DAY))
        con.execute('UPDATE invites SET created_at=NULL,activated_at=NULL WHERE id=?', (legacy,))
    result = prune(invites, now=now)
    assert result['requests'] == 1
    assert requests.status(old) is None
    assert requests.status(active)['status'] == 'active'
    assert requests.status(recent) is not None
    assert requests.status(signed_out)['status'] == 'signed_out'  # grace since logout
    assert legacy in [row['id'] for row in invites.inventory()]
    with pytest.raises(RequestConflict):
        requests.submit(old, 'Synthetic', 'Person')
    prune(invites, now=now + 91 * DAY)
    assert requests.status(active)['status'] == 'active'
    assert requests.status(signed_out) is None
    assert legacy not in [row['id'] for row in invites.inventory()]


def test_backup_cleanup_is_scoped_and_feedback_receipts_expire(tmp_path):
    invites = Invitations(tmp_path / 'access.db')
    now = 1800000000
    backups = tmp_path / 'backups'
    backups.mkdir()
    def named(days):
        stamp = datetime.fromtimestamp(now - days * DAY, timezone.utc).strftime('%Y%m%dT%H%M%SZ')
        return backups / f'access-before-admin-{stamp}.sqlite3'
    old, recent = named(31), named(29)
    old.write_bytes(b'fixture'); recent.write_bytes(b'fixture')
    other = backups / 'unrelated.sqlite3'; other.write_bytes(b'keep')
    linked = backups / 'access-before-requests-20200101T000000Z.sqlite3'; linked.symlink_to(other)
    with sqlite3.connect(tmp_path / 'feedback.sqlite3') as con:
        con.execute('CREATE TABLE feedback (created REAL)')
        con.executemany('INSERT INTO feedback VALUES (?)', [(now - 31 * DAY,), (now - DAY,)])
    result = prune(invites, now=now)
    assert result['backups'] == 1 and result['feedback_receipts'] == 1
    assert not old.exists() and recent.exists() and other.exists() and linked.is_symlink()


def test_cleanup_audit_rolls_back_profiles_tombstones_grace_and_keeps_files(tmp_path):
    invites = Invitations(tmp_path / 'access.db')
    requests = AccessRequests(invites)
    own = key()
    row = requests.submit(own, 'Synthetic', 'Audit')['id']
    requests.decide(row, 'rejected')
    legacy, _ = invites.issue()
    now = __import__('time').time()
    with closing(requests.db()) as con, con:
        con.execute('UPDATE access_requests SET created_at=?,decided_at=?', (now - 100 * DAY, now - 100 * DAY))
        con.execute('UPDATE invites SET created_at=NULL,activated_at=NULL,inactive_since=NULL WHERE id=?', (legacy,))
    backups = tmp_path / 'backups'
    backups.mkdir()
    stamp = datetime.fromtimestamp(now - 31 * DAY, timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    backup = backups / f'access-before-admin-{stamp}.sqlite3'
    backup.write_bytes(b'fixture')
    with sqlite3.connect(tmp_path / 'feedback.sqlite3') as con:
        con.execute('CREATE TABLE feedback (created REAL)')
        con.execute('INSERT INTO feedback VALUES (?)', (now - 31 * DAY,))
    report = prune(invites, now=now, dry_run=True)
    assert report == {'requests': 1, 'grants': 0, 'deleted_credentials': 0, 'deletion_receipts': 0, 'feedback_receipts': 1, 'backups': 1}
    assert requests.status(own)['status'] == 'rejected' and backup.exists()
    with closing(requests.db()) as con:
        assert con.execute('SELECT COUNT(*) FROM deleted_credentials').fetchone()[0] == 0
        assert con.execute('SELECT inactive_since FROM invites WHERE id=?', (legacy,)).fetchone()[0] is None
    with sqlite3.connect(tmp_path / 'feedback.sqlite3') as con:
        assert con.execute('SELECT COUNT(*) FROM feedback').fetchone()[0] == 1
    assert prune(invites, now=now) == report


def test_retention_report_requires_owner_authorization(tmp_path):
    from fastapi import FastAPI, Header, HTTPException
    from fastapi.testclient import TestClient
    from practice_api.retention import mount_retention_status
    app = FastAPI()
    def owner(authorization: str = Header(default='')):
        if authorization != 'Bearer owner-fixture':
            raise HTTPException(401)
    mount_retention_status(app, Invitations(tmp_path / 'access.db'), owner)
    with TestClient(app) as client:
        assert client.get('/api/admin/retention').status_code == 401
        assert client.get('/api/admin/retention', headers={'Authorization': 'Bearer participant-fixture'}).status_code == 401
        reply = client.get('/api/admin/retention', headers={'Authorization': 'Bearer owner-fixture'})
        assert reply.status_code == 200
        assert set(reply.json()) == {'enabled', 'request_days', 'backup_days', 'deletion_proof_days', 'pending_cleanup', 'last_run'}
        assert reply.json()['pending_cleanup'] == {'requests': 0, 'grants': 0, 'deleted_credentials': 0, 'deletion_receipts': 0, 'feedback_receipts': 0, 'backups': 0}


def test_restore_applies_latest_deletions_to_older_grants_and_requests(tmp_path):
    live = Invitations(tmp_path / 'live.db')
    requests = AccessRequests(live)
    own, other = key(), key()
    requests.submit(own, 'Delete', 'Person')
    requests.submit(other, 'Keep', 'Person')
    invite_id, code = live.issue()
    backup = tmp_path / 'old.db'
    with closing(sqlite3.connect(live.path)) as source, closing(sqlite3.connect(backup)) as dest:
        source.backup(dest)
    session = live.redeem(code)  # old backup predates session/deletion-key creation
    op = key()
    AccessDeletion(live).delete([own, session], op)
    output = tmp_path / 'candidate.db'
    result = restore_candidate(backup, live.path, output, backup_created_at=__import__('time').time())
    restored = Invitations(output)
    assert result == {'requests': 1, 'grants': 1}
    assert AccessRequests(restored).status(own) is None
    assert AccessRequests(restored).status(other) is not None
    assert not restored.redeem(code)
    assert AccessDeletion(restored).delete([own, session], op) == {'deleted': True}
    assert output.stat().st_mode & 0o777 == 0o600
    with pytest.raises(FileExistsError):
        restore_candidate(backup, live.path, output, backup_created_at=__import__('time').time())
    with pytest.raises(ValueError):
        restore_candidate(backup, backup, tmp_path / 'wrong.db', backup_created_at=__import__('time').time())


def test_proofs_expire_without_retry_extending_their_lifetime(tmp_path):
    invites = Invitations(tmp_path / 'access.db')
    requests = AccessRequests(invites)
    token, op = key(), key()
    requests.submit(token, 'Delete', 'Person')
    deletion = AccessDeletion(invites)
    deletion.delete([token], op)
    now = __import__('time').time()
    with closing(requests.db()) as con, con:
        con.execute('UPDATE deleted_credentials SET created_at=?', (now - 89 * DAY,))
        con.execute('UPDATE deletion_receipts SET created_at=?', (now - 89 * DAY,))
    deletion.delete([token], op)  # lost-response retry, no extension
    deletion.delete([token], key())  # new operation also keeps earliest key date
    audit = prune(invites, now=now + 2 * DAY, dry_run=True)
    assert audit['deleted_credentials'] == 1 and audit['deletion_receipts'] == 1
    with pytest.raises(RequestConflict):
        requests.submit(token, 'Delete', 'Person')
    assert prune(invites, now=now + 2 * DAY) == audit
    with closing(requests.db()) as con:
        assert con.execute('SELECT COUNT(*) FROM deleted_credentials').fetchone()[0] == 0
    # An expired operation is re-evaluated as a fresh proven deletion; it is
    # still safe and idempotent, but no old receipt is asserted or recovered.
    assert deletion.delete([token], op) == {'deleted': True}


def test_restore_rejects_old_or_unverified_capture_time_and_preserves_proof_age(tmp_path):
    live = Invitations(tmp_path / 'live.db')
    requests = AccessRequests(live)
    token, op = key(), key()
    requests.submit(token, 'Delete', 'Person')
    backup = tmp_path / 'backup.db'
    with closing(sqlite3.connect(live.path)) as source, closing(sqlite3.connect(backup)) as target:
        source.backup(target)
    AccessDeletion(live).delete([token], op)
    now = __import__('time').time()
    stamp = now - 10 * DAY
    with closing(requests.db()) as con, con:
        con.execute('UPDATE deleted_credentials SET created_at=?', (stamp,))
        con.execute('UPDATE deletion_receipts SET created_at=?', (stamp,))
    for capture in (now - 30 * DAY, now + 1, float('nan')):
        with pytest.raises(ValueError):
            restore_candidate(backup, live.path, tmp_path / 'invalid.db', backup_created_at=capture, now=now)
        assert not (tmp_path / 'invalid.db').exists()
    output = tmp_path / 'restored.db'
    restore_candidate(backup, live.path, output, backup_created_at=now - 11 * DAY, now=now)
    with sqlite3.connect(output) as con:
        assert con.execute('SELECT created_at FROM deleted_credentials').fetchone()[0] == stamp
        assert con.execute('SELECT created_at FROM deletion_receipts').fetchone()[0] == stamp
    assert AccessRequests(Invitations(output)).status(token) is None


def test_legacy_proof_migration_gets_one_finite_grace_period(tmp_path):
    invites = Invitations(tmp_path / 'legacy.db')
    with sqlite3.connect(invites.path) as con:
        con.execute('CREATE TABLE deleted_credentials (token_hash TEXT PRIMARY KEY)')
        con.execute('CREATE TABLE deletion_receipts (operation_hash TEXT PRIMARY KEY, proof_hash TEXT NOT NULL)')
        con.execute('INSERT INTO deleted_credentials VALUES (?)', ('synthetic-hash',))
        con.execute('INSERT INTO deletion_receipts VALUES (?,?)', ('synthetic-op', 'synthetic-proof'))
    with closing(invites.db()) as con:
        created = con.execute('SELECT created_at FROM deleted_credentials').fetchone()[0]
    with closing(invites.db()) as con:
        assert con.execute('SELECT created_at FROM deleted_credentials').fetchone()[0] == created
    result = prune(invites, now=created + 91 * DAY)
    assert result['deleted_credentials'] == 1 and result['deletion_receipts'] == 1
