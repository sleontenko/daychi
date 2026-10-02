"""Personal one-use invitations. Tokens are stored only as SHA-256 hashes."""
from contextlib import closing
import hashlib
import os
from pathlib import Path
import secrets
import re
import sqlite3
import time

CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'


def normalize_code(value):
    code = re.sub(r'[\s-]', '', value).upper()
    return code if len(code) == 12 and all(c in CODE_ALPHABET for c in code) else None


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


class Invitations:
    def __init__(self, path):
        self.path = Path(path)

    def db(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        con = sqlite3.connect(self.path, timeout=10)
        os.chmod(self.path, 0o600)
        # Serialize additive migrations, including concurrent first requests.
        con.execute('BEGIN IMMEDIATE')
        con.execute('CREATE TABLE IF NOT EXISTS invites (id TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, expires REAL NOT NULL, used INTEGER NOT NULL DEFAULT 0, revoked INTEGER NOT NULL DEFAULT 0)')
        con.execute('CREATE TABLE IF NOT EXISTS access_sessions (token_hash TEXT PRIMARY KEY, invite_id TEXT NOT NULL)')
        # A deletion-only capability survives logout/revocation. It never grants
        # content access. Migrate existing sessions before any can be removed.
        con.execute('CREATE TABLE IF NOT EXISTS deletion_keys (token_hash TEXT PRIMARY KEY, invite_id TEXT NOT NULL)')
        con.execute('INSERT OR IGNORE INTO deletion_keys SELECT token_hash,invite_id FROM access_sessions')
        con.execute('CREATE TABLE IF NOT EXISTS deleted_credentials (token_hash TEXT PRIMARY KEY)')
        con.execute('CREATE TABLE IF NOT EXISTS deletion_receipts (operation_hash TEXT PRIMARY KEY, proof_hash TEXT NOT NULL)')
        con.execute('CREATE TABLE IF NOT EXISTS invitation_operations (id TEXT PRIMARY KEY, invite_id TEXT NOT NULL, label TEXT NOT NULL)')
        con.execute('CREATE TABLE IF NOT EXISTS admin_audit (id INTEGER PRIMARY KEY, action TEXT NOT NULL, invite_id TEXT NOT NULL, created_at REAL NOT NULL)')
        columns = {row[1] for row in con.execute('PRAGMA table_info(invites)')}
        for name, definition in (
            ('label', "TEXT NOT NULL DEFAULT ''"),
            ('created_at', 'REAL'), ('activated_at', 'REAL'), ('revoked_at', 'REAL'),
        ):
            if name not in columns:
                con.execute(f'ALTER TABLE invites ADD COLUMN {name} {definition}')
        con.commit()
        return con

    def issue(self):
        return self._issue(secrets.token_urlsafe(32))

    def issue_code(self, label=''):
        # Almost 60 random bits; no ambiguous 0/O/1/I. Same atomic one-use store.
        return self._issue(''.join(secrets.choice(CODE_ALPHABET) for _ in range(12)), label)

    def _issue(self, token, label=''):
        label = label.strip()
        if len(label) > 80 or any(ord(c) < 32 or ord(c) == 127 for c in label):
            raise ValueError('Invitation label must be at most 80 characters without control characters')
        identity = secrets.token_hex(16)
        now = time.time()
        with closing(self.db()) as con, con:
            con.execute('INSERT INTO invites (id, token_hash, expires, label, created_at) VALUES (?,?,?,?,?)', (identity, digest(token), now + 7 * 86400, label, now))
        return identity, token

    def redeem(self, token):
        # The conditional update and session insertion share one write transaction.
        with closing(self.db()) as con, con:
            con.execute('BEGIN IMMEDIATE')
            row = con.execute('SELECT id FROM invites WHERE token_hash=? AND expires>? AND used=0 AND revoked=0', (digest(token), time.time())).fetchone()
            if not row:
                return None
            session = secrets.token_urlsafe(32)
            con.execute('UPDATE invites SET used=1, activated_at=? WHERE id=?', (time.time(), row[0]))
            con.execute('INSERT INTO access_sessions VALUES (?,?)', (digest(session), row[0]))
            con.execute('INSERT INTO deletion_keys VALUES (?,?)', (digest(session), row[0]))
        return session

    def admin_issue(self, label, operation_id):
        label = label.strip()
        if len(label) > 80 or any(ord(c) < 32 or ord(c) == 127 for c in label):
            raise ValueError('Invalid label')
        with closing(self.db()) as con, con:
            con.execute('BEGIN IMMEDIATE')
            existing = con.execute('SELECT invite_id, label FROM invitation_operations WHERE id=?', (operation_id,)).fetchone()
            if existing:
                if existing[1] != label:
                    raise ValueError('Operation already used with a different label')
                return existing[0], None
            identity = secrets.token_hex(16)
            code = ''.join(secrets.choice(CODE_ALPHABET) for _ in range(12))
            now = time.time()
            con.execute('INSERT INTO invites (id,token_hash,expires,label,created_at) VALUES (?,?,?,?,?)',
                        (identity, digest(code), now + 7 * 86400, label, now))
            con.execute('INSERT INTO invitation_operations VALUES (?,?,?)', (operation_id, identity, label))
            con.execute('INSERT INTO admin_audit(action,invite_id,created_at) VALUES (?,?,?)', ('issue', identity, now))
            return identity, code

    def admin_revoke(self, identity):
        with closing(self.db()) as con, con:
            con.execute('BEGIN IMMEDIATE')
            row = con.execute('SELECT revoked FROM invites WHERE id=?', (identity,)).fetchone()
            if row is None:
                return False
            if not row[0]:
                now = time.time()
                con.execute('UPDATE invites SET revoked=1,revoked_at=? WHERE id=?', (now, identity))
                con.execute('INSERT INTO admin_audit(action,invite_id,created_at) VALUES (?,?,?)', ('revoke', identity, now))
            return True

    def authorized(self, session):
        with closing(self.db()) as con:
            return con.execute('SELECT 1 FROM access_sessions s JOIN invites i ON i.id=s.invite_id WHERE s.token_hash=? AND i.revoked=0', (digest(session),)).fetchone() is not None

    def rejection_reason(self, credential):
        """Called only after a rate-limited redemption failed; expose no identity."""
        with closing(self.db()) as con:
            row = con.execute('SELECT expires, used, revoked FROM invites WHERE token_hash=?', (digest(credential),)).fetchone()
        if row is None: return 'invalid'
        if row[2]: return 'revoked'
        if row[1]: return 'used'
        if row[0] <= time.time(): return 'expired'
        return 'invalid'

    def logout(self, session):
        with closing(self.db()) as con, con:
            con.execute('DELETE FROM access_sessions WHERE token_hash=?', (digest(session),))

    def revoke(self, identity):
        with closing(self.db()) as con, con:
            return con.execute('UPDATE invites SET revoked=1, revoked_at=COALESCE(revoked_at, ?) WHERE id=?', (time.time(), identity)).rowcount == 1

    def inventory(self, *, now=None):
        """Owner-side data only; callers must enforce separate admin authorization.

        Never returns credentials/hashes. Legacy timestamps remain unknown.
        No public HTTP route exposes this method.
        """
        now = time.time() if now is None else now
        with closing(self.db()) as con:
            con.row_factory = sqlite3.Row
            rows = con.execute('''SELECT id, label, expires, used, revoked,
                created_at, activated_at, revoked_at,
                EXISTS(SELECT 1 FROM access_sessions s WHERE s.invite_id=i.id) AS has_session
                FROM invites i ORDER BY created_at DESC, id''').fetchall()
        result = []
        for row in rows:
            status = ('revoked' if row['revoked'] else
                      'active' if row['used'] and row['has_session'] else
                      'signed_out' if row['used'] else
                      'expired' if row['expires'] <= now else 'pending')
            result.append({key: row[key] for key in (
                'id', 'label', 'expires', 'created_at', 'activated_at', 'revoked_at'
            )} | {'status': status, 'was_activated': bool(row['used'])})
        return result

    def summary(self, *, since, now=None):
        now = time.time() if now is None else now
        rows = self.inventory(now=now)
        return {
            'issued': sum(r['created_at'] is not None and since <= r['created_at'] <= now for r in rows),
            'activated': sum(r['activated_at'] is not None and since <= r['activated_at'] <= now for r in rows),
            'active_accesses': sum(r['status'] == 'active' for r in rows),
            'pending': sum(r['status'] == 'pending' for r in rows),
            'expired': sum(r['status'] == 'expired' for r in rows),
            'legacy_created_unknown': sum(r['created_at'] is None for r in rows),
            'legacy_activated_unknown': sum(r['activated_at'] is None and r['was_activated'] for r in rows),
        }
