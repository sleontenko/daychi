"""Isolated, password-protected wiki API. Run with one worker behind HTTPS."""
from collections import Counter
from contextlib import closing
from dataclasses import dataclass
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import secrets
import sqlite3
import threading
import time
from urllib.parse import urlsplit

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .wiki_graph import mount_wiki_graph
from .public_wiki import mount_public_wiki
from .wiki_content import ContentStore


@dataclass
class WikiSettings:
    index: Path
    database: Path
    username: str
    password: str
    origins: tuple[str, ...] = ()
    session_seconds: int = 30 * 86400

    @classmethod
    def from_env(cls):
        return cls(Path(os.getenv('WIKI_INDEX', 'data/nikita-archive/2026-09-19/index.json')),
                   Path(os.getenv('WIKI_DATABASE', 'data/wiki.sqlite3')),
                   os.getenv('WIKI_USERNAME', ''), os.getenv('WIKI_PASSWORD', ''),
                   tuple(filter(None, os.getenv('WIKI_ORIGINS', '').split(','))))


def fold(text):
    return ' '.join(str(text).casefold().replace('ё', 'е').split())


def clean(text):
    return re.sub(r'код\s*доступа\s*:?\s*\S+', '', re.sub(r'https?://\S+', '', text), flags=re.I).strip(' :–—-')


class Login(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=256)


def create_wiki_app(settings=None, access_authorizer=None):
    cfg = settings or WikiSettings.from_env()
    app = FastAPI(title='Daychi Wiki', docs_url=None, redoc_url=None, openapi_url=None)
    app.add_middleware(CORSMiddleware, allow_origins=list(cfg.origins),
                       allow_methods=['GET', 'POST'], allow_headers=['Authorization', 'Content-Type'])
    lock = threading.Lock()
    attempts = {}
    catalog = None
    version = None
    content = ContentStore(cfg.database.with_name('wiki-content.sqlite3'))
    app.state.wiki_content = content
    generation = hashlib.sha256((cfg.username + '\0' + cfg.password).encode()).hexdigest()

    def db():
        cfg.database.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(cfg.database)
        os.chmod(cfg.database, 0o600)
        connection.execute('CREATE TABLE IF NOT EXISTS identities (source TEXT PRIMARY KEY, id TEXT NOT NULL)')
        connection.execute('CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, expires REAL, generation TEXT)')
        return connection

    def load():
        nonlocal catalog, version
        with lock:
            try:
                stamp = cfg.index.stat().st_mtime_ns
                if catalog is not None and stamp == version:
                    return catalog
                raw = json.loads(cfg.index.read_text())
                if not isinstance(raw, list) or not raw:
                    raise ValueError('Empty index')
                result = []
                timestamps = Counter(r['source_timestamp_ms'] for r in raw)
                with closing(db()) as con, con:
                    for row in raw:
                        source = row['id']
                        # Unique publication timestamps survive edits to title and URLs.
                        if source.startswith('nikita:base:') and timestamps[row['source_timestamp_ms']] == 1:
                            source = 'publication:' + str(row['source_timestamp_ms'])
                        identity = con.execute('SELECT id FROM identities WHERE source IN (?,?) ORDER BY source LIMIT 1', (source, row['id'])).fetchone()
                        material_id = identity[0] if identity else secrets.token_hex(16)
                        con.execute('INSERT OR IGNORE INTO identities VALUES (?,?)', (source, material_id))
                        con.execute('INSERT OR IGNORE INTO identities VALUES (?,?)', (row['id'], material_id))
                        links = []
                        for link in row['links']:
                            if urlsplit(link['url']).scheme not in ('https', 'http'):
                                raise ValueError('Invalid link')
                            links.append({k: link[k] for k in ('url', 'label', 'type')})
                        match = re.search(r'код\s*доступа\s*:?\s*(\S+)', row['source_text'], re.I)
                        result.append({'id': material_id, 'title': clean(row['title']),
                            'date': row['source_date_label'], 'timestamp': row['source_timestamp_ms'],
                            'category': row['category_id'], 'category_name': row['category_name'],
                            'subtopic': row['subtopic'], 'subtopic_key': row['subtopic_key'],
                            'description': clean(row['source_text']), 'links': links,
                            'zoom_password': match[1] if match and any(l['type'] == 'zoom' for l in links) else None})
                if len({r['id'] for r in result}) != len(result):
                    raise ValueError('Duplicate identity')
                catalog, version = result, stamp
            except (OSError, ValueError, KeyError, TypeError):
                if catalog is None:
                    raise HTTPException(503, 'Каталог временно недоступен') from None
            return catalog

    def authorize(authorization: str = Header(default='')):
        if not cfg.username or not cfg.password:
            raise HTTPException(503, 'Вики ещё не подключена')
        token = authorization.removeprefix('Bearer ')
        with closing(db()) as con:
            session = con.execute('SELECT expires,generation FROM sessions WHERE hash=?',
                                  (hashlib.sha256(token.encode()).hexdigest(),)).fetchone()
        if not authorization.startswith('Bearer ') or not session or session[0] <= time.time() or session[1] != generation:
            raise HTTPException(401, 'Войдите в вики')
        return token

    if access_authorizer is not None:
        authorize = access_authorizer

    @app.exception_handler(RequestValidationError)
    async def invalid_request(request, exc):
        return JSONResponse(status_code=422, content={'detail': 'Некорректный запрос'})

    @app.middleware('http')
    async def private_responses(request, call_next):
        response = await call_next(request)
        response.headers['Cache-Control'] = 'no-store'
        return response

    @app.post('/api/wiki/login')
    def login(body: Login, request: Request):
        if access_authorizer is not None:
            raise HTTPException(410, 'Вход по паролю больше не используется')
        if not cfg.username or not cfg.password:
            raise HTTPException(503, 'Вики ещё не подключена')
        host = request.client.host if request.client else 'unknown'
        now = time.time()
        with lock:
            for key in list(attempts):
                attempts[key] = [t for t in attempts[key] if t > now - 600]
                if not attempts[key]:
                    del attempts[key]
            recent = attempts.setdefault(host, [])
            if len(recent) >= 10:
                raise HTTPException(429, 'Слишком много попыток. Попробуйте через 10 минут.')
            recent.append(now)
        if not (hmac.compare_digest(body.username.encode(), cfg.username.encode()) &
                hmac.compare_digest(body.password.encode(), cfg.password.encode())):
            raise HTTPException(401, 'Неверный логин или пароль')
        token = secrets.token_urlsafe(32)
        with closing(db()) as con, con:
            con.execute('DELETE FROM sessions WHERE expires <= ? OR generation != ?', (now, generation))
            con.execute('INSERT INTO sessions VALUES (?,?,?)',
                        (hashlib.sha256(token.encode()).hexdigest(), now + cfg.session_seconds, generation))
        return {'token': token}

    @app.post('/api/wiki/logout')
    def logout(token=Depends(authorize)):
        if access_authorizer is not None:
            raise HTTPException(410, 'Используйте выход из персонального доступа')
        with closing(db()) as con, con:
            con.execute('DELETE FROM sessions WHERE hash=?', (hashlib.sha256(token.encode()).hexdigest(),))
        return {'ok': True}

    @app.get('/api/wiki/categories', dependencies=[Depends(authorize)])
    def categories():
        rows = load()
        result = []
        for category in dict.fromkeys(r['category'] for r in rows):
            members = [r for r in rows if r['category'] == category]
            subs = Counter((r['subtopic_key'], r['subtopic']) for r in members if r['subtopic_key'])
            result.append({'id': category, 'name': members[0]['category_name'], 'count': len(members),
                           'subtopics': [{'id': k, 'name': n, 'count': v} for (k, n), v in sorted(subs.items())]})
        return result

    @app.get('/api/wiki/materials', dependencies=[Depends(authorize)])
    def materials(q: str = Query('', max_length=300), category: str = '', subtopic: str = '',
                  sort: str = Query('new', pattern='^(new|old)$'), ids: str = Query('', max_length=40000),
                  limit: int = Query(40, ge=1, le=100), offset: int = Query(0, ge=0)):
        tokens = fold(q).split()
        wanted = set(ids.split(',')) if ids else None
        rows = [r for r in load() if (not category or r['category'] == category)
                and (not subtopic or r['subtopic_key'] == subtopic) and (wanted is None or r['id'] in wanted)]
        def score(r):
            title = fold(r['title'])
            text = fold(' '.join([r['title'], r['description'], r['category_name'], r['subtopic']]))
            return sum(3 if t in title else 1 for t in tokens if t in text) if all(t in text for t in tokens) else -1
        rows = [r for r in rows if score(r) >= 0]
        rows.sort(key=lambda r: (-score(r), r['timestamp'] if sort == 'old' else -r['timestamp'], r['id']))
        fields = ('id', 'title', 'date', 'category_name', 'subtopic')
        missing = sorted(wanted - {r['id'] for r in load()}) if wanted and wanted != {'none'} else []
        return {'total': len(rows), 'missing_ids': missing, 'items': [{k: r[k] for k in fields} for r in rows[offset:offset + limit]]}

    @app.get('/api/wiki/materials/{material_id}', dependencies=[Depends(authorize)])
    def material(material_id: str):
        for row in load():
            if row['id'] == material_id:
                annotation = content.get(material_id, row['links'])
                return {**row, 'annotation': annotation} if annotation else row
        raise HTTPException(404, 'Материал больше не доступен')

    app.state.wiki_catalog = load
    mount_public_wiki(app, load, content, enabled=os.getenv('DAYCHEE_PUBLIC_WIKI_ENABLED') == '1')
    mount_wiki_graph(app, load, authorize)
    return app


app = create_wiki_app()
