"""a07f087 consumer proof: mounted synthetic HTTP, never live account fixtures."""
import asyncio
import copy
import json
import time

import httpx2 as httpx
import pytest
from fastapi.testclient import TestClient

from practice_api.daychee_app import create_daychee_app
from practice_api.cabinet_session_http import (
    CabinetCredential, NativeSessionResult, native_me_session_validation, MAX_RESPONSE_BYTES,
)
from practice_api.wiki_app import WikiSettings
from tests.test_web_wiki_session import fixture as web_fixture
from practice_api.web_wiki_session import SessionResult

TOKEN = 'synthetic-native-token'
HEADERS = {'Authorization': 'Bearer ' + TOKEN}
PROFILE = {
    'account': {'id': 'synthetic-account', 'name': '', 'roles': [], 'status': 'active',
                'telegramLinked': True, 'botChatActive': False, 'hasEmail': False,
                'googleLinked': False, 'noTelegram': False, 'needsProfile': True,
                'studentMode': False, 'canUseStudentMode': False, 'homeHiddenTiles': []},
    'session': {'id': 'synthetic-grant-123456', 'expires_in': 7776000, 'renew_after': 604801},
}


def fixture(tmp_path, monkeypatch, handler, *, timeout=5, issuer='https://staging.xuanxue.su'):
    async def browser(_): return SessionResult(204)
    _, ids, store = web_fixture(tmp_path, monkeypatch, browser, 'staging')
    check = native_me_session_validation(issuer, timeout_seconds=timeout,
                                         transport=httpx.MockTransport(handler))
    app = create_daychee_app(WikiSettings(tmp_path/'index.json', tmp_path/'wiki.sqlite3', '', ''),
                            store, tmp_path/'zoom.json', native_session_check=check,
                            native_session_profile='staging' if 'staging' in issuer else 'production',
                            web_session_check=browser, web_session_profile='staging')
    return TestClient(app, base_url='https://backend.test'), app, ids, store


def success(_): return httpx.Response(200, json=PROFILE)


@pytest.mark.parametrize('staff', [False, True])
def test_C01_C15_C16_every_mounted_alias_and_legacy_coexistence(tmp_path, monkeypatch, staff):
    seen = []
    profile = copy.deepcopy(PROFILE)
    if staff: profile['account']['roles'] = ['teacher']
    profile['account']['unknownExtension'] = {'ignored': True}
    def provider(request):
        seen.append(request)
        assert str(request.url) == 'https://staging.xuanxue.su/api/auth/native/me'
        assert request.headers.get_list('authorization') == ['Bearer ' + TOKEN]
        assert 'cookie' not in request.headers and 'x-grant-id' not in request.headers
        assert not request.content
        return httpx.Response(200, json=profile, headers={'Set-Cookie': 'must-not-relay=profile'})
    client, app, ids, store = fixture(tmp_path, monkeypatch, provider)
    assert len(app.state.native_content_routes) == 9
    statuses = []
    for route in app.state.native_content_routes:
        path = route.replace('{material_id}', ids[0]).replace('{concept_id}', 'fixture-topic')
        response = client.get(path, headers={**HEADERS, 'Cookie': 'session_staging=ignored'})
        statuses.append(response.status_code)
        assert response.status_code in (200, 404)  # Missing synthetic optional concept, still checked.
        assert response.headers['cache-control'] == 'no-store'
        assert not response.headers.get_list('set-cookie')
        assert TOKEN not in response.text and 'synthetic-account' not in response.text
        assert 'secret-zoom' not in response.text and 'zoom_password' not in response.text
    assert len(seen) == len(statuses)
    material = client.get('/api/native/wiki/materials/' + ids[0], headers=HEADERS)
    assert material.status_code == 200 and 'youtu.be/abcdefghijk' in material.text
    before = len(seen)
    legacy = store.redeem(store.issue()[1])
    old = client.get('/api/wiki/materials/' + ids[0], headers={'Authorization': 'Bearer ' + legacy})
    assert old.status_code == 200 and 'secret-zoom' in old.text and len(seen) == before
    assert client.get('/api/access/zoom', headers=HEADERS).status_code == 401
    assert client.get('/api/admin/wiki/articles/sources', headers=HEADERS).status_code == 401
    for host in ('wiki.staging.xuanxue.su', 'wiki.xuanxue.su'):
        with TestClient(app, base_url='https://' + host) as wiki:
            assert wiki.get('/api/native/wiki/materials/' + ids[0], headers=HEADERS).status_code == 404
            assert wiki.get('/api/wiki/materials/' + ids[0], headers=HEADERS).status_code == (401 if 'staging' in host else 404)
    assert len(seen) == before


@pytest.mark.parametrize('headers', [
    {}, {'Cookie': 'session_staging=otherwise-valid'}, {'Authorization': 'Bearer '},
    {'Authorization': 'Bearer bad space'}, {'Authorization': 'bearer token'},
    {'Authorization': 'Bearer ' + 'a'*1025},
    [('Authorization', 'Bearer first'), ('Authorization', 'Bearer second')],
])
def test_C02_local_input_never_contacts_cabinet(tmp_path, monkeypatch, headers):
    def forbidden(_): pytest.fail('Unexpected provider request')
    client, _, ids, _ = fixture(tmp_path, monkeypatch, forbidden)
    r = client.get('/api/native/wiki/materials/' + ids[0], headers=headers)
    assert r.status_code == 401 and 'abcdefghijk' not in r.text


def test_C03_C04_C05_current_state_refusal_recovery_and_no_positive_cache(tmp_path, monkeypatch):
    replies = [(200, PROFILE), (401, {'error': 'invalid_token'}),
               (403, {'error': 'account_blocked'}), (200, PROFILE),
               (503, {'error': 'temporarily_unavailable'}), (200, PROFILE)]
    calls = []
    def provider(r):
        calls.append(r)
        status, body = replies.pop(0)
        return httpx.Response(status, json=body)
    client, _, ids, _ = fixture(tmp_path, monkeypatch, provider)
    for expected in (200, 401, 403, 200, 503, 200):
        r = client.get('/api/native/wiki/materials/' + ids[0], headers=HEADERS)
        assert r.status_code == expected
        assert ('youtu.be/abcdefghijk' in r.text) is (expected == 200)
    assert len(calls) == 6 and not replies


@pytest.mark.parametrize('delay,expected', [('7', '7'), ('60', '60'), ('0', '60'),
                                         ('bad', '60'), ('61', '60'), (None, '60')])
def test_C06_rate_delay_is_translated_without_retry(tmp_path, monkeypatch, delay, expected):
    calls = []
    def provider(r):
        calls.append(r)
        return httpx.Response(429, json={'error': 'rate_limited'},
                              headers={} if delay is None else {'Retry-After': delay})
    client, _, ids, _ = fixture(tmp_path, monkeypatch, provider)
    r = client.get('/api/native/wiki/materials/' + ids[0], headers=HEADERS)
    assert r.status_code == 503 and r.headers['retry-after'] == expected
    assert len(calls) == 1 and 'abcdefghijk' not in r.text


@pytest.mark.parametrize('mode', ['500', '503', 'tls', 'connection', 'deadline', 'stream-deadline'])
def test_C07_total_deadline_includes_initial_wait_and_body(tmp_path, monkeypatch, mode):
    calls = []
    class SlowBody(httpx.AsyncByteStream):
        async def __aiter__(self):
            yield b'{'
            await asyncio.sleep(.2)
            yield b'}'
    async def provider(r):
        calls.append(r)
        if mode == 'tls': raise httpx.ConnectError('synthetic sensitive transport detail')
        if mode == 'connection': raise httpx.ConnectTimeout('synthetic detail')
        if mode == 'deadline': await asyncio.sleep(.2)
        if mode == 'stream-deadline':
            return httpx.Response(200, headers={'content-type':'application/json'}, stream=SlowBody())
        return httpx.Response(int(mode) if mode.isdigit() else 200, json=PROFILE)
    client, _, ids, _ = fixture(tmp_path, monkeypatch, provider, timeout=.03)
    started = time.monotonic()
    r = client.get('/api/native/wiki/materials/' + ids[0], headers=HEADERS)
    assert r.status_code == 503 and time.monotonic() - started < .18
    assert len(calls) == 1 and 'abcdefghijk' not in r.text and 'sensitive' not in r.text


@pytest.mark.parametrize('mode', ['redirect', '204', 'html', 'json', 'duplicate', 'oversize', 'nonfinite',
    'no-session', 'bool-expiry', 'bool-renewal', 'expired', 'negative-renewal', 'missing-flag',
    'id', 'grant', 'enum', 'null', 'blocked', 'wrong401', 'wrong403', 'wrong429'])
def test_C08_malformed_success_and_mismatched_refusal_fail_closed(tmp_path, monkeypatch, mode, caplog):
    calls = []
    def provider(r):
        calls.append(r)
        if mode == 'redirect': return httpx.Response(307, headers={'location':'https://evil.invalid/'}, json=PROFILE)
        if mode == '204': return httpx.Response(204)
        if mode == 'html': return httpx.Response(200, text='<html>private contact detail</html>')
        if mode in ('wrong401','wrong403','wrong429'):
            return httpx.Response(int(mode[5:]), json={'error':'unexpected', 'private':'contact'})
        raw = json.dumps(PROFILE)
        if mode == 'json': raw = '{'
        if mode == 'nonfinite': raw = raw[:-1] + ', "extension": NaN}'
        if mode == 'duplicate': raw = raw[:-1] + ', "account": {}}'
        if mode == 'oversize': raw = ' '*(MAX_RESPONSE_BYTES+1) + raw
        if mode in ('json', 'duplicate', 'oversize', 'nonfinite'):
            return httpx.Response(200, content=raw, headers={'content-type':'application/json'})
        p = copy.deepcopy(PROFILE)
        if mode == 'no-session': p.pop('session')
        if mode == 'bool-expiry': p['session']['expires_in'] = True
        if mode == 'bool-renewal': p['session']['renew_after'] = False
        if mode == 'expired': p['session']['expires_in'] = 0
        if mode == 'negative-renewal': p['session']['renew_after'] = -1
        if mode == 'missing-flag': p['account'].pop('telegramLinked')
        if mode == 'id': p['account']['id'] = 'invalid id'
        if mode == 'grant': p['session']['id'] = 'short'
        if mode == 'enum': p['account']['roles'] = ['unknown']
        if mode == 'null': p['account']['name'] = None
        if mode == 'blocked': p['account']['status'] = 'blocked'
        return httpx.Response(200, json=p)
    client, _, ids, _ = fixture(tmp_path, monkeypatch, provider)
    r = client.get('/api/native/wiki/materials/' + ids[0], headers=HEADERS)
    assert r.status_code == 503 and len(calls) == 1
    assert 'abcdefghijk' not in r.text and TOKEN not in caplog.text and 'synthetic-account' not in caplog.text


def test_C13_fixed_issuer_cannot_be_overridden(tmp_path, monkeypatch):
    calls = []
    def provider(r):
        calls.append(r)
        assert str(r.url) == 'https://xuanxue.su/api/auth/native/me'
        return httpx.Response(401, json={'error':'invalid_token'})
    client, _, ids, _ = fixture(tmp_path, monkeypatch, provider, issuer='https://xuanxue.su')
    r = client.get('/api/native/wiki/materials/' + ids[0] + '?issuer=https://evil.invalid',
                   headers={**HEADERS, 'X-Cabinet-Issuer':'https://staging.xuanxue.su'})
    assert r.status_code == 401 and len(calls) == 1


def test_C09_C12_no_claimed_identity_headers_or_consumer_ip_bucket(tmp_path, monkeypatch):
    calls = []
    def provider(r):
        calls.append(r.headers['authorization'])
        assert 'x-grant-id' not in r.headers and 'x-account-id' not in r.headers
        return httpx.Response(429, json={'error':'rate_limited'}, headers={'Retry-After':'1'}) if r.headers['authorization'].endswith('A') else httpx.Response(200,json=PROFILE)
    client, _, ids, _ = fixture(tmp_path, monkeypatch, provider)
    path = '/api/native/wiki/materials/' + ids[0]
    assert client.get(path, headers={'Authorization':'Bearer grant-A','X-Grant-Id':'B'}).status_code == 503
    assert client.get(path, headers={'Authorization':'Bearer grant-B','X-Account-Id':'same'}).status_code == 200
    assert len(calls) == 2
    # The actual grant budget, predecessor sharing and exact boundary C09-C12
    # are provider obligations, not established by this synthetic consumer fixture.


def test_default_off_and_no_native_write_alias(tmp_path, monkeypatch):
    client, app, ids, store = fixture(tmp_path, monkeypatch, success)
    assert client.post('/api/native/wiki/logout',headers=HEADERS).status_code == 405
    assert client.get('/api/native/wiki/access/zoom',headers=HEADERS).status_code == 404
    plain = create_daychee_app(WikiSettings(tmp_path/'index.json',tmp_path/'wiki.sqlite3','',''),store)
    assert TestClient(plain).get('/api/native/wiki/materials/'+ids[0],headers=HEADERS).status_code == 404


def test_every_native_alias_refuses_without_legacy_or_cookie_rescue(tmp_path, monkeypatch):
    calls = []
    def invalid(r):
        calls.append(r)
        return httpx.Response(401, json={'error':'invalid_token'})
    client, app, ids, store = fixture(tmp_path, monkeypatch, invalid)
    legacy = store.redeem(store.issue()[1])
    for route in app.state.native_content_routes:
        path = route.replace('{material_id}', ids[0]).replace('{concept_id}', 'fixture-topic')
        r = client.get(path, headers={'Authorization':'Bearer '+legacy,
                                     'Cookie':'session_staging=synthetic-valid-browser'})
        assert r.status_code == 401 and 'abcdefghijk' not in r.text
        assert r.headers['cache-control'] == 'no-store'
    assert len(calls) == len(app.state.native_content_routes)


@pytest.mark.parametrize('host', ['wiki.xuanxue.su', 'wiki.staging.xuanxue.su',
                                 'WIKI.STAGING.XUANXUE.SU.', 'wiki.xuanxue.su.'])
def test_native_host_guard_without_browser_opt_in(tmp_path, monkeypatch, host):
    async def forbidden(_):
        pytest.fail('Canonical browser host cannot select native authorization')
    monkeypatch.delenv('DAYCHI_WEB_CABINET_ENABLED', raising=False)
    _, _, store = web_fixture(tmp_path, monkeypatch, lambda _: None, 'staging')
    app = create_daychee_app(WikiSettings(tmp_path/'index.json', tmp_path/'wiki.sqlite3', '', ''),
                            store, tmp_path/'zoom.json', native_session_check=forbidden,
                            native_session_profile='staging')
    with TestClient(app, base_url='https://' + host) as client:
        result = client.get('/api/native/wiki/graph', headers=HEADERS)
        assert result.status_code == 404
        assert result.headers['cache-control'] == 'no-store'
