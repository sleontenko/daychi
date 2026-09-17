"""Private, device-scoped reminder preferences, kept out of the corpus database."""

from contextlib import contextmanager
from hashlib import sha256
from pathlib import Path
import secrets
import sqlite3
import time

from practice_api.schedule import AttendanceChoice


def digest(value: str) -> str:
    return sha256(value.encode()).hexdigest()


class ReminderStore:
    def __init__(self, path: Path):
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS pairing (
                    hash TEXT PRIMARY KEY, expires REAL NOT NULL
                );
                CREATE TABLE IF NOT EXISTS devices (
                    id TEXT PRIMARY KEY, auth_hash TEXT NOT NULL UNIQUE,
                    push_token TEXT, enabled INTEGER NOT NULL DEFAULT 0
                );
                CREATE TABLE IF NOT EXISTS choices (
                    device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
                    occurrence_id TEXT NOT NULL, minutes_before INTEGER NOT NULL,
                    enabled INTEGER NOT NULL,
                    PRIMARY KEY(device_id, occurrence_id)
                );
                CREATE TABLE IF NOT EXISTS deliveries (
                    device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
                    event_key TEXT NOT NULL, state TEXT NOT NULL,
                    updated REAL NOT NULL,
                    PRIMARY KEY(device_id, event_key)
                );
            """)
        path.chmod(0o600)

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=10)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        try:
            with db:
                yield db
        finally:
            db.close()

    def create_pairing_code(self, now: float | None = None) -> str:
        now = time.time() if now is None else now
        code = secrets.token_urlsafe(24)
        with self.connect() as db:
            db.execute("DELETE FROM pairing WHERE expires <= ?", (now,))
            db.execute("INSERT INTO pairing VALUES (?, ?)", (digest(code), now + 900))
        return code

    def pair(self, code: str, now: float | None = None) -> str | None:
        now = time.time() if now is None else now
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            cursor = db.execute("DELETE FROM pairing WHERE hash=? AND expires>?", (digest(code), now))
            if cursor.rowcount != 1:
                return None
            token = secrets.token_urlsafe(32)
            db.execute("INSERT INTO devices(id,auth_hash) VALUES (?,?)",
                       (secrets.token_hex(16), digest(token)))
            return token

    def authenticate(self, token: str) -> str | None:
        with self.connect() as db:
            row = db.execute("SELECT id FROM devices WHERE auth_hash=?", (digest(token),)).fetchone()
            return row["id"] if row else None

    def set_push(self, device_id: str, token: str | None, enabled: bool):
        with self.connect() as db:
            # One APNs token must never receive duplicates via multiple enrollments.
            if token:
                db.execute("UPDATE devices SET enabled=0,push_token=NULL WHERE push_token=? AND id<>?", (token, device_id))
            db.execute("UPDATE devices SET push_token=?,enabled=? WHERE id=?", (token, enabled, device_id))

    def set_choices(self, device_id: str, choices: list[AttendanceChoice]):
        with self.connect() as db:
            db.execute("DELETE FROM choices WHERE device_id=?", (device_id,))
            for item in {choice.occurrence_id: choice for choice in choices}.values():
                db.execute("INSERT INTO choices VALUES (?,?,?,?)",
                           (device_id, item.occurrence_id, item.minutes_before, item.reminders_enabled))

    def get_choices(self, device_id: str) -> list[AttendanceChoice]:
        with self.connect() as db:
            rows = db.execute("SELECT * FROM choices WHERE device_id=?", (device_id,)).fetchall()
        return [AttendanceChoice(occurrence_id=row["occurrence_id"], minutes_before=row["minutes_before"],
                                 reminders_enabled=bool(row["enabled"])) for row in rows]

    def active_devices(self) -> list[dict]:
        with self.connect() as db:
            return [dict(row) for row in db.execute("SELECT id,push_token FROM devices WHERE enabled=1 AND push_token IS NOT NULL")]

    def claim(self, device_id: str, event_key: str) -> bool:
        """Claim before transport: ambiguous send outcomes are not auto-retried."""
        with self.connect() as db:
            cursor = db.execute("INSERT OR IGNORE INTO deliveries VALUES (?,?,'sending',?)",
                                (device_id, event_key, time.time()))
            return cursor.rowcount == 1

    def claim_active(self, device_id: str, token: str, occurrence_id: str, event_key: str) -> bool:
        """Recheck consent atomically at claim time; opt-out wins before the claim."""
        with self.connect() as db:
            cursor = db.execute("""
                INSERT OR IGNORE INTO deliveries
                SELECT d.id, ?, 'sending', ? FROM devices d JOIN choices c ON c.device_id=d.id
                WHERE d.id=? AND d.enabled=1 AND d.push_token=?
                  AND c.occurrence_id=? AND c.enabled=1
            """, (event_key, time.time(), device_id, token, occurrence_id))
            return cursor.rowcount == 1

    def disable_push_token(self, device_id: str, token: str):
        # A delayed rejection must not disable a newly registered replacement token.
        with self.connect() as db:
            db.execute("UPDATE devices SET enabled=0,push_token=NULL WHERE id=? AND push_token=?",
                       (device_id, token))

    def delivery_result(self, device_id: str, event_key: str, state: str):
        if state not in {"accepted", "rejected", "unknown"}:
            raise ValueError("Invalid delivery state")
        with self.connect() as db:
            db.execute("UPDATE deliveries SET state=?,updated=? WHERE device_id=? AND event_key=?",
                       (state, time.time(), device_id, event_key))

    def revoke(self, device_id: str):
        with self.connect() as db:
            db.execute("DELETE FROM devices WHERE id=?", (device_id,))
