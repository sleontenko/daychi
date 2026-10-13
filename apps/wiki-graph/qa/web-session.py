"""Disposable browser QA only. Reserved localhost origins, synthetic DTOs/provider.

Not a production login/provider. Run from repo root; never use real cookies/data.
"""
import asyncio
import json
import os
from pathlib import Path

import httpx2 as httpx
from fastapi import FastAPI, Request
from starlette.responses import FileResponse, JSONResponse, RedirectResponse, Response

from practice_api.web_wiki_session import WebWikiBoundary, cabinet_web_session_check, web_profile

ROOT = Path(__file__).resolve().parents[3]
DATA = json.loads(Path(__file__).with_name('articles-v1.json').read_text())
PROFILE = os.getenv('QA_WEB_PROFILE', 'production')
ACTIVE = web_profile(PROFILE)
state = {'value': 'ok', 'checks': 0}
api = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)


@api.post('/api/access/redeem-code')
async def reference_login():
    return {'token': 'synthetic-reference-only'}


@api.get('/{path:path}')
async def fixture(request: Request, path: str):
    if path == 'qa/login':
        state['value'] = 'ok'
        response = RedirectResponse('/wiki')
        response.set_cookie(ACTIVE.cookie_name, 'synthetic-qa-browser', httponly=True, samesite='lax')
        return response
    if path == 'qa/state':
        value = request.query_params.get('value', 'ok')
        if value not in ('ok', 'invalid', 'blocked', 'unavailable', 'delay', 'profile'):
            return Response(status_code=400)
        state['value'] = value
        return {'state': value, 'checks': state['checks']}
    if path == 'api/wiki/graph':
        return JSONResponse(DATA['graph'], headers={'Cache-Control': 'no-store'})
    if path.startswith('api/wiki/articles/'):
        group = 'concepts' if '/concepts/' in path else 'articles'
        row = DATA[group].get(path.split('/')[-1])
        return JSONResponse(row or {}, status_code=200 if row else 404)
    if path.startswith('api/wiki/materials/'):
        row = next((r for r in DATA['materials'] if r['id'] == path.split('/')[-1]), None)
        return JSONResponse(row or {}, status_code=200 if row else 404)
    if path in ('wiki', 'wiki/graph'):
        return FileResponse(ROOT/'data/web-cabinet-qa/baseline/index.html')
    if path.startswith('wiki-graph-assets/') and path.split('/')[-1] in ('graph.js', 'graph.css'):
        folder = ROOT/'data/web-cabinet-qa/baseline' if request.headers.get('host', '').startswith('daychi-web-reference.') else ROOT/'practice_api/wiki_graph_web'
        return FileResponse(folder/path.split('/')[-1])
    return Response(status_code=404)


async def provider(request):
    state['checks'] += 1
    if state['value'] == 'delay': await asyncio.sleep(2)
    status = {'invalid': 401, 'blocked': 403, 'unavailable': 503, 'profile': 200}.get(state['value'], 204)
    return httpx.Response(status, headers={'Cache-Control': 'no-store'},
                          json={'account': {'status': 'active'}} if status == 200 else None)


protected = WebWikiBoundary(api, check=cabinet_web_session_check(profile=PROFILE, transport=httpx.MockTransport(provider)), profile=PROFILE)


async def app(scope, receive, send):
    # Server-side fixture binding only, never a production client/native header.
    if scope['type'] == 'http':
        host = next((v.decode() for k, v in scope['headers'] if k == b'host'), '')
        if host.startswith('daychi-web-reference.') or scope['path'].startswith('/qa/'):
            return await api(scope, receive, send)
        scope = {**scope, 'headers': [(k, v) for k, v in scope['headers'] if k != b'host'] + [(b'host', ACTIVE.wiki_host.encode())]}
    return await protected(scope, receive, send)
