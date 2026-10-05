"""Public, explicitly allowlisted wiki DTOs. Connection credentials stay private."""
import re
from urllib.parse import parse_qsl, urlsplit

from fastapi import HTTPException, Query

from .wiki_graph import build_graph

FIELDS = ('id', 'title', 'date', 'timestamp', 'category', 'category_name', 'subtopic', 'subtopic_key', 'description')
PUBLIC_LINK_TYPES = frozenset(('video', 'drive', 'doc', 'article'))


def public_text(value):
    # Source descriptions are already cleaned; protect annotations/labels too.
    text = re.sub(r'https?://\S+', '', str(value), flags=re.I)
    return re.sub(r'(?:код\s*доступа|пароль|password|passcode)\s*:?\s*\S+', '', text, flags=re.I).strip()


def public_link(link):
    try:
        parts = urlsplit(link.get('url', ''))
        host = (parts.hostname or '').lower().rstrip('.')
        # Accessing port also validates malformed authority strings.
        if parts.port not in (None, 443):
            return None
    except (TypeError, ValueError):
        return None
    if (parts.scheme != 'https' or not host or parts.username or parts.password
            or host == 'zoom.us' or host.endswith('.zoom.us')
            or host == 'zoom.com' or host.endswith('.zoom.com')
            or link.get('type') not in PUBLIC_LINK_TYPES):
        return None
    # Unknown credential-bearing links remain closed even if misclassified.
    secret_keys = {'pwd', 'passcode', 'password', 'token', 'invite', 'auth', 'access_token', 'code'}
    if any(key.casefold() in secret_keys for key, _ in parse_qsl(parts.query + '&' + parts.fragment)):
        return None
    return {'url': link['url'], 'type': link['type'], 'label': public_text(link.get('label', 'Оригинал'))}


def public_material(row, content=None):
    result = {key: public_text(row[key]) if isinstance(row[key], str) else row[key] for key in FIELDS}
    links = [item for link in row['links'] if (item := public_link(link)) is not None]
    result.update(links=links, restricted_links=len(links) != len(row['links']))
    annotation = content.get(row['id'], links) if content else None
    if annotation:
        result['annotation'] = {
            'resource_id': annotation['resource_id'], 'revision': annotation['revision'],
            'status': annotation['status'], 'summary': public_text(annotation['summary']),
            'points': [{'text': public_text(point['text']), 'start_seconds': point['start_seconds'],
                        'end_seconds': point['end_seconds']} for point in annotation['points']],
        }
    return result


def mount_public_wiki(app, load, content, *, enabled, semantic=None):
    def rows():
        if not enabled:
            raise HTTPException(404, 'Публичная вики ещё не включена')
        return [public_material(row) for row in load()]

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
        fields = ('id', 'title', 'date', 'category_name', 'subtopic')
        return {'total': len(selected),
                'missing_ids': sorted(wanted - {row['id'] for row in catalog}) if wanted and wanted != {'none'} else [],
                'items': [{key: row[key] for key in fields} for row in selected[offset:offset + limit]]}

    @app.get('/api/public/wiki/materials/{material_id}')
    def material(material_id: str):
        if not enabled:
            raise HTTPException(404, 'Публичная вики ещё не включена')
        for row in load():
            if row['id'] == material_id:
                return public_material(row, content)
        raise HTTPException(404, 'Материал больше не доступен')

    @app.get('/api/public/wiki/graph')
    def graph():
        return build_graph(rows(), semantic=semantic)
