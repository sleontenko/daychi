"""Reviewed glossary/topic pages anchored to current published source quotations."""
from contextlib import closing
import hashlib
import json
import re
import time
from typing import Literal

from fastapi import Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, model_validator

from .wiki_content import youtube_id


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))


def folded(value):
    return ' '.join(value.casefold().replace('ё', 'е').split())


def safe_text(value):
    value = re.sub(r'https?://\S+', '', value, flags=re.I)
    return re.sub(r'(?:код\s*доступа|пароль|password|passcode)\s*:?\s*\S+', '', value, flags=re.I).strip()


class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)


class Quote(StrictModel):
    text: str = Field(min_length=10, max_length=1500)
    start_seconds: float = Field(ge=0, le=100000)
    end_seconds: float = Field(gt=0, le=100000)

    @model_validator(mode='after')
    def valid_interval(self):
        if self.end_seconds <= self.start_seconds:
            raise ValueError('Invalid evidence interval')
        return self


class SemanticLink(StrictModel):
    resource_id: str = Field(pattern=r'^[A-Za-z0-9_-]{11}$')
    expected_title: str = Field(min_length=1, max_length=1000)
    source_revision: int = Field(ge=1, le=100000)
    transcript_sha256: str = Field(pattern=r'^[0-9a-f]{64}$')
    subtitles_sha256: str = Field(pattern=r'^[0-9a-f]{64}$')
    relation: Literal['discusses', 'explains', 'practices']
    rationale: str = Field(min_length=20, max_length=1000)
    points: list[Quote] = Field(min_length=1, max_length=3)


class Claim(StrictModel):
    text: str = Field(min_length=20, max_length=1000)
    evidence_indexes: list[int] = Field(min_length=1, max_length=30)


class SemanticPage(StrictModel):
    concept_id: str = Field(pattern=r'^[a-z][a-z0-9-]{1,79}$')
    kind: Literal['term', 'topic']
    title: str = Field(min_length=2, max_length=200)
    aliases: list[str] = Field(default_factory=list, max_length=12)
    revision: int = Field(ge=1, le=100000)
    status: Literal['source_checked_draft'] = 'source_checked_draft'
    claims: list[Claim] = Field(min_length=1, max_length=4)
    links: list[SemanticLink] = Field(min_length=1, max_length=30)

    @model_validator(mode='after')
    def evidence_complete(self):
        labels = [self.title, *self.aliases]
        if any(not 2 <= len(a.strip()) <= 200 for a in labels):
            raise ValueError('Invalid concept label')
        if len({folded(a) for a in labels}) != len(labels):
            raise ValueError('Duplicate concept alias')
        if len({l.resource_id for l in self.links}) != len(self.links):
            raise ValueError('Duplicate material link')
        referenced = set()
        for claim in self.claims:
            indexes = claim.evidence_indexes
            if len(set(indexes)) != len(indexes) or any(i < 0 or i >= len(self.links) for i in indexes):
                raise ValueError('Claim has invalid evidence')
            referenced.update(indexes)
        if referenced != set(range(len(self.links))):
            raise ValueError('Every relation must support a page claim')
        for link in self.links:
            if len({canonical(p.model_dump()) for p in link.points}) != len(link.points):
                raise ValueError('Duplicate quotation')
        return self


class Review(StrictModel):
    editor: str = Field(min_length=1, max_length=80)
    reviewer: str = Field(min_length=1, max_length=80)
    editorial_sha256: str = Field(pattern=r'^[0-9a-f]{64}$')
    review_sha256: str = Field(pattern=r'^[0-9a-f]{64}$')
    verdict: Literal['pass']
    full_text_read: Literal[True]

    @model_validator(mode='after')
    def independent(self):
        if folded(self.editor) == folded(self.reviewer):
            raise ValueError('A separate reviewer is required')
        return self


class SemanticBatch(StrictModel):
    batch_id: str = Field(pattern=r'^[a-zA-Z0-9_-]{1,80}$')
    pages: list[SemanticPage] = Field(min_length=1, max_length=100)
    review: Review

    @model_validator(mode='after')
    def unique_pages(self):
        if len({p.concept_id for p in self.pages}) != len(self.pages):
            raise ValueError('Duplicate concept ID')
        if sum(len(p.links) for p in self.pages) > 200:
            raise ValueError('Too many relations in one batch')
        return self


class SemanticStore:
    def __init__(self, content, *, enabled=True):
        self.content = content
        self.enabled = enabled

    def db(self):
        con = self.content.db()
        con.executescript('''
            CREATE TABLE IF NOT EXISTS semantic_pages (id TEXT PRIMARY KEY,
                revision INTEGER NOT NULL, payload TEXT NOT NULL, digest TEXT NOT NULL, updated REAL NOT NULL);
            CREATE TABLE IF NOT EXISTS semantic_versions (id TEXT NOT NULL, revision INTEGER NOT NULL,
                payload TEXT NOT NULL, digest TEXT NOT NULL, PRIMARY KEY(id,revision));
            CREATE TABLE IF NOT EXISTS semantic_batches (id TEXT PRIMARY KEY, digest TEXT NOT NULL,
                pages INTEGER NOT NULL, links INTEGER NOT NULL);
        ''')
        return con

    @staticmethod
    def sources(catalog):
        by_resource = {}
        for row in catalog:
            for resource in {youtube_id(l['url']) for l in row['links']} - {None}:
                by_resource.setdefault(resource, []).append(row)
        return by_resource

    @staticmethod
    def validate_link(link, by_resource, current):
        matches = by_resource.get(link['resource_id'], [])
        if len(matches) != 1 or matches[0]['title'] != link['expected_title']:
            raise ValueError('Источник связи не совпадает с каталогом.')
        row = matches[0]
        source = current.get(row['id'])
        if not source or source['status'] != 'source_checked_draft':
            raise ValueError('Связь требует опубликованного проверенного конспекта.')
        for key, expected in [('resource_id', link['resource_id']), ('revision', link['source_revision']),
                              ('transcript_sha256', link['transcript_sha256']),
                              ('subtitles_sha256', link['subtitles_sha256'])]:
            if source[key] != expected:
                raise ValueError('Редакция или хеш источника связи изменились.')
        available = {canonical(p) for p in source['points']}
        if any(canonical(p) not in available for p in link['points']):
            raise ValueError('Цитата связи не совпадает с опубликованным фрагментом.')
        return row

    def import_batch(self, batch, catalog):
        if not self.enabled:
            raise ValueError('Смысловые страницы ещё не включены.')
        data = batch.model_dump()
        digest = hashlib.sha256(canonical(data).encode()).hexdigest()
        by_resource = self.sources(catalog)
        with closing(self.db()) as con, con:
            # Content revisions and semantic pages share a transaction/lock.
            con.execute('BEGIN IMMEDIATE')
            current = {i: json.loads(p) for i, p in con.execute('SELECT material_id,payload FROM content')}
            prior = con.execute('SELECT digest,pages,links FROM semantic_batches WHERE id=?', (batch.batch_id,)).fetchone()
            if prior and prior[0] != digest:
                raise ValueError('Содержимое существующей смысловой партии изменилось.')
            if prior:
                # A receipt replay does not reactivate stale evidence or rewrite pages.
                return {'pages': prior[1], 'links': prior[2], 'already_imported': True}
            labels = {}
            incoming = {p.concept_id for p in batch.pages}
            for identity, payload in con.execute('SELECT id,payload FROM semantic_pages'):
                if identity not in incoming:
                    page = json.loads(payload)
                    for label in [page['title'], *page['aliases']]:
                        labels[folded(label)] = identity
            prepared = []
            for page in batch.pages:
                value = page.model_dump()
                for label in [page.title, *page.aliases]:
                    key = folded(label)
                    if key in labels and labels[key] != page.concept_id:
                        raise ValueError('Термин или псевдоним уже принадлежит другой странице.')
                    labels[key] = page.concept_id
                for link in value['links']:
                    self.validate_link(link, by_resource, current)
                value['review'] = data['review']
                payload = canonical(value)
                page_digest = hashlib.sha256(payload.encode()).hexdigest()
                old = con.execute('SELECT revision,digest,payload FROM semantic_pages WHERE id=?', (page.concept_id,)).fetchone()
                if old:
                    if json.loads(old[2])['kind'] != page.kind:
                        raise ValueError('Тип существующей страницы изменять нельзя.')
                    if page.revision < old[0] or (page.revision == old[0] and page_digest != old[1]):
                        raise ValueError('Для изменения страницы увеличьте редакцию.')
                prepared.append((page.concept_id, page.revision, payload, page_digest, bool(old and old[1] == page_digest)))
            for identity, revision, payload, page_digest, unchanged in prepared:
                if unchanged:
                    continue
                con.execute('INSERT INTO semantic_versions VALUES (?,?,?,?)', (identity, revision, payload, page_digest))
                con.execute('INSERT OR REPLACE INTO semantic_pages VALUES (?,?,?,?,?)', (identity, revision, payload, page_digest, time.time()))
            count = sum(len(p.links) for p in batch.pages)
            con.execute('INSERT INTO semantic_batches VALUES (?,?,?,?)', (batch.batch_id, digest, len(prepared), count))
        return {'pages': len(prepared), 'links': count, 'already_imported': False}

    def active_pages(self, catalog):
        if not self.enabled or not self.content.path.exists():
            return []
        by_resource = self.sources(catalog)
        with closing(self.db()) as con:
            con.execute('BEGIN')  # One read snapshot for sources and semantic pages.
            current = {i: json.loads(p) for i, p in con.execute('SELECT material_id,payload FROM content')}
            stored = list(con.execute('SELECT payload,updated FROM semantic_pages ORDER BY id'))
        result = []
        for payload, updated in stored:
            value = json.loads(payload)
            try:
                rows = [self.validate_link(link, by_resource, current) for link in value['links']]
            except ValueError:
                continue  # Any stale evidence hides the whole page until re-review.
            result.append({'id': value['concept_id'], 'kind': value['kind'],
                'title': safe_text(value['title']), 'aliases': [safe_text(a) for a in value['aliases']],
                'revision': value['revision'], 'status': value['status'], 'updated_at': updated,
                'claims': [{'text': safe_text(c['text']), 'evidence_indexes': c['evidence_indexes']} for c in value['claims']],
                'links': [{'material_id': row['id'], 'title': safe_text(row['title']),
                    'resource_id': link['resource_id'], 'relation': link['relation'], 'rationale': safe_text(link['rationale']),
                    'points': [{**p, 'text': safe_text(p['text'])} for p in link['points']]}
                    for row, link in zip(rows, value['links'])]})
        return result

    def material_links(self, material_id, catalog):
        return [{'id': p['id'], 'kind': p['kind'], 'title': p['title'], 'status': p['status'],
                 **{k: link[k] for k in ['relation', 'rationale', 'points', 'resource_id']}}
                for p in self.active_pages(catalog) for link in p['links'] if link['material_id'] == material_id]

    def graph(self, catalog):
        pages = self.active_pages(catalog)
        return {'nodes': [{'id': 'g:' + p['id'], 'concept_id': p['id'], 'type': p['kind'],
                          'label': p['title'], 'aliases': p['aliases'], 'count': len(p['links']), 'status': p['status'],
                          'updated_ts': int(p['updated_at'] * 1000)} for p in pages],
                'edges': [{'s': link['material_id'], 't': 'g:' + p['id'], 'k': 'semantic',
                           'relation': link['relation'], 'evidence_count': len(link['points'])}
                          for p in pages for link in p['links']]}

    def summary(self):
        if not self.content.path.exists():
            return {'pages': 0, 'links': 0, 'batches': []}
        with closing(self.db()) as con:
            pages = [json.loads(p) for (p,) in con.execute('SELECT payload FROM semantic_pages')]
            return {'pages': len(pages), 'links': sum(len(p['links']) for p in pages),
                    'batches': [{'id': i, 'pages': p, 'links': l} for i, p, l in con.execute('SELECT id,pages,links FROM semantic_batches ORDER BY id')]}


def mount_semantic_reads(app, load, store, *, prefix, authorize=None):
    dependencies = [Depends(authorize)] if authorize else []
    def pages():
        if not store.enabled:
            raise HTTPException(404, 'Смысловые страницы ещё не включены')
        return store.active_pages(load())

    @app.get(prefix + '/concepts', dependencies=dependencies)
    def concepts(q: str = Query('', max_length=200), kind: str = Query('', pattern='^(|term|topic)$')):
        tokens = folded(q).split()
        found = [p for p in pages() if (not kind or p['kind'] == kind) and
                 all(t in folded(' '.join([p['title'], *p['aliases']])) for t in tokens)]
        return {'items': [{k: p[k] for k in ['id', 'title', 'aliases', 'kind', 'status', 'revision']} |
                          {'materials': len(p['links'])} for p in sorted(found, key=lambda p: folded(p['title']))]}

    @app.get(prefix + '/concepts/{concept_id}', dependencies=dependencies)
    def concept(concept_id: str):
        for page in pages():
            if page['id'] == concept_id:
                return page
        raise HTTPException(404, 'Страница отсутствует или требует повторной проверки')

    @app.get(prefix + '/materials/{material_id}/concepts', dependencies=dependencies)
    def material_concepts(material_id: str):
        catalog = load()
        if not store.enabled or not any(r['id'] == material_id for r in catalog):
            raise HTTPException(404)
        return {'items': store.material_links(material_id, catalog)}


def mount_semantic_import(app, session, mutation):
    @app.get('/api/admin/wiki/semantic-content', dependencies=[Depends(session)])
    def status():
        return app.state.wiki_semantics.summary()

    @app.post('/api/admin/wiki/semantic-content', dependencies=[Depends(mutation)])
    def import_content(body: SemanticBatch):
        try:
            return app.state.wiki_semantics.import_batch(body, app.state.wiki_catalog())
        except ValueError as exc:
            raise HTTPException(409, str(exc)) from None
