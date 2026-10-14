"""Atomic source-pinned article bundles, shared by reader and graph projections."""
from collections import defaultdict
from contextlib import closing
import hashlib
import json
import re
import time
from urllib.parse import parse_qsl, unquote, urlsplit

from fastapi import Depends, HTTPException

from .wiki_article_models import ArticleBatch, folded
from .wiki_semantics import SemanticStore, canonical
from . import wiki_archive_sources as archive_sources


def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def object_digest(value, data):
    return digest({'object': {k: v for k, v in value.items() if k != 'revision'},
                   'sources': data['sources'], 'evidence': data['evidence'], 'links': data['links']})


class ArticleStore:
    def __init__(self, content, *, enabled=False):
        self.content = content
        self.enabled = enabled

    def db(self):
        con = self.content.db()
        con.executescript('''
            CREATE TABLE IF NOT EXISTS article_objects (kind TEXT NOT NULL, id TEXT NOT NULL,
                revision INTEGER NOT NULL, digest TEXT NOT NULL, payload TEXT NOT NULL,
                updated REAL NOT NULL, PRIMARY KEY(kind,id));
            CREATE TABLE IF NOT EXISTS article_versions (kind TEXT NOT NULL, id TEXT NOT NULL,
                revision INTEGER NOT NULL, digest TEXT NOT NULL, payload TEXT NOT NULL,
                PRIMARY KEY(kind,id,revision));
            CREATE TABLE IF NOT EXISTS article_batches (id TEXT PRIMARY KEY, digest TEXT NOT NULL,
                payload TEXT NOT NULL, articles INTEGER NOT NULL, concepts INTEGER NOT NULL, links INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS archive_sources (resource_id TEXT PRIMARY KEY,
                material_id TEXT NOT NULL UNIQUE, revision INTEGER NOT NULL,
                digest TEXT NOT NULL, payload TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS archive_source_versions (resource_id TEXT NOT NULL,
                revision INTEGER NOT NULL, digest TEXT NOT NULL, payload TEXT NOT NULL,
                PRIMARY KEY(resource_id,revision));
        ''')
        return con

    @staticmethod
    def validate_sources(data, catalog, current):
        by_resource = SemanticStore.sources(catalog)
        for source in data['sources']:
            matches = by_resource.get(source['resource_id'], [])
            if (len(matches) != 1 or matches[0]['id'] != source['material_id'] or
                    matches[0]['title'] != source['expected_title']):
                raise ValueError('Источник статьи не совпадает с каталогом.')
            published = current.get(source['material_id'])
            if not published or published.get('status') != 'source_checked_draft':
                raise ValueError('Статья требует проверенного опубликованного источника.')
            for incoming, stored in [('resource_id', 'resource_id'), ('content_revision', 'revision'),
                                     ('transcript_sha256', 'transcript_sha256'), ('subtitles_sha256', 'subtitles_sha256')]:
                if source[incoming] != published.get(stored):
                    raise ValueError('Редакция или хеш источника статьи изменились.')

    @staticmethod
    def check_concepts(con, data):
        incoming = {c['id']: c for c in data['concepts']}
        labels = {}
        stored = []
        # Semantic v1 retains authority over its existing identities and labels.
        if con.execute("SELECT name FROM sqlite_master WHERE name='semantic_pages'").fetchone():
            stored.extend((identity, json.loads(payload)) for identity, payload in
                          con.execute('SELECT id,payload FROM semantic_pages'))
        stored.extend((identity, json.loads(payload)) for identity, payload in
                      con.execute("SELECT id,payload FROM article_objects WHERE kind='concept'"))
        for identity, page in stored:
            if identity in incoming and page['kind'] != incoming[identity]['kind']:
                raise ValueError('Тип существующего понятия изменять нельзя.')
            for label in [page['title'], *page['aliases']]:
                labels[folded(label)] = identity
        for page in data['concepts']:
            for label in [page['title'], *page['aliases']]:
                key = folded(label)
                if key in labels and labels[key] != page['id']:
                    raise ValueError('Название или псевдоним принадлежит другому понятию.')
                labels[key] = page['id']

    @staticmethod
    def retained_content(con, data):
        """Updates are reviewed whole pages; a supplement cannot erase old work."""
        incoming = {c['id']: c for c in data['concepts']}
        evidence = {e['id']: e for e in data['evidence']}
        def quote(e):
            return canonical({k: e[k] for k in ('resource_id', 'text', 'start_seconds', 'end_seconds')})
        def claim_key(claim, by_id):
            return (claim['text'], frozenset(quote(by_id[i]) for i in claim['evidence_ids']))
        def link_key(link, by_id):
            return (link['resource_id'], link['concept_id'], link['relation'], link['rationale'],
                    frozenset(quote(by_id[i]) for i in link['evidence_ids']))
        for payload, in con.execute('SELECT payload FROM article_batches'):
            old = json.loads(payload)
            old_evidence = {e['id']: e for e in old['evidence']}
            for concept in old['concepts']:
                identity = concept['id']
                if identity not in incoming:
                    continue
                claims = {claim_key(c, evidence) for c in incoming[identity]['claims']}
                links = {link_key(l, evidence) for l in data['links'] if l['concept_id'] == identity}
                if (not all(claim_key(c, old_evidence) in claims for c in concept['claims']) or
                        not all(link_key(l, old_evidence) in links for l in old['links'] if l['concept_id'] == identity)):
                    raise ValueError('Обновление понятия должно сохранять проверенные утверждения и связи.')

    def import_batch(self, batch, catalog):
        return self._import(batch, catalog, archive=False)

    def import_archive_batch(self, batch, catalog):
        return self._import(batch, catalog, archive=True)

    def _import(self, batch, catalog, *, archive):
        if (batch.format == archive_sources.FORMAT) != archive:
            raise ValueError('Article format requires its matching import endpoint')
        if not self.enabled:
            raise ValueError('Структурированные статьи ещё не включены.')
        data = batch.model_dump()
        batch_hash = digest(data)
        counts = {'articles': len(data['articles']), 'concepts': len(data['concepts']), 'links': len(data['links'])}
        with closing(self.db()) as con, con:
            con.execute('BEGIN IMMEDIATE')
            prior = con.execute('SELECT digest FROM article_batches WHERE id=?', (batch.batch_id,)).fetchone()
            if prior:
                if prior[0] != batch_hash:
                    raise ValueError('Содержимое существующей партии статей изменилось.')
                return counts | {'already_imported': True}
            current = {identity: json.loads(payload) for identity, payload in
                       con.execute('SELECT material_id,payload FROM content')}
            if archive:
                sources = archive_sources.register_sources(con, data, catalog, digest)
                catalog = archive_sources.merged_catalog(catalog, sources)
                archive_sources.validate_sources(data, catalog, current, sources, self.validate_sources)
            else:
                self.validate_sources(data, catalog, current)
            self.check_concepts(con, data)
            self.retained_content(con, data)
            prepared = []
            for kind, objects, key in [('article', data['articles'], 'material_id'), ('concept', data['concepts'], 'id')]:
                for value in objects:
                    identity = value[key]
                    fingerprint = object_digest(value, data)
                    old = con.execute('SELECT revision,digest FROM article_objects WHERE kind=? AND id=?',
                                      (kind, identity)).fetchone()
                    if old and old[1] == fingerprint:
                        continue  # New processing metadata never refreshes content dates/history.
                    if old and value['revision'] <= old[0]:
                        raise ValueError('Для изменения статьи или понятия увеличьте редакцию.')
                    prepared.append((kind, identity, value['revision'], fingerprint, canonical(value), time.time()))
            for row in prepared:
                con.execute('INSERT INTO article_versions VALUES (?,?,?,?,?)', row[:5])
                con.execute('INSERT OR REPLACE INTO article_objects VALUES (?,?,?,?,?,?)', row)
            con.execute('INSERT INTO article_batches VALUES (?,?,?,?,?,?)',
                        (batch.batch_id, batch_hash, canonical(data), *counts.values()))
        return counts | {'already_imported': False}

    def active_bundles(self, catalog):
        if not self.enabled or not self.content.path.exists():
            return []
        with closing(self.db()) as con:
            con.execute('BEGIN')
            current = {identity: json.loads(payload) for identity, payload in
                       con.execute('SELECT material_id,payload FROM content')}
            archives = archive_sources.current_sources(con)
            catalog = archive_sources.merged_catalog(catalog, archives)
            objects = {(kind, identity): (fingerprint, json.loads(payload), updated)
                       for kind, identity, fingerprint, payload, updated in
                       con.execute('SELECT kind,id,digest,payload,updated FROM article_objects')}
            batches = list(con.execute('SELECT payload FROM article_batches ORDER BY rowid DESC'))
        result = []
        seen = set()
        for payload, in batches:
            data = json.loads(payload)
            try:
                if data['format'] == archive_sources.FORMAT:
                    archive_sources.validate_sources(data, catalog, current, archives, self.validate_sources)
                else:
                    self.validate_sources(data, catalog, current)
            except ValueError:
                continue
            identities = [(kind, v[key], v) for kind, values, key in
                          [('article', data['articles'], 'material_id'), ('concept', data['concepts'], 'id')]
                          for v in values]
            if any(objects[(kind, identity)][0] != object_digest(value, data) for kind, identity, value in identities):
                continue  # A superseded bundle cannot mix old article links with a new page.
            if digest({k: v for k, v in data.items() if k not in ('batch_id', 'review')}) in seen:
                continue
            seen.add(digest({k: v for k, v in data.items() if k not in ('batch_id', 'review')}))
            data['_objects'] = objects
            result.append(data)
        return result

    @staticmethod
    def evidence(data, ids):
        result = []
        for e in data['evidence']:
            if e['id'] not in ids:
                continue
            item = {k: v for k, v in e.items() if k != 'admission'}
            if e['resource_id'].startswith('drive:'):
                item.update(source_url=archive_sources.source_url(e['resource_id']), time_basis='pcm_clip')
            result.append(item)
        return result

    @staticmethod
    def links(data, ids):
        sources = {s['resource_id']: s for s in data['sources']}
        concepts = {c['id']: c for c in data['concepts']}
        return [dict(link, material_id=sources[link['resource_id']]['material_id'],
                     title=sources[link['resource_id']]['expected_title'],
                     concept_title=concepts[link['concept_id']]['title'],
                     concept_kind=concepts[link['concept_id']]['kind'])
                for link in data['links'] if link['id'] in ids]

    def article(self, identity, catalog):
        for data in self.active_bundles(catalog):
            if not any(a['material_id'] == identity for a in data['articles']):
                continue
            _, article, updated = data['_objects'][('article', identity)]
            claims = {c['id']: c for c in article['claims']}
            link_ids = {m['link_id'] for c in article['claims'] for m in c['mentions']}
            link_ids.update(i for related in article['related'] for i in related['supporting_link_ids'])
            links = self.links(data, link_ids)
            evidence_ids = {i for c in article['claims'] for i in c['evidence_ids']}
            evidence_ids.update(i for link in links for i in link['evidence_ids'])
            sources = {s['material_id']: s for s in data['sources']}
            concepts = {c['id']: c for c in data['concepts']}
            result = {'format': archive_sources.FORMAT if article['resource_id'].startswith('drive:') else 'daychi-wiki-articles/1', 'material_id': identity, 'resource_id': article['resource_id'],
                    'revision': article['revision'], 'status': article['status'], 'updated_at': updated,
                    'introduction': [claims[i] for i in article['introduction_claim_ids']],
                    'sections': [{'id': s['id'], 'heading': s['heading'], 'paragraphs': [claims[i] for i in s['claim_ids']]}
                                 for s in article['sections']],
                    'evidence': self.evidence(data, evidence_ids), 'links': links,
                    'related': [dict(r, title=sources[r['material_id']]['expected_title'],
                                     concept_title=concepts[r['via_concept_id']]['title']) for r in article['related']]}
            if article.get('coverage_note'):
                result['coverage_note'] = article['coverage_note']
            return result
        return None

    def concept(self, identity, catalog):
        for data in self.active_bundles(catalog):
            if not any(c['id'] == identity for c in data['concepts']):
                continue
            _, page, updated = data['_objects'][('concept', identity)]
            links = self.links(data, {l['id'] for l in data['links'] if l['concept_id'] == identity})
            evidence_ids = {i for c in page['claims'] for i in c['evidence_ids']}
            evidence_ids.update(i for link in links for i in link['evidence_ids'])
            reader_format = archive_sources.FORMAT if any(e['id'] in evidence_ids and e['resource_id'].startswith('drive:') for e in data['evidence']) else 'daychi-wiki-articles/1'
            return dict(page, format=reader_format, updated_at=updated,
                        evidence=self.evidence(data, evidence_ids), links=links)
        return None

    def projection(self, catalog):
        nodes, pairs, updates = {}, defaultdict(dict), {}
        for data in self.active_bundles(catalog):
            for page in data['concepts']:
                _, value, updated = data['_objects'][('concept', page['id'])]
                nodes[page['id']] = {'id': 'g:' + page['id'], 'type': value['kind'], 'sec': 'glossary',
                                    'concept_id': page['id'], 'label': value['title'], 'aliases': value['aliases'], 'article_concept': True,
                                    'updated_ts': int(updated * 1000)}
            sources = {s['resource_id']: s for s in data['sources']}
            for link in data['links']:
                pair = (sources[link['resource_id']]['material_id'], 'g:' + link['concept_id'])
                pairs[pair][link['id']] = link
            for article in data['articles']:
                updates[article['material_id']] = int(data['_objects'][('article', article['material_id'])][2] * 1000)
        for identity, node in nodes.items():
            node['count'] = sum(concept == 'g:' + identity for material, concept in pairs)
        return {'nodes': list(nodes.values()), 'edges': [
            {'s': material, 't': concept, 'k': 'semantic', 'article_relation': True,
             'link_ids': list(links), 'relation': next(iter(links.values()))['relation'],
             'evidence_count': len({e for l in links.values() for e in l['evidence_ids']})}
            for (material, concept), links in pairs.items()], 'updates': updates}

    def summary(self):
        with closing(self.db()) as con:
            return {'enabled': self.enabled, 'articles': con.execute("SELECT count(*) FROM article_objects WHERE kind='article'").fetchone()[0],
                    'concepts': con.execute("SELECT count(*) FROM article_objects WHERE kind='concept'").fetchone()[0],
                    'batches': [{'id': r[0], 'articles': r[1], 'concepts': r[2], 'links': r[3]}
                                for r in con.execute('SELECT id,articles,concepts,links FROM article_batches ORDER BY id')]}

    def archive_catalog(self, catalog):
        if not self.enabled or not self.content.path.exists():
            return catalog
        with closing(self.db()) as con:
            con.execute('BEGIN')
            sources = archive_sources.current_sources(con)
        return archive_sources.merged_catalog(catalog, sources)

    def source_inventory(self, catalog):
        """Coordinator-only source binding for a fresh publication preflight."""
        with closing(self.content.db()) as con:
            con.execute('BEGIN')
            current = {identity: json.loads(payload) for identity, payload in con.execute('SELECT material_id,payload FROM content')}
            archives = archive_sources.current_sources(con) if con.execute(
                "SELECT name FROM sqlite_master WHERE name='archive_sources'").fetchone() else {}
        active_archives = {}
        if archives:
            for bundle in self.active_bundles(catalog):
                bundle_sources = {source['resource_id']: source for source in bundle['sources']}
                for article in bundle['articles']:
                    resource_id = article['resource_id']
                    if resource_id.startswith('drive:') and bundle_sources.get(resource_id) == archives.get(resource_id):
                        active_archives.setdefault(article['material_id'], {
                            'format': archive_sources.FORMAT,
                            'revision': article['revision'],
                            'status': article['status'],
                        })
        archive_by_material = {source['material_id']: source for source in archives.values()}
        result = []
        fields = ('id', 'title', 'date', 'timestamp', 'category', 'category_name', 'subtopic', 'subtopic_key', 'description')
        def source_link(link):
            if link.get('type') == 'zoom':
                return False
            try:
                url = link['url']
                if not isinstance(url, str) or '\\' in url or any(ord(c) < 33 for c in url):
                    return False
                parts = urlsplit(url)
                host = unquote(parts.hostname or '', errors='strict').encode('idna').decode('ascii').lower().rstrip('.')
                if (parts.scheme != 'https' or not re.fullmatch(r'[a-z0-9.-]+', host)
                        or parts.username or parts.password or parts.port not in (None, 443)
                        or any(host == domain or host.endswith('.' + domain) for domain in ('zoom.us', 'zoom.com'))):
                    return False
                secret_keys = {'pwd', 'passcode', 'password', 'token', 'invite', 'auth', 'access_token', 'code'}
                return not any(key.casefold() in secret_keys for key, _ in parse_qsl(parts.query + '&' + parts.fragment))
            except (KeyError, ValueError, UnicodeError, TypeError):
                return False
        for row in catalog:
            item = {key: row[key] for key in fields}
            item['links'] = [{key: link[key] for key in ('url', 'type', 'label') if key in link}
                             for link in row['links'] if source_link(link)]
            annotation = current.get(row['id'])
            if annotation and annotation['resource_id'] in SemanticStore.sources([row]):
                item['annotation'] = annotation
            source = archive_by_material.get(row['id'])
            if source and row.get('_archive_recording'):
                item['archive_source'] = source
                if row['id'] in active_archives:
                    item['archive_article'] = active_archives[row['id']]
            result.append(item)
        return {'materials': result}


def mount_article_reads(app, load, store, *, prefix, authorize=None, project=lambda value: value):
    dependencies = [Depends(authorize)] if authorize else []

    @app.get(prefix + '/articles/materials/{material_id}', dependencies=dependencies)
    def article(material_id: str):
        value = store.article(material_id, load())
        if value is None:
            raise HTTPException(404, 'Статья пока недоступна')
        return project(value)

    @app.get(prefix + '/articles/concepts/{concept_id}', dependencies=dependencies)
    def concept(concept_id: str):
        value = store.concept(concept_id, load())
        if value is None:
            raise HTTPException(404, 'Страница понятия пока недоступна')
        return project(value)


def mount_article_import(app, session, mutation):
    from .wiki_archive_models import ArchiveBatch
    @app.get('/api/admin/wiki/articles/sources', dependencies=[Depends(session)])
    def sources():
        return app.state.wiki_articles.source_inventory(app.state.wiki_catalog())

    @app.get('/api/admin/wiki/articles', dependencies=[Depends(session)])
    def status():
        return app.state.wiki_articles.summary()

    @app.post('/api/admin/wiki/articles', dependencies=[Depends(mutation)])
    def article_import(body: ArticleBatch):
        try:
            return app.state.wiki_articles.import_batch(body, app.state.wiki_catalog())
        except ValueError as exc:
            raise HTTPException(409, str(exc)) from None

    @app.post('/api/admin/wiki/archive-articles', dependencies=[Depends(mutation)])
    def archive_import(body: ArchiveBatch):
        try:
            return app.state.wiki_articles.import_archive_batch(body, app.state.wiki_catalog())
        except ValueError as exc:
            raise HTTPException(409, str(exc)) from None
