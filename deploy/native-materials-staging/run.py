"""Disposable native-content staging; synthetic data, real fixed Cabinet checks.

No HTTP mutation, credential injection, service secret or authentication bypass.
The application modules are unchanged from Daychi PR18 bb7295f.
"""
import json
import os
import sqlite3
import sys
from pathlib import Path

SOURCE = 'bb7295f824909029ed8a39eb1a12822f662f012d'
FIXTURE = Path(__file__).with_name('fixture.json')
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))


def configure(folder):
    """Use only this ephemeral fixture directory, never the default repo data."""
    folder.mkdir(parents=True, mode=0o700, exist_ok=True)
    os.environ.update({
        'DAYCHI_NATIVE_CABINET_ENABLED': '1',
        'DAYCHI_NATIVE_CABINET_PROFILE': 'staging',
        'DAYCHI_WEB_CABINET_ENABLED': '0',
        'DAYCHEE_PUBLIC_WIKI_ENABLED': '0',
        'DAYCHEE_WIKI_ARTICLES_ENABLED': '1',
        'DAYCHEE_WIKI_SEMANTICS_ENABLED': '1',
        'DAYCHEE_PUBLIC_PAGES_ENABLED': '0',
        'DAYCHEE_ACCESS_REQUESTS_ENABLED': '0',
        'DAYCHEE_DATA_DELETION_ENABLED': '0',
        'DAYCHEE_RETENTION_ENABLED': '0',
        'WIKI_INDEX': str(folder / 'index.json'),
        'WIKI_DATABASE': str(folder / 'wiki.sqlite3'),
        'DAYCHEE_ACCESS_DATABASE': str(folder / 'access.sqlite3'),
        'DAYCHEE_ZOOM': str(folder / 'zoom.json'),
    })
    for name in ('WIKI_USERNAME', 'WIKI_PASSWORD', 'DAYCHEE_ADMIN_PASSWORD_HASH',
                 'DAYCHEE_ADMIN_PASSWORD', 'WIKI_ORIGINS'):
        os.environ.pop(name, None)


class ReadOnlyNativeSurface:
    """Keep the disposable service's public surface to health and native reads."""
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope['type'] == 'http':
            path = scope.get('path', '')
            native = path == '/api/native/wiki' or path.startswith('/api/native/wiki/')
            if scope.get('method') != 'GET' or not (path == '/health' or native):
                from starlette.responses import JSONResponse
                return await JSONResponse({'detail': 'Not found'}, 404, headers={
                    'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow',
                })(scope, receive, send)
        await self.app(scope, receive, send)


def create_fixture_app(folder, *, check=None):
    configure(folder)
    fixture = json.loads(FIXTURE.read_text(encoding='utf-8'))
    if fixture['source'] != SOURCE or fixture['format'] != 'daychi-native-staging-fixture/1':
        raise ValueError('Unexpected staging fixture')
    (folder / 'index.json').write_text(json.dumps(fixture['index'], ensure_ascii=False), encoding='utf-8')
    (folder / 'zoom.json').write_text('[]', encoding='utf-8')
    # Stable synthetic IDs survive every restart of this disposable service.
    with sqlite3.connect(folder / 'wiki.sqlite3') as con:
        con.execute('CREATE TABLE IF NOT EXISTS identities (source TEXT PRIMARY KEY, id TEXT NOT NULL)')
        con.executemany('INSERT OR REPLACE INTO identities VALUES (?,?)',
                        [(row['id'], identity) for row, identity in
                         zip(fixture['index'], fixture['material_ids'])])
    from practice_api.daychee_app import create_daychee_app
    from practice_api.wiki_content import Batch
    from practice_api.wiki_article_models import ArticleBatch
    from practice_api.wiki_semantics import SemanticBatch
    app = create_daychee_app(native_session_check=check, native_session_profile='staging')
    rows = app.state.wiki_catalog()
    app.state.wiki_content.import_batch(Batch(**fixture['content']), rows)
    app.state.wiki_semantics.import_batch(SemanticBatch(**fixture['semantics']), rows)
    app.state.wiki_articles.import_batch(ArticleBatch(**fixture['articles']), rows)
    for path in folder.iterdir():
        if path.is_file():
            path.chmod(0o600)
    return ReadOnlyNativeSurface(app)


if __name__ == '__main__':
    os.umask(0o077)
    folder = Path('/data/daychi-native-staging')
    folder.mkdir(parents=True, mode=0o700, exist_ok=True)
    if os.getuid() == 0:
        folder.chown(10001, 10001)
        os.setgroups([])
        os.setgid(10001)
        os.setuid(10001)
    app = create_fixture_app(folder)
    print(json.dumps({'event': 'native_staging_ready', 'product_source': SOURCE,
                      'fixture': 'synthetic-v1', 'materials': 2, 'concepts': 1,
                      'profile': 'staging', 'uid': os.getuid(),
                      'native_routes': list(app.app.state.native_content_routes)}), flush=True)
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=int(os.getenv('PORT', '8080')),
                workers=1, access_log=False, proxy_headers=False)
