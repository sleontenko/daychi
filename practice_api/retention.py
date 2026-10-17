"""Opt-in retention for the app's working database and named local backups.

Never deletes active grants. Provider snapshots and Telegram messages are outside
this worker's scope and must be covered by the operator's separate procedure.
"""
from contextlib import closing
from datetime import datetime, timezone
import logging
import os
import re
import sqlite3
import threading
import time

from fastapi import Depends

from .access_requests import AccessRequests
from .access_deletion import erase_hashed

DAY = 86400
BACKUP_NAME = re.compile(r'access-before-(?:admin|requests)-(\d{8}T\d{6}Z)\.sqlite3')


def prune(invitations, *, now=None, backups=None, dry_run=False):
    now = time.time() if now is None else now
    cutoff = now - 90 * DAY
    with closing(AccessRequests(invitations).db()) as con, con:
        con.execute('PRAGMA secure_delete=ON')
        con.execute('BEGIN IMMEDIATE')
        # Legacy timestamps are unknown, so start a grace period instead of
        # inferring that an old record is already eligible for destruction.
        con.execute('UPDATE invites SET inactive_since=? WHERE created_at IS NULL AND activated_at IS NULL AND revoked_at IS NULL AND inactive_since IS NULL', (now,))
        grants = {row['id']: row for row in con.execute('SELECT * FROM invites')}
        active = {row[0] for row in con.execute('SELECT DISTINCT invite_id FROM access_sessions')}
        def is_active(row):
            return row and not row['revoked'] and row['id'] in active and (row['review_expires'] is None or row['review_expires'] > now)
        def latest(row):
            return max((row[key] or 0 for key in ('created_at', 'activated_at', 'revoked_at', 'inactive_since', 'review_expires')), default=0)
        hashes = []
        for row in con.execute('SELECT * FROM access_requests'):
            grant = grants.get(row['invite_id'])
            if not is_active(grant) and max(row['created_at'], row['decided_at'] or 0, latest(grant) if grant else 0) <= cutoff:
                hashes.append(row['secret_hash'])
        for row in grants.values():
            if not is_active(row) and latest(row) <= cutoff:
                hashes.append(row['token_hash'])
        result = erase_hashed(con, hashes, now=now)
        result['deleted_credentials'] = con.execute('DELETE FROM deleted_credentials WHERE created_at<=?', (cutoff,)).rowcount
        result['deletion_receipts'] = con.execute('DELETE FROM deletion_receipts WHERE created_at<=?', (cutoff,)).rowcount
        con.execute('DELETE FROM access_request_limits WHERE created_at<?', (now - 3600,))
        if dry_run:
            # Includes grace timestamps and tombstones: an audit must not
            # change a participant's lifecycle or create deletion evidence.
            con.rollback()
    feedback = invitations.path.with_name('feedback.sqlite3')
    result['feedback_receipts'] = 0
    if feedback.is_file() and not feedback.is_symlink():
        with closing(sqlite3.connect(feedback, timeout=10)) as con, con:
            if con.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='feedback'").fetchone():
                con.execute('PRAGMA secure_delete=ON')
                if dry_run:
                    result['feedback_receipts'] = con.execute('SELECT COUNT(*) FROM feedback WHERE created<?', (now - 30 * DAY,)).fetchone()[0]
                else:
                    result['feedback_receipts'] = con.execute('DELETE FROM feedback WHERE created<?', (now - 30 * DAY,)).rowcount
    result['backups'] = 0
    folder = backups if backups is not None else invitations.path.parent / 'backups'
    if folder.is_dir() and not folder.is_symlink():
        for path in folder.iterdir():
            match = BACKUP_NAME.fullmatch(path.name)
            if not match or not path.is_file() or path.is_symlink():
                continue
            try:
                stamp = datetime.strptime(match[1], '%Y%m%dT%H%M%SZ').replace(tzinfo=timezone.utc).timestamp()
            except ValueError:
                continue
            if stamp <= now - 30 * DAY:
                if not dry_run:
                    path.unlink()
                result['backups'] += 1
    return result


def mount_retention_status(app, invitations, admin_session):
    @app.get('/api/admin/retention', dependencies=[Depends(admin_session)])
    def status():
        # Aggregate counts only; the owner can inspect the exact cleanup
        # scope without exporting databases or opening a remote shell.
        return {'enabled': os.getenv('DAYCHEE_RETENTION_ENABLED') == '1',
                'request_days': 90, 'backup_days': 30, 'deletion_proof_days': 90,
                'pending_cleanup': prune(invitations, dry_run=True),
                'last_run': getattr(app.state, 'retention_last_run', None)}


def mount_retention(app, invitations):
    stop = threading.Event()
    def worker():
        while not stop.is_set():
            try:
                counts = prune(invitations)
                app.state.retention_last_run = {'completed_at': time.time(), 'counts': counts}
            except Exception:
                # Do not log a DB path, query, profile or credential on failure.
                logging.getLogger(__name__).error('Daychee retention failed; operator check required')
            stop.wait(3600)
    @app.on_event('startup')
    def start():
        threading.Thread(target=worker, name='daychee-retention', daemon=True).start()
    @app.on_event('shutdown')
    def shutdown():
        stop.set()
