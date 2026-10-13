"""Delete only records proven by installation-held, high-entropy capabilities.

No matching by unverified name/Telegram. Receipts/tombstones contain hashes only;
they prevent lost-response retries or an old request from recreating a profile.
"""
from contextlib import closing
import json
import os
import ipaddress
import threading
import time

from fastapi import HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .access_requests import AccessRequests, RequestConflict, credential
from .invitations import digest


class Deletion(BaseModel):
    operation_id: str = Field(min_length=43, max_length=128, pattern=r'^[A-Za-z0-9_-]+$')
    credentials: list[str] = Field(min_length=1, max_length=50)


def erase_hashed(con, hashes, *, now=None):
    """Internal transaction helper for proven deletes, retention and restore."""
    hashes = list(hashes)
    request_ids, invite_ids = set(), set()
    for hashed in hashes:
        for row in con.execute('SELECT id,invite_id FROM access_requests WHERE secret_hash=? OR session_hash=?', (hashed, hashed)):
            request_ids.add(row['id'])
            if row['invite_id']:
                invite_ids.add(row['invite_id'])
        for row in con.execute('SELECT id FROM invites WHERE token_hash=?', (hashed,)):
            invite_ids.add(row['id'])
        for row in con.execute('SELECT invite_id FROM deletion_keys WHERE token_hash=?', (hashed,)):
            invite_ids.add(row['invite_id'])
    # Absence is a valid deletion result too: a request may not yet have
    # reached the server. Tombstones stop a delayed submit recreating it.
    # A session also proves the entire associated request/grant, even
    # after the content authorization has been revoked.
    for identity in invite_ids:
        hashes.extend(row[0] for row in con.execute('SELECT token_hash FROM invites WHERE id=?', (identity,)))
        for row in con.execute('SELECT id FROM access_requests WHERE invite_id=?', (identity,)):
            request_ids.add(row['id'])
        for table in ('deletion_keys', 'access_sessions'):
            hashes.extend(row[0] for row in con.execute(f'SELECT token_hash FROM {table} WHERE invite_id=?', (identity,)))
        for table in ('access_sessions', 'deletion_keys', 'invitation_operations', 'admin_audit'):
            con.execute(f'DELETE FROM {table} WHERE invite_id=?', (identity,))
        con.execute('DELETE FROM invites WHERE id=?', (identity,))
    for identity in request_ids:
        row = con.execute('SELECT secret_hash FROM access_requests WHERE id=?', (identity,)).fetchone()
        if row:
            hashes.append(row[0])
        con.execute('DELETE FROM access_request_notifications WHERE request_id=?', (identity,))
        con.execute('DELETE FROM admin_audit WHERE invite_id=?', (identity,))
        con.execute('DELETE FROM access_requests WHERE id=?', (identity,))
    now = time.time() if now is None else now
    con.executemany('INSERT OR IGNORE INTO deleted_credentials (token_hash,created_at) VALUES (?,?)', ((key, now) for key in set(hashes)))
    return {"requests": len(request_ids), "grants": len(invite_ids)}


class AccessDeletion:
    def __init__(self, invitations):
        self.requests = AccessRequests(invitations)

    def delete(self, keys, operation_id):
        credential(operation_id)
        if not 1 <= len(keys) <= 50:
            raise ValueError('Invalid proof count')
        hashes = sorted({credential(key) for key in keys})
        proof = digest(json.dumps(hashes, separators=(',', ':')))
        operation = digest(operation_id)
        with closing(self.requests.db()) as con, con:
            con.execute('PRAGMA secure_delete=ON')
            con.execute('BEGIN IMMEDIATE')
            receipt = con.execute('SELECT proof_hash FROM deletion_receipts WHERE operation_hash=?', (operation,)).fetchone()
            if receipt:
                if receipt[0] != proof:
                    raise RequestConflict('Deletion operation has another proof')
                return {'deleted': True}
            erase_hashed(con, hashes)
            con.execute('INSERT INTO deletion_receipts (operation_hash,proof_hash,created_at) VALUES (?,?,?)', (operation, proof, time.time()))
        return {'deleted': True}


def mount_access_deletion(app, invitations):
    store = AccessDeletion(invitations)
    origin = os.getenv('DAYCHEE_PUBLIC_ORIGIN', '').rstrip('/')
    attempts, lock = {}, threading.Lock()

    @app.middleware('http')
    async def limit_deletion(request, call_next):
        if request.url.path != '/api/access/delete':
            return await call_next(request)
        if request.headers.get('origin') and request.headers['origin'] != origin:
            return JSONResponse({'detail': 'Недопустимый источник запроса.'}, 403, headers={'Cache-Control': 'no-store'})
        host = request.client.host if request.client else 'unknown'
        edge = 'x-real-ip' if os.getenv('RAILWAY_ENVIRONMENT_ID') else 'fly-client-ip' if os.getenv('FLY_APP_NAME') else None
        if edge:
            try:
                host = str(ipaddress.ip_address(request.headers.get(edge, '')))
            except ValueError:
                pass
        now = time.monotonic()
        with lock:
            for key in list(attempts):
                attempts[key] = [stamp for stamp in attempts[key] if stamp > now - 60]
                if not attempts[key]:
                    del attempts[key]
            key = digest(host)
            recent = attempts.setdefault(key, [])
            if len(recent) >= 10 or len(attempts) > 10000:
                return JSONResponse({'detail': 'Слишком много попыток. Повторите позже.'}, 429, headers={'Cache-Control': 'no-store'})
            recent.append(now)
        chunks, size = [], 0
        async for chunk in request.stream():
            size += len(chunk)
            if size > 8192:
                return JSONResponse({'detail': 'Запрос слишком длинный.'}, 413, headers={'Cache-Control': 'no-store'})
            chunks.append(chunk)
        request._body = b''.join(chunks)
        return await call_next(request)

    @app.post('/api/access/delete')
    def delete(body: Deletion):
        try:
            result = store.delete(body.credentials, body.operation_id)
        except RequestConflict:
            raise HTTPException(409, 'Повторите исходный запрос удаления.') from None
        except ValueError:
            raise HTTPException(422, 'Не удалось подтвердить данные на этом телефоне.') from None
        return result
