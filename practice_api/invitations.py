"""Personal one-use invitations. Tokens are stored only as SHA-256 hashes."""
from contextlib import closing
import hashlib
import os
from pathlib import Path
import secrets
import sqlite3
import time


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


class Invitations:
    def __init__(self, path):
        self.path = Path(path)

    def db(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        con = sqlite3.connect(self.path, timeout=10)
        os.chmod(self.path, 0o600)
        con.execute('CREATE TABLE IF NOT EXISTS invites (id TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, expires REAL NOT NULL, used INTEGER NOT NULL DEFAULT 0, revoked INTEGER NOT NULL DEFAULT 0)')
        con.execute('CREATE TABLE IF NOT EXISTS access_sessions (token_hash TEXT PRIMARY KEY, invite_id TEXT NOT NULL)')
        con.commit()
        return con

    def issue(self):
        token, identity = secrets.token_urlsafe(32), secrets.token_hex(16)
        with closing(self.db()) as con, con:
            con.execute('INSERT INTO invites (id, token_hash, expires) VALUES (?,?,?)', (identity, digest(token), time.time() + 7 * 86400))
        return identity, token

    def redeem(self, token):
        # The conditional update and session insertion share one write transaction.
        with closing(self.db()) as con, con:
            con.execute('BEGIN IMMEDIATE')
            row = con.execute('SELECT id FROM invites WHERE token_hash=? AND expires>? AND used=0 AND revoked=0', (digest(token), time.time())).fetchone()
            if not row:
                return None
            session = secrets.token_urlsafe(32)
            con.execute('UPDATE invites SET used=1 WHERE id=?', (row[0],))
            con.execute('INSERT INTO access_sessions VALUES (?,?)', (digest(session), row[0]))
        return session

    def authorized(self, session):
        with closing(self.db()) as con:
            return con.execute('SELECT 1 FROM access_sessions s JOIN invites i ON i.id=s.invite_id WHERE s.token_hash=? AND i.revoked=0', (digest(session),)).fetchone() is not None

    def logout(self, session):
        with closing(self.db()) as con, con:
            con.execute('DELETE FROM access_sessions WHERE token_hash=?', (digest(session),))

    def revoke(self, identity):
        with closing(self.db()) as con, con:
            return con.execute('UPDATE invites SET revoked=1 WHERE id=?', (identity,)).rowcount == 1
