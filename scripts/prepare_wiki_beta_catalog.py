"""Prepare a private, ignored snapshot for the owner's closed TestFlight beta.

No network; reuse API normalization and a temporary copy of the identity database
so existing bookmarks survive. Never commit the generated catalog or publish web builds.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import secrets
import sqlite3
import sys
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
from practice_api.wiki_app import WikiSettings, create_wiki_app


def prepare(index: Path, database: Path, output: Path):
    if not database.is_file():
        raise ValueError('Existing identity database is required to preserve bookmarks')
    with tempfile.TemporaryDirectory() as temp:
        copied = Path(temp) / 'wiki.sqlite3'
        with sqlite3.connect(f'file:{database.resolve()}?mode=ro', uri=True) as source, sqlite3.connect(copied) as target:
            source.backup(target)
        password = secrets.token_urlsafe(32)
        settings = WikiSettings(index.resolve(), copied, 'snapshot-export', password)
        with TestClient(create_wiki_app(settings)) as client:
            response = client.post('/api/wiki/login', json={'username': settings.username, 'password': password})
            response.raise_for_status()
            headers = {'Authorization': 'Bearer ' + response.json()['token']}
            categories = client.get('/api/wiki/categories', headers=headers)
            categories.raise_for_status()
            records = []
            offset = 0
            while True:
                page = client.get('/api/wiki/materials', params={'offset': offset, 'limit': 100}, headers=headers)
                page.raise_for_status()
                for row in page.json()['items']:
                    detail = client.get('/api/wiki/materials/' + row['id'], headers=headers)
                    detail.raise_for_status()
                    records.append(detail.json())
                offset += len(page.json()['items'])
                if offset >= page.json()['total']:
                    break
    payload = {'source_sha256': hashlib.sha256(index.read_bytes()).hexdigest(),
               'categories': categories.json(), 'materials': records}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')))
    os.chmod(output, 0o600)
    print(f'Prepared private catalog: {len(records)} records; {len(payload["categories"])} categories')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--index', type=Path, default=Path('data/nikita-archive/2026-09-19/index.json'))
    parser.add_argument('--database', type=Path, default=Path('data/wiki.sqlite3'))
    parser.add_argument('--output', type=Path, default=Path('apps/practice-app/src/features/wiki/generated/catalog.json'))
    args = parser.parse_args()
    prepare(args.index, args.database, args.output)
