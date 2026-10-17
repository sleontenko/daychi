"""Loopback synthetic mounted consumer fixture; never a deployed Cabinet proof."""
import os
import json
import tempfile
from pathlib import Path
import httpx2 as httpx
import pytest
from fastapi import Request
from fastapi.responses import JSONResponse
from tests.test_native_content import fixture, PROFILE, TOKEN

if os.environ.get('DAYCHI_SYNTHETIC_READER_QA') != '1':
    raise RuntimeError('Synthetic reader fixture requires explicit local opt-in')

mode = 'active'
schedule_mode = 'full'
journal = []
patch = pytest.MonkeyPatch()
root = Path(tempfile.mkdtemp(prefix='daychi-reader-synthetic-'))
checkpoints = []

def provider(request):
    if request.headers.get('authorization') != 'Bearer ' + TOKEN or mode == 'invalid':
        return httpx.Response(401, json={'error': 'invalid_token'})
    if mode == 'blocked': return httpx.Response(403, json={'error': 'account_blocked'})
    if mode == 'limited': return httpx.Response(429, json={'error': 'rate_limited'}, headers={'Retry-After': '7'})
    if mode == 'offline': return httpx.Response(503, json={'error': 'temporarily_unavailable'})
    return httpx.Response(200, json=PROFILE)

_, app, ids, invitations = fixture(root, patch, provider)
# Long synthetic articles exercise real scroll restoration without private content.
from tests.test_wiki_articles import article_payload
from practice_api.wiki_article_models import ArticleBatch
article = article_payload(ids)
article['batch_id'] = 'navigation-long-article'
for index, item in enumerate(article['articles']):
    item['revision'] = 2
    item['sections'].append({'id': 'navigation', 'heading': 'Проверка прокрутки', 'claim_ids': [f'qa-{n}' for n in range(20)]})
    item['claims'].extend({'id': f'qa-{n}', 'text': f'Синтетический абзац {n+1}. Положение чтения должно сохраняться при переходе между экранами приложения.', 'evidence_ids': [f'e{index}']} for n in range(20))
app.state.wiki_articles.import_batch(ArticleBatch(**article), app.state.wiki_catalog())
legacy = invitations.redeem(invitations.issue()[1])

@app.middleware('http')
async def observe(request: Request, call_next):
    response = await call_next(request)
    journal.append({'path': request.url.path, 'status': response.status_code})
    return response

@app.get('/qa/me')
async def me():
    response = provider(httpx.Request('GET', 'https://staging.xuanxue.su/api/auth/native/me', headers={'Authorization': 'Bearer ' + TOKEN}))
    return JSONResponse(response.json(), response.status_code, headers={'Cache-Control': 'no-store', **({'Retry-After': '7'} if mode == 'limited' else {})})

@app.get('/qa/schedule-mode')
async def schedule_state(): return {'mode': schedule_mode}

@app.post('/qa/schedule-mode/{value}')
async def schedule_fixture(value: str):
    global schedule_mode
    if value not in ('full', 'hide-series', 'empty', 'offline'): return JSONResponse({}, 400)
    schedule_mode = value
    return {'mode': value}

@app.post('/qa/mode/{value}')
async def set_mode(value: str):
    global mode
    if value not in ('active', 'invalid', 'blocked', 'limited', 'offline'): return JSONResponse({}, 400)
    mode = value
    return {'mode': mode}

@app.get('/qa/journal')
async def evidence(): return {'mode': mode, 'journal': journal}

@app.get('/qa/legacy')
async def legacy_fixture(): return {'token': legacy}

@app.post('/qa/checkpoint')
async def checkpoint(request: Request):
    value = await request.json()
    checkpoints.append({key: value.get(key) for key in ('hash', 'scroll', 'camera', 'platform', 'epoch', 'resume', 'device')})
    del checkpoints[:-500]
    (root/'navigation-checkpoints.json').write_text(json.dumps(checkpoints))
    return {'ok': True}


if __name__ == '__main__':
    import uvicorn
    print('Synthetic evidence directory:', root, flush=True)
    uvicorn.run(app, host='127.0.0.1', port=8102, access_log=False)
