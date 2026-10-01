"""Single-owner administration, isolated from participant bearer sessions."""
from contextlib import closing
import hashlib
import hmac
import ipaddress
import os
from pathlib import Path
import secrets
import sqlite3
import time
from urllib.parse import urlsplit
from uuid import UUID

from fastapi import Depends, HTTPException, Request, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

COOKIE = '__Host-daychee_admin'
SESSION_SECONDS = 12 * 3600


def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)
    encoded = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 600_000).hex()
    return f'pbkdf2_sha256$600000${salt}${encoded}'


def password_matches(password, encoded):
    try:
        algorithm, rounds, salt, expected = encoded.split('$')
        if algorithm != 'pbkdf2_sha256' or int(rounds) != 600_000:
            return False
        return hmac.compare_digest(password_hash(password, salt), encoded)
    except (ValueError, TypeError):
        return False


def client_ip(request):
    host = request.client.host if request.client else 'unknown'
    header = 'x-real-ip' if os.getenv('RAILWAY_ENVIRONMENT_ID') else None
    if header:
        try:
            return str(ipaddress.ip_address(request.headers.get(header, '')))
        except ValueError:
            pass
    return host


class Login(BaseModel):
    password: str = Field(min_length=1, max_length=256)


class CreateInvitation(BaseModel):
    label: str = Field(default='', max_length=80)
    operation_id: UUID


def mount_admin(app, store, *, origin=None, encoded_password=None):
    origin = (origin if origin is not None else os.getenv('DAYCHEE_PUBLIC_ORIGIN', '')).rstrip('/')
    encoded_password = encoded_password if encoded_password is not None else os.getenv('DAYCHEE_ADMIN_PASSWORD_HASH', '')
    parts = urlsplit(origin)
    configured = bool(encoded_password and parts.scheme == 'https' and parts.netloc and not parts.path and not parts.query and not parts.fragment and not parts.username)
    generation = hashlib.sha256(encoded_password.encode()).hexdigest()
    path = store.path.with_name('admin.sqlite3')

    def db():
        path.parent.mkdir(parents=True, exist_ok=True)
        con = sqlite3.connect(path, timeout=10)
        os.chmod(path, 0o600)
        con.execute('CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, csrf TEXT NOT NULL, expires REAL NOT NULL, generation TEXT NOT NULL)')
        con.execute('CREATE TABLE IF NOT EXISTS attempts (ip_hash TEXT NOT NULL, at REAL NOT NULL)')
        con.commit()
        return con

    def require_config():
        if not configured:
            raise HTTPException(503, 'Вход организатора ещё не настроен.')

    def same_origin(request: Request):
        require_config()
        if request.headers.get('origin') != origin:
            raise HTTPException(403, 'Откройте админку на её основном адресе.')
        if request.headers.get('sec-fetch-site', 'same-origin') not in ('same-origin', 'none'):
            raise HTTPException(403, 'Недопустимый источник запроса.')

    def session(request: Request):
        require_config()
        token = request.cookies.get(COOKIE, '')
        if not token or len(token) > 128:
            raise HTTPException(401, 'Войдите как организатор.')
        with closing(db()) as con:
            row = con.execute('SELECT csrf,expires FROM sessions WHERE hash=? AND generation=?',
                              (hashlib.sha256(token.encode()).hexdigest(), generation)).fetchone()
        if not row or row[1] <= time.time():
            raise HTTPException(401, 'Сессия завершилась. Войдите снова.')
        return {'csrf': row[0], 'expires': row[1]}

    def mutation(request: Request, current=Depends(session)):
        same_origin(request)
        if not hmac.compare_digest(request.headers.get('x-csrf-token', ''), current['csrf']):
            raise HTTPException(403, 'Обновите страницу и повторите действие.')
        return current

    static = Path(__file__).with_name('admin_web')
    headers = {'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow',
               'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
               'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"}

    @app.get('/admin', include_in_schema=False)
    def page():
        return FileResponse(static / 'index.html', headers=headers)

    @app.get('/admin-assets/{name}', include_in_schema=False)
    def asset(name: str):
        if name not in ('admin.css', 'admin.js'):
            raise HTTPException(404)
        return FileResponse(static / name, headers=headers)

    @app.post('/api/admin/login', dependencies=[Depends(same_origin)])
    def login(body: Login, request: Request, response: Response):
        now = time.time()
        ip_hash = hashlib.sha256(client_ip(request).encode()).hexdigest()
        with closing(db()) as con, con:
            con.execute('BEGIN IMMEDIATE')
            con.execute('DELETE FROM attempts WHERE at < ?', (now - 900,))
            count = con.execute('SELECT count(*) FROM attempts WHERE ip_hash=?', (ip_hash,)).fetchone()[0]
            total = con.execute('SELECT count(*) FROM attempts').fetchone()[0]
            if count >= 8 or total >= 60:
                raise HTTPException(429, 'Слишком много попыток. Подождите 15 минут.', headers={'Retry-After': '900'})
            con.execute('INSERT INTO attempts VALUES (?,?)', (ip_hash, now))
        if not password_matches(body.password, encoded_password):
            raise HTTPException(401, 'Пароль не подошёл.')
        token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
        with closing(db()) as con, con:
            con.execute('DELETE FROM sessions WHERE expires <= ? OR generation != ?', (now, generation))
            old = request.cookies.get(COOKIE, '')
            con.execute('DELETE FROM sessions WHERE hash=?', (hashlib.sha256(old.encode()).hexdigest(),))
            con.execute('INSERT INTO sessions VALUES (?,?,?,?)',
                        (hashlib.sha256(token.encode()).hexdigest(), csrf, now + SESSION_SECONDS, generation))
        response.set_cookie(COOKIE, token, max_age=SESSION_SECONDS, secure=True, httponly=True, samesite='strict', path='/')
        return {'csrf': csrf, 'expires': now + SESSION_SECONDS}

    @app.get('/api/admin/session')
    def current_session(current=Depends(session)):
        return current

    @app.post('/api/admin/logout', dependencies=[Depends(mutation)])
    def logout(request: Request, response: Response):
        with closing(db()) as con, con:
            con.execute('DELETE FROM sessions WHERE hash=?', (hashlib.sha256(request.cookies[COOKIE].encode()).hexdigest(),))
        response.delete_cookie(COOKIE, path='/', secure=True, httponly=True, samesite='strict')
        return {'ok': True}

    @app.get('/api/admin/invitations', dependencies=[Depends(session)])
    def inventory():
        return {'items': store.inventory(), 'summary': store.summary(since=time.time() - 30 * 86400),
                'service': {'api': 'ok', 'backup': 'not_configured'}}

    @app.post('/api/admin/invitations', dependencies=[Depends(mutation)])
    def create(body: CreateInvitation):
        try:
            identity, code = store.admin_issue(body.label, str(body.operation_id))
        except ValueError:
            raise HTTPException(409, 'Проверьте метку. Не меняйте её при повторе той же операции.') from None
        return {'id': identity, 'code': code, 'url': f'{origin}/invite#{code}' if code else None,
                'already_created': code is None}

    @app.post('/api/admin/invitations/{identity}/revoke', dependencies=[Depends(mutation)])
    def revoke(identity: str):
        if len(identity) != 32 or any(c not in '0123456789abcdef' for c in identity) or not store.admin_revoke(identity):
            raise HTTPException(404, 'Приглашение не найдено.')
        return {'ok': True}

    return session, mutation
