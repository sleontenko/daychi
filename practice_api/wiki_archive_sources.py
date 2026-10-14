"""Article-owned Drive source pins and an additive catalog, without v1 summaries."""
import json
import re
from urllib.parse import parse_qs, unquote, urlsplit

from .wiki_semantics import canonical

FORMAT = 'daychi-wiki-archive-articles/1'
COHORTS = {'neidan': 'Занятия', 'retreat2016': 'Ретрит 2016 · группа архива',
           'retreat2017': 'Ретрит 2017 · группа архива'}


def drive_resource(url):
    """Identify existing links without copying their query/fragment credentials."""
    try:
        if not isinstance(url, str) or '\\' in url or any(ord(c) < 33 for c in url):
            return None
        parts = urlsplit(url)
        host = unquote(parts.hostname or '', errors='strict').encode('idna').decode('ascii').lower().rstrip('.')
        if host != 'drive.google.com' or parts.scheme not in ('http', 'https') or parts.username or parts.password:
            return None
        if parts.port not in (None, 80, 443):
            return None
        path = unquote(parts.path, errors='strict')
        match = re.fullmatch(r'/file/d/([A-Za-z0-9_-]{10,200})(?:/view)?', path)
        values = parse_qs(parts.query).get('id', []) if path == '/open' else []
        identity = match[1] if match else values[0] if len(values) == 1 else None
        return 'drive:' + identity if identity and re.fullmatch(r'[A-Za-z0-9_-]{10,200}', identity) else None
    except (TypeError, ValueError, UnicodeError):
        return None


def source_url(resource):
    if not re.fullmatch(r'drive:[A-Za-z0-9_-]{10,200}', resource):
        raise ValueError('Invalid Drive identity')
    return 'https://drive.google.com/file/d/' + resource[6:] + '/view'


def current_sources(con):
    return {identity: json.loads(payload) for identity, payload in
            con.execute('SELECT resource_id,payload FROM archive_sources')}


def catalog_rows(sources):
    result = []
    for source in sources.values():
        origin = source['archive']
        result.append({'id': source['material_id'], 'title': source['expected_title'],
                       'date': 'Дата записи не проверена', 'timestamp': 0,
                       'category': 'archive:' + origin['collection_id'],
                       'category_name': 'Архив Нэйдань' if origin['collection_id'] == 'archive-neidan' else 'Архив',
                       'subtopic': COHORTS[origin['cohort']], 'subtopic_key': origin['cohort'],
                       'description': 'Текст по машинным расшифровкам. Аудио не прослушано.',
                       'links': [{'url': source_url(alias['resource_id']), 'type': 'drive_recording',
                                  'label': alias['title']} for alias in origin['aliases']],
                       '_archive_recording': True})
    return result


def merged_catalog(catalog, sources):
    base = [r for r in catalog if not r.get('_archive_recording')]
    overlay = catalog_rows(sources)
    if {r['id'] for r in base}.intersection(r['id'] for r in overlay):
        raise ValueError('Archive catalog cannot replace an existing material')
    return base + overlay


def register_sources(con, data, catalog, digest):
    """Called within the same transaction as the complete article bundle."""
    stored = current_sources(con)
    base = [r for r in catalog if not r.get('_archive_recording')]
    base_ids = {r['id'] for r in base}
    base_resources = {drive_resource(l['url']) for r in base for l in r['links']} - {None}
    aliases = {a['resource_id']: resource for resource, source in stored.items()
               for a in source['archive']['aliases']}
    materials = {source['material_id']: resource for resource, source in stored.items()}
    for source in data['sources']:
        if not source['resource_id'].startswith('drive:'):
            continue
        resource, identity = source['resource_id'], source['material_id']
        ids = {a['resource_id'] for a in source['archive']['aliases']}
        if identity in base_ids or ids & base_resources:
            raise ValueError('Archive registration cannot replace a legacy catalog/source binding')
        if identity in materials and materials[identity] != resource:
            raise ValueError('Archive material already belongs to another source')
        if any(a in aliases and aliases[a] != resource for a in ids):
            raise ValueError('Drive alias already belongs to another archive source')
        old = stored.get(resource)
        fingerprint = digest(source)
        if old == source:
            continue
        if old:
            if source['material_id'] != old['material_id'] or source['content_revision'] <= old['content_revision']:
                raise ValueError('Archive source changes require its stable material and a greater revision')
            old_ids = {a['resource_id'] for a in old['archive']['aliases']}
            if not old_ids <= ids:
                raise ValueError('Archive source cannot erase original aliases')
            old_aliases = {a['resource_id']: a for a in old['archive']['aliases']}
            if any((a['original_sha256'], a['original_bytes']) !=
                   (old_aliases[a['resource_id']]['original_sha256'], old_aliases[a['resource_id']]['original_bytes'])
                   for a in source['archive']['aliases'] if a['resource_id'] in old_aliases):
                raise ValueError('Original archive bytes are immutable')
            if any(source['archive'][key] != old['archive'][key] for key in
                   ('collection_id', 'cohort', 'pcm_sha256', 'pcm_seconds',
                    'paired_asr_sha256', 'provenance_sha256', 'quarantine_sha256')):
                raise ValueError('Original audio/PCM/paired ASR lineage is immutable; pin a corrected pair separately')
            if not set(old['archive']['source_warnings']) <= set(source['archive']['source_warnings']):
                raise ValueError('Archive source cannot erase inherited diagnostic warnings')
        payload = canonical(source)
        con.execute('INSERT INTO archive_source_versions VALUES (?,?,?,?)',
                    (resource, source['content_revision'], fingerprint, payload))
        con.execute('INSERT OR REPLACE INTO archive_sources VALUES (?,?,?,?,?)',
                    (resource, identity, source['content_revision'], fingerprint, payload))
        stored[resource] = source
        aliases.update({a: resource for a in ids})
        materials[identity] = resource
    return stored


def validate_sources(data, catalog, current, archive, legacy_validate):
    legacy = dict(data, sources=[s for s in data['sources'] if not s['resource_id'].startswith('drive:')])
    legacy_validate(legacy, catalog, current)
    for source in data['sources']:
        if not source['resource_id'].startswith('drive:'):
            continue
        if archive.get(source['resource_id']) != source:
            raise ValueError('Archive source revision or provenance pins changed')
        matches = [r for r in catalog if r['id'] == source['material_id']]
        expected = {a['resource_id'] for a in source['archive']['aliases']}
        if (len(matches) != 1 or matches[0]['title'] != source['expected_title'] or
                {drive_resource(l['url']) for l in matches[0]['links']} != expected):
            raise ValueError('Archive source does not match its additive catalog')
