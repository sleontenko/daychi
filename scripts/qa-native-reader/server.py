"""Loopback synthetic mounted consumer fixture; never a deployed Cabinet proof."""
import os
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
journal = []
patch = pytest.MonkeyPatch()
root = Path(tempfile.mkdtemp(prefix='daychi-reader-synthetic-'))

def provider(request):
    if request.headers.get('authorization') != 'Bearer ' + TOKEN or mode == 'invalid':
        return httpx.Response(401, json={'error': 'invalid_token'})
    if mode == 'blocked': return httpx.Response(403, json={'error': 'account_blocked'})
    if mode == 'limited': return httpx.Response(429, json={'error': 'rate_limited'}, headers={'Retry-After': '7'})
    if mode == 'offline': return httpx.Response(503, json={'error': 'temporarily_unavailable'})
    return httpx.Response(200, json=PROFILE)

_, app, ids, invitations = fixture(root, patch, provider)
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


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='127.0.0.1', port=8102, access_log=False)
