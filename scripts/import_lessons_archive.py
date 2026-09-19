#!/usr/bin/env python3
"""Read-only archive snapshot. Private output must stay outside version control.

Online: python3 scripts/import_lessons_archive.py --output data/nikita-archive/DATE
Offline: python3 scripts/import_lessons_archive.py --output data/nikita-archive/DATE --offline
Password is prompted (or read from LESSONS_ARCHIVE_PASSWORD), never saved.
Only JSON assignment values are parsed; downloaded JavaScript is never executed.
"""
import argparse
from collections import Counter
from datetime import datetime, timezone
import getpass
import hashlib
import http.cookiejar
import json
import os
from pathlib import Path
import re
import urllib.parse
import urllib.request

ORIGIN = 'https://lessons-archive-production.up.railway.app'


def assignments(source):
    result = {}
    for match in re.finditer(r'window\.(\w+)\s*=\s*', source):
        result[match[1]] = json.JSONDecoder().raw_decode(source[match.end():])[0]
    return result


def save(path, value):
    path.write_text(value, encoding='utf-8')
    path.chmod(0o600)


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def normalize(data):
    hidden = set(data['LESSONS_HIDDEN'])
    rows = [r for r in data['LESSONS'] if r['ts'] not in hidden]
    rows += data['LESSONS_EXTRA']
    categories = {c['id']: c for c in data['LESSONS_META']['categories']}
    categories.update({c['id']: c for c in data.get('CATEGORIES_ALL', [])})
    normalized = []
    for row in rows:
        for key in ('title', 'content', 'ts', 'date', 'cat', 'links', 'types'):
            if key not in row:
                raise ValueError('Missing required archive field: ' + key)
        for link in row['links']:
            if urllib.parse.urlsplit(link['url']).scheme not in ('https', 'http'):
                raise ValueError('Unexpected source link scheme')
        # Base entries have no explicit ID. Keep a deterministic snapshot identity;
        # edits to the link set require reconciliation on a future import.
        identity = str(row['ts']) + '\n' + '\n'.join(sorted(l['url'] for l in row['links']))
        identifier = 'extra:' + row['id'] if row.get('id') else 'base:' + digest(identity)
        clean_title = re.sub(r'код\s*доступа\s*:?\s*\S+', '', row['title'], flags=re.I)
        clean_title = re.sub(r'https?://\S+', '', clean_title).strip(' :–—-')
        normalized.append({
            'id': 'nikita:' + identifier,
            'source': 'nikita_archive',
            'source_timestamp_ms': row['ts'],
            'source_date_label': row['date'],
            'title': clean_title,
            'category_id': row['cat'],
            'category_name': categories.get(row['cat'], {}).get('name', row['cat']),
            'source_categories': row.get('cats', []),
            'subtopic': row.get('sub', ''),
            'subtopic_key': row.get('subKey', ''),
            'level': row.get('level') or None,
            'links': row['links'],
            'source_types': row['types'],
            'source_text': row['content'],
            'source_record': row,
            'access': 'private',
            'duration_seconds': None,
            'transcript_status': 'not_imported',
            'review_status': 'unreviewed',
        })
    return normalized


def run(output, offline=False):
    output.mkdir(parents=True, exist_ok=True)
    output.chmod(0o700)
    if not offline:
        password = os.environ.get('LESSONS_ARCHIVE_PASSWORD') or getpass.getpass('Archive password: ')
        opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        response = opener.open(ORIGIN + '/login', urllib.parse.urlencode({'p': password}).encode(), timeout=30)
        html = response.read().decode('utf-8')
        if 'app/lessons.js' not in html or 'app/extra.js' not in html:
            raise ValueError('Login failed or archive structure changed')
        save(output / 'source.html', html)
        for name in ('lessons.js', 'extra.js'):
            response = opener.open(ORIGIN + '/app/' + name, timeout=30)
            save(output / name, response.read().decode('utf-8'))
    data = {}
    for name in ('lessons.js', 'extra.js'):
        data.update(assignments((output / name).read_text(encoding='utf-8')))
    rows = normalize(data)
    counts = Counter(r['category_name'] for r in rows)
    links = [l['url'] for r in rows for l in r['links']]
    timestamps = [r['source_timestamp_ms'] for r in rows]
    duplicates = Counter(r['id'] for r in rows)
    manifest = {
        'source_url': ORIGIN,
        'processed_at_utc': datetime.now(timezone.utc).isoformat(),
        'source_generated_at': data['LESSONS_META'].get('generated'),
        'base_records': len(data['LESSONS']),
        'extra_records': len(data['LESSONS_EXTRA']),
        'hidden_timestamps': len(data['LESSONS_HIDDEN']),
        'effective_records': len(rows),
        'category_counts': dict(counts),
        'source_type_counts': dict(Counter(t for r in rows for t in r['source_types'])),
        'level_counts': dict(Counter(r['level'] or 'unspecified' for r in rows)),
        'date_range_labels': [min(rows, key=lambda r: r['source_timestamp_ms'])['source_date_label'], max(rows, key=lambda r: r['source_timestamp_ms'])['source_date_label']] if timestamps else [],
        'subtopic_pairs': len({(r['category_id'], r['subtopic_key']) for r in rows if r['subtopic_key']}),
        'link_count': len(links),
        'unique_exact_urls': len(set(links)),
        'duplicate_id_groups': sum(n > 1 for n in duplicates.values()),
        'missing_links': sum(not r['links'] for r in rows),
        'raw_file_sha256': {n: hashlib.sha256((output / n).read_bytes()).hexdigest() for n in ('source.html', 'lessons.js', 'extra.js')},
        'limitations': ['Private index only; media and transcripts not downloaded.', 'External links not verified.', 'Source dates preserved; no schedule-event matching inferred.', 'Base identities depend on timestamp and exact link set; reconcile edits on reimport.'],
    }
    taxonomy = {'categories': []}
    for category_id in sorted({r['category_id'] for r in rows}):
        members = [r for r in rows if r['category_id'] == category_id]
        subs = Counter((r['subtopic_key'], r['subtopic']) for r in members if r['subtopic_key'])
        taxonomy['categories'].append({'id': category_id, 'name': members[0]['category_name'], 'count': len(members), 'subtopics': [{'key': key, 'name': name, 'count': count} for (key, name), count in sorted(subs.items())]})
    for name, value in [('index.json', rows), ('taxonomy.json', taxonomy), ('manifest.json', manifest)]:
        save(output / name, json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--offline', action='store_true')
    args = parser.parse_args()
    run(args.output, args.offline)
