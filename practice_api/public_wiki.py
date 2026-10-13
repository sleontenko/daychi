"""Public wiki text DTOs. Recording locations and connection credentials stay private."""
import hashlib
import json
import math
import re
from urllib.parse import parse_qsl, unquote, urlsplit

from fastapi import HTTPException, Query

from .wiki_graph import build_graph

FIELDS = ('id', 'title', 'date', 'timestamp', 'category', 'category_name', 'subtopic', 'subtopic_key', 'description')
PUBLIC_LINK_TYPES = frozenset(('video', 'drive', 'doc', 'article'))


def public_text(value):
    # Source descriptions are already cleaned; protect annotations/labels too.
    text = re.sub(r'https?://\S+|(?:[\w-]+\.)*(?:youtube(?:-nocookie)?\.com|youtu\.be)[/?]\S+', '', str(value), flags=re.I)
    return re.sub(r'(?:код\s*доступа|пароль|password|passcode)\s*:?\s*\S+', '', text, flags=re.I).strip()


def public_link(link, *, include_recordings=False):
    try:
        url = link.get('url', '')
        # Browsers treat backslashes as slashes and normalize encoded/IDN hosts.
        # Compare the same canonical host before granting an anonymous source link.
        if not isinstance(url, str) or '\\' in url or any(ord(char) < 33 for char in url):
            return None
        parts = urlsplit(url)
        host = unquote(parts.hostname or '', errors='strict').encode('idna').decode('ascii').lower().rstrip('.')
        if not re.fullmatch(r'[a-z0-9.-]+', host):
            return None
        # Accessing port also validates malformed authority strings.
        if parts.port not in (None, 443):
            return None
    except (TypeError, ValueError):
        return None
    if (parts.scheme != 'https' or not host or parts.username or parts.password
            or host == 'zoom.us' or host.endswith('.zoom.us')
            or host == 'zoom.com' or host.endswith('.zoom.com')
            or (not include_recordings and any(host == domain or host.endswith('.' + domain)
                   for domain in ('youtube.com', 'youtu.be', 'youtube-nocookie.com')))
            or link.get('type') not in PUBLIC_LINK_TYPES):
        return None
    # Unknown credential-bearing links remain closed even if misclassified.
    secret_keys = {'pwd', 'passcode', 'password', 'token', 'invite', 'auth', 'access_token', 'code'}
    if any(key.casefold() in secret_keys for key, _ in parse_qsl(parts.query + '&' + parts.fragment)):
        return None
    return {'url': link['url'], 'type': link['type'], 'label': public_text(link.get('label', 'Оригинал'))}


def public_material(row, content=None, *, include_recordings=False):
    result = {key: public_text(row[key]) if isinstance(row[key], str) else row[key] for key in FIELDS}
    links = [item for link in row['links'] if (item := public_link(link, include_recordings=include_recordings)) is not None]
    result.update(links=links, restricted_links=len(links) != len(row['links']))
    # Validate against the original source, while exposing only text and timestamps.
    annotation = content.get(row['id'], row['links']) if content else None
    if annotation:
        result['annotation'] = {
            'revision': annotation['revision'],
            'status': annotation['status'], 'summary': public_text(annotation['summary']),
            'points': [{'text': public_text(point['text']), 'start_seconds': point['start_seconds'],
                        'end_seconds': point['end_seconds']} for point in annotation['points']],
        }
        updated = annotation.get('updated_at')
        if isinstance(updated, (int, float)) and math.isfinite(updated) and updated > 0:
            result['annotation']['updated_at'] = updated
    return result


def public_article_identity(value):
    return 'a:' + hashlib.sha256(value.encode()).hexdigest()


def public_article(value):
    """Text and navigation remain public; recording IDs stay behind reader access."""
    def clean(item, key=''):
        if isinstance(item, dict):
            return {k: clean(v, k) for k, v in item.items() if k != 'resource_id'}
        if isinstance(item, list):
            return [clean(v, key) for v in item]
        if isinstance(item, str):
            if key in ('id', 'link_id', 'evidence_ids', 'supporting_link_ids'):
                return public_article_identity(item)
            return public_text(item)
        return item
    result = clean(value)
    if 'id' in value:
        result['id'] = value['id']  # Public concept navigation keeps its canonical slug.
    return result


def mount_public_wiki(app, load, content, *, enabled, semantic=None, article_store=None):
    def catalog():
        if not enabled:
            raise HTTPException(404, 'Публичная вики ещё не включена')
        return load()

    def rows():
        return [public_material(row) for row in catalog()]

    def summary(row):
        return {key: row[key] for key in ('id', 'title', 'date', 'timestamp', 'category_name', 'subtopic')}

    @app.get('/api/public/wiki/recent')
    def recent(limit: int = Query(10, ge=1, le=40), articles: bool = False):
        source = catalog()
        updates = content.update_times(source) if content else {}
        if articles and article_store and article_store.enabled:
            for identity, updated in article_store.projection(source)['updates'].items():
                updates[identity] = max(updates.get(identity, 0), updated)
        selected = [public_material(row) for row in source if updates.get(row['id'], row['timestamp']) > 0]
        selected.sort(key=lambda row: (-updates.get(row['id'], row['timestamp']), row['id']))
        return {'date_basis': 'last_update', 'items': [summary(row) | {
            'updated_timestamp': updates.get(row['id'], row['timestamp'])}
            for row in selected[:limit]]}

    @app.get('/api/public/wiki/categories')
    def categories():
        catalog = rows()
        result = []
        for category in dict.fromkeys(row['category'] for row in catalog):
            members = [row for row in catalog if row['category'] == category]
            subs = dict.fromkeys((r['subtopic_key'], r['subtopic']) for r in members if r['subtopic_key'])
            result.append({'id': category, 'name': members[0]['category_name'], 'count': len(members),
                'subtopics': [{'id': key, 'name': name, 'count': sum(r['subtopic_key'] == key for r in members)}
                             for key, name in sorted(subs)]})
        return result

    @app.get('/api/public/wiki/materials')
    def materials(q: str = Query('', max_length=300), category: str = '', subtopic: str = '',
                  sort: str = Query('new', pattern='^(new|old)$'), ids: str = Query('', max_length=40000),
                  limit: int = Query(40, ge=1, le=100), offset: int = Query(0, ge=0)):
        catalog = rows()
        fold = lambda value: ' '.join(value.casefold().replace('ё', 'е').split())
        tokens = fold(q).split()
        wanted = set(ids.split(',')) if ids else None
        def score(row):
            title = fold(row['title'])
            text = fold(' '.join(row[key] for key in ('title', 'description', 'category_name', 'subtopic')))
            return sum(3 if token in title else 1 for token in tokens if token in text) if all(token in text for token in tokens) else -1
        selected = [row for row in catalog if (not category or row['category'] == category)
                    and (not subtopic or row['subtopic_key'] == subtopic)
                    and (wanted is None or row['id'] in wanted) and score(row) >= 0]
        selected.sort(key=lambda row: (-score(row), row['timestamp'] if sort == 'old' else -row['timestamp'], row['id']))
        return {'total': len(selected),
                'missing_ids': sorted(wanted - {row['id'] for row in catalog}) if wanted and wanted != {'none'} else [],
                'items': [summary(row) for row in selected[offset:offset + limit]]}

    @app.get('/api/public/wiki/materials/{material_id}')
    def material(material_id: str):
        if not enabled:
            raise HTTPException(404, 'Публичная вики ещё не включена')
        for row in load():
            if row['id'] == material_id:
                return public_material(row, content)
        raise HTTPException(404, 'Материал больше не доступен')

    @app.get('/api/public/wiki/graph')
    def graph(semantics: bool = False, articles: bool = False):
        # Graph building needs original source bindings for update dates.
        # Its DTO never includes links or resource IDs; redact display text separately.
        result = build_graph(catalog(), content, semantic=semantic if semantics else None,
                             articles=article_store if articles else None)
        for section in result['sections']:
            section['name'] = public_text(section['name'])
        for node in result['nodes']:
            for key in ('label', 'sub', 'date'):
                if key in node:
                    node[key] = public_text(node[key])
            if 'aliases' in node:
                node['aliases'] = [public_text(alias) for alias in node['aliases']]
        for edge in result['edges']:
            if edge.get('article_relation'):
                edge['link_ids'] = [public_article_identity(identity) for identity in edge['link_ids']]
        result['version'] = hashlib.sha256(json.dumps(result, ensure_ascii=False, sort_keys=True,
            separators=(',', ':')).encode()).hexdigest()
        return result
