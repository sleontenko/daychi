"""Versioned, source-bound wiki enrichment; private content never ships in images."""
from contextlib import closing
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import time
from urllib.parse import parse_qs, urlsplit

from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field


def youtube_id(url):
    u = urlsplit(url)
    host = (u.hostname or '').lower()
    value = u.path.strip('/') if host == 'youtu.be' else (
        parse_qs(u.query).get('v', [''])[0] if host in ('youtube.com','www.youtube.com','m.youtube.com') else '')
    return value if re.fullmatch(r'[A-Za-z0-9_-]{11}', value) else None


class Point(BaseModel):
    text: str = Field(min_length=10, max_length=1500)
    start_seconds: float = Field(ge=0, le=100000)
    end_seconds: float = Field(gt=0, le=100000)


class Enrichment(BaseModel):
    resource_id: str = Field(pattern=r'^[A-Za-z0-9_-]{11}$')
    expected_title: str = Field(min_length=1, max_length=1000)
    revision: int = Field(ge=1, le=100000)
    summary: str = Field(min_length=30, max_length=3000)
    points: list[Point] = Field(min_length=2, max_length=8)
    transcript_sha256: str = Field(pattern=r'^[0-9a-f]{64}$')
    subtitles_sha256: str = Field(pattern=r'^[0-9a-f]{64}$')
    status: str = Field(default='source_checked_draft', pattern=r'^source_checked_draft$')


class Batch(BaseModel):
    batch_id: str = Field(pattern=r'^[a-zA-Z0-9_-]{1,80}$')
    records: list[Enrichment] = Field(min_length=1, max_length=100)


class ContentStore:
    def __init__(self, path):
        self.path = Path(path)

    def db(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        con = sqlite3.connect(self.path, timeout=10)
        os.chmod(self.path, 0o600)
        con.executescript('''
            CREATE TABLE IF NOT EXISTS content (material_id TEXT PRIMARY KEY, revision INTEGER NOT NULL,
                payload TEXT NOT NULL, digest TEXT NOT NULL, updated REAL NOT NULL);
            CREATE TABLE IF NOT EXISTS versions (material_id TEXT NOT NULL, revision INTEGER NOT NULL,
                payload TEXT NOT NULL, digest TEXT NOT NULL, PRIMARY KEY(material_id,revision));
            CREATE TABLE IF NOT EXISTS batches (id TEXT PRIMARY KEY, digest TEXT NOT NULL, count INTEGER NOT NULL);
        ''')
        return con

    def get(self, material_id, links):
        if not self.path.exists():
            return None
        with closing(self.db()) as con:
            row = con.execute('SELECT payload FROM content WHERE material_id=?',(material_id,)).fetchone()
        if not row:
            return None
        value = json.loads(row[0])
        if value['resource_id'] not in {youtube_id(l['url']) for l in links}:
            return None  # Changed source must never inherit an old summary.
        return {k:value[k] for k in ['resource_id','revision','summary','points','status']}

    def import_batch(self, batch, catalog):
        if len({r.resource_id for r in batch.records}) != len(batch.records):
            raise ValueError('Повтор источника в партии.')
        prepared = []
        for record in batch.records:
            matches = [r for r in catalog if record.resource_id in {youtube_id(l['url']) for l in r['links']}]
            if len(matches) != 1 or matches[0]['title'] != record.expected_title:
                raise ValueError('Источник или заголовок не совпадает с каталогом.')
            if any(p.end_seconds <= p.start_seconds for p in record.points):
                raise ValueError('Некорректный интервал источника.')
            value = record.model_dump()
            payload = json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':'))
            digest = hashlib.sha256(payload.encode()).hexdigest()
            prepared.append((matches[0]['id'],record.revision,payload,digest))
        batch_digest = hashlib.sha256(json.dumps(sorted(prepared),ensure_ascii=False).encode()).hexdigest()
        with closing(self.db()) as con, con:
            con.execute('BEGIN IMMEDIATE')
            prior = con.execute('SELECT digest,count FROM batches WHERE id=?',(batch.batch_id,)).fetchone()
            if prior:
                if prior[0] != batch_digest:
                    raise ValueError('Содержимое существующей партии изменилось.')
                return {'count':prior[1],'already_imported':True}
            for material_id, revision, payload, digest in prepared:
                old = con.execute('SELECT revision,digest FROM content WHERE material_id=?',(material_id,)).fetchone()
                if old and (revision < old[0] or (revision == old[0] and digest != old[1])):
                    raise ValueError('Для изменения текста увеличьте редакцию.')
                con.execute('INSERT OR IGNORE INTO versions VALUES (?,?,?,?)',(material_id,revision,payload,digest))
                con.execute('INSERT OR REPLACE INTO content VALUES (?,?,?,?,?)',(material_id,revision,payload,digest,time.time()))
            con.execute('INSERT INTO batches VALUES (?,?,?)',(batch.batch_id,batch_digest,len(prepared)))
        return {'count':len(prepared),'already_imported':False}

    def summary(self):
        with closing(self.db()) as con:
            return {'materials':con.execute('SELECT count(*) FROM content').fetchone()[0],
                    'batches':[{'id':r[0],'count':r[1]} for r in con.execute('SELECT id,count FROM batches ORDER BY id')]}


def mount_content_import(app, session, mutation):
    @app.get('/api/admin/wiki/content', dependencies=[Depends(session)])
    def content_status():
        return app.state.wiki_content.summary()

    @app.post('/api/admin/wiki/content', dependencies=[Depends(mutation)])
    def content_import(body: Batch):
        try:
            return app.state.wiki_content.import_batch(body,app.state.wiki_catalog())
        except ValueError as exc:
            raise HTTPException(409,str(exc)) from None
