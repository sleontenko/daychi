"""Device-bound access requests. UI integration follows design approval.

Request secrets and client-generated session tokens must be generated from at
least 32 random bytes and persisted by the client BEFORE submitting a request.
Only hashes enter SQLite. Approval never returns an invitation credential.
"""
from contextlib import closing
import hmac
import re
import secrets
import sqlite3
import time

from .invitations import digest


class RequestConflict(ValueError):
    pass


class RequestLimit(ValueError):
    pass


def credential(value):
    if not isinstance(value, str) or not re.fullmatch(r'[A-Za-z0-9_-]{43,128}', value):
        raise ValueError('Invalid device credential')
    return digest(value)


def profile(first_name, last_name, telegram):
    names = [value.strip() for value in (first_name, last_name)]
    if any(not value or len(value) > 80 or any(ord(c) < 32 or ord(c) == 127 for c in value) for value in names):
        raise ValueError('Name required; maximum 80 characters per field')
    telegram = telegram.strip().removeprefix('@')
    if telegram and not re.fullmatch(r'[A-Za-z][A-Za-z0-9_]{3,31}', telegram):
        raise ValueError('Enter a Telegram username, not a link')
    return (*names, telegram)


class AccessRequests:
    def __init__(self, invitations):
        self.invitations = invitations

    def db(self):
        con = self.invitations.db()
        with con:
            con.execute('''CREATE TABLE IF NOT EXISTS access_requests (
                id TEXT PRIMARY KEY, secret_hash TEXT UNIQUE NOT NULL,
                first_name TEXT NOT NULL, last_name TEXT NOT NULL,
                telegram TEXT NOT NULL, created_at REAL NOT NULL,
                decided_at REAL, status TEXT NOT NULL DEFAULT 'pending',
                invite_id TEXT, session_hash TEXT)''')
            con.execute('''CREATE TABLE IF NOT EXISTS access_request_limits (
                host_hash TEXT NOT NULL, created_at REAL NOT NULL)''')
            con.execute('''CREATE TABLE IF NOT EXISTS access_request_notifications (
                request_id TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'pending',
                attempts INTEGER NOT NULL DEFAULT 0, next_attempt REAL NOT NULL)''')
        con.row_factory = sqlite3.Row
        return con

    @staticmethod
    def state(con, row):
        status = row['status']
        if status == 'approved':
            invite = con.execute('SELECT revoked FROM invites WHERE id=?', (row['invite_id'],)).fetchone()
            if not invite or invite['revoked']:
                status = 'revoked'
            elif row['session_hash']:
                exists = con.execute('SELECT 1 FROM access_sessions WHERE token_hash=? AND invite_id=?',
                                     (row['session_hash'], row['invite_id'])).fetchone()
                status = 'active' if exists else 'signed_out'
        return {'id': row['id'], 'status': status}

    def submit(self, secret, first_name, last_name, telegram='', *, host='unknown'):
        hashed = credential(secret)
        fields = profile(first_name, last_name, telegram)
        now = time.time()
        with closing(self.db()) as con, con:
            con.execute('BEGIN IMMEDIATE')
            if con.execute('SELECT 1 FROM deleted_credentials WHERE token_hash=?', (hashed,)).fetchone():
                raise RequestConflict('Deleted request cannot be resubmitted')
            row = con.execute('SELECT * FROM access_requests WHERE secret_hash=?', (hashed,)).fetchone()
            if row:
                if tuple(row[key] for key in ('first_name', 'last_name', 'telegram')) != fields:
                    raise RequestConflict('Request already exists with another profile')
                return self.state(con, row)
            con.execute('DELETE FROM access_request_limits WHERE created_at<?', (now - 3600,))
            total, same_host = con.execute('SELECT count(*), coalesce(sum(host_hash=?),0) FROM access_request_limits', (digest(host),)).fetchone()
            if total >= 300 or same_host >= 30:
                raise RequestLimit('Too many new requests; try later')
            identity = secrets.token_hex(16)
            con.execute('INSERT INTO access_requests (id,secret_hash,first_name,last_name,telegram,created_at) VALUES (?,?,?,?,?,?)',
                        (identity, hashed, *fields, now))
            con.execute('INSERT INTO access_request_limits VALUES (?,?)', (digest(host), now))
            con.execute('INSERT INTO access_request_notifications (request_id,next_attempt) VALUES (?,?)', (identity, now))
            return {'id': identity, 'status': 'pending'}

    def status(self, secret):
        hashed = credential(secret)
        with closing(self.db()) as con:
            row = con.execute('SELECT * FROM access_requests WHERE secret_hash=?', (hashed,)).fetchone()
            return self.state(con, row) if row else None

    def inventory(self):
        """Only expose behind the existing ADMIN authorization, never publicly."""
        with closing(self.db()) as con:
            rows = con.execute('''SELECT r.*, n.status AS notification_status
                FROM access_requests r LEFT JOIN access_request_notifications n ON n.request_id=r.id
                ORDER BY r.created_at DESC,r.id''').fetchall()
            return [self.state(con, row) | {key: row[key] for key in
                    ('first_name', 'last_name', 'telegram', 'created_at', 'decided_at', 'invite_id', 'notification_status')}
                    for row in rows]

    def decide(self, identity, decision):
        if decision not in ('approved', 'rejected'):
            raise ValueError('Invalid decision')
        with closing(self.db()) as con, con:
            con.execute('BEGIN IMMEDIATE')
            row = con.execute('SELECT * FROM access_requests WHERE id=?', (identity,)).fetchone()
            if not row:
                return None
            if row['status'] != 'pending':
                if row['status'] != decision:
                    raise RequestConflict('Request already decided')
                return self.state(con, row)
            now = time.time()
            invite_id = None
            if decision == 'approved':
                invite_id = secrets.token_hex(16)
                # An already-used, non-redeemable grant keeps existing session
                # authorization and revocation working for old and new clients.
                label = (row['first_name'] + ' ' + row['last_name'])[:80]
                con.execute('INSERT INTO invites (id,token_hash,expires,used,label,created_at) VALUES (?,?,?,1,?,?)',
                            (invite_id, digest(secrets.token_urlsafe(32)), now, label, now))
            con.execute('UPDATE access_requests SET status=?,decided_at=?,invite_id=? WHERE id=?',
                        (decision, now, invite_id, identity))
            con.execute('INSERT INTO admin_audit(action,invite_id,created_at) VALUES (?,?,?)',
                        ('request_' + decision, invite_id or identity, now))
            return {'id': identity, 'status': decision}

    def claim(self, secret, session_token):
        hashed, session_hash = credential(secret), credential(session_token)
        if hmac.compare_digest(hashed, session_hash):
            raise ValueError('Session must use a separate credential')
        with closing(self.db()) as con, con:
            con.execute('BEGIN IMMEDIATE')
            row = con.execute('SELECT * FROM access_requests WHERE secret_hash=?', (hashed,)).fetchone()
            if not row:
                return None
            state = self.state(con, row)
            if state['status'] not in ('approved', 'active'):
                return state
            if row['session_hash']:
                if not hmac.compare_digest(row['session_hash'], session_hash):
                    raise RequestConflict('Access already claimed by another session')
                return state
            # A collision/attempt to reuse an existing participant credential
            # cannot attach or overwrite that participant's authorization.
            try:
                con.execute('INSERT INTO access_sessions VALUES (?,?)', (session_hash, row['invite_id']))
                con.execute('INSERT INTO deletion_keys VALUES (?,?)', (session_hash, row['invite_id']))
            except sqlite3.IntegrityError:
                raise RequestConflict('Session credential already in use') from None
            con.execute('UPDATE access_requests SET session_hash=? WHERE id=?', (session_hash, row['id']))
            con.execute('UPDATE invites SET activated_at=? WHERE id=?', (time.time(), row['invite_id']))
            return {'id': row['id'], 'status': 'active'}
