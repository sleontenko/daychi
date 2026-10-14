import asyncio
import json
import time
import sqlite3

import httpx2 as httpx
import pytest
from fastapi.testclient import TestClient

from practice_api.daychee_app import create_daychee_app
from practice_api.admin import password_hash
from practice_api.invitations import Invitations
from practice_api.wiki_app import WikiSettings
from practice_api.wiki_content import Batch
from practice_api.wiki_article_models import ArticleBatch
from practice_api.web_wiki_session import cabinet_web_session_check, SessionResult, SESSION_URL
from tests.test_wiki_content import payload
from tests.test_wiki_articles import article_payload

COOKIE = {'Cookie': 'session=synthetic-browser-session'}
RENEWAL = 'session=synthetic-renewed; Domain=xuanxue.su; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=3600'


def fixture(tmp_path, monkeypatch, check, profile='production'):
    monkeypatch.setenv('DAYCHEE_PUBLIC_WIKI_ENABLED', '1')
    monkeypatch.setenv('DAYCHEE_WIKI_ARTICLES_ENABLED', '1')
    monkeypatch.setenv('DAYCHEE_ADMIN_PASSWORD_HASH', password_hash('synthetic-owner-password'))
    monkeypatch.setenv('DAYCHEE_PUBLIC_ORIGIN', 'https://backend.test')
    raw = [{'id': f'fixture:{i}', 'title': 'Урок', 'source_timestamp_ms': i + 1, 'source_date_label': 'Дата',
            'category_id': 'test', 'category_name': 'Раздел', 'subtopic': '', 'subtopic_key': '',
            'source_text': 'Описание Код доступа: secret-zoom',
            'links': [{'url': f'https://youtu.be/{r}', 'type': 'video', 'label': 'Видео'},
                      {'url': 'https://us02web.zoom.us/j/123?pwd=secret-zoom', 'type': 'zoom', 'label': 'Zoom'}]}
           for i, r in enumerate(('abcdefghijk', 'otherid1234'))]
    index = tmp_path/'index.json'; index.write_text(json.dumps(raw))
    store = Invitations(tmp_path/'access.sqlite3')
    app = create_daychee_app(WikiSettings(index, tmp_path/'wiki.sqlite3', '', ''), store,
                            tmp_path/'zoom.json', web_session_check=check, web_session_profile=profile)
    rows = app.state.wiki_catalog(); ids = tuple(r['id'] for r in rows)
    app.state.wiki_content.import_batch(Batch(batch_id='sources', records=[payload(), payload('otherid1234')]), rows)
    app.state.wiki_articles.import_batch(ArticleBatch(**article_payload(ids)), rows)
    return app, ids, store


def test_each_read_rechecks_and_only_current_success_serves_recordings(tmp_path, monkeypatch):
    states = [204, 401, 403, 503, 204]; calls = []
    async def check(value):
        calls.append(value); return SessionResult(states.pop(0))
    app, ids, _ = fixture(tmp_path, monkeypatch, check)
    client = TestClient(app, base_url='https://wiki.xuanxue.su')
    for status in (200, 401, 403, 503, 200):
        r = client.get('/api/wiki/materials/'+ids[0], headers=COOKIE)
        assert r.status_code == status and r.headers['cache-control'] == 'no-store'
        assert ('youtu.be/abcdefghijk' in r.text) is (status == 200)
        assert 'secret-zoom' not in r.text and 'zoom_password' not in r.text
    assert len(calls) == 5 and not states


def test_all_anonymous_reader_aliases_closed_and_native_owner_scopes_independent(tmp_path, monkeypatch):
    calls = []
    async def check(value): calls.append(value); return SessionResult(204)
    app, ids, store = fixture(tmp_path, monkeypatch, check)
    wiki = TestClient(app, base_url='https://wiki.xuanxue.su')
    backend = TestClient(app, base_url='https://backend.test')
    token = store.redeem(store.issue()[1])
    bearer = {'Authorization': 'Bearer '+token, 'X-Daychee-Native': '1'}
    paths = [r.path.replace('{material_id}', ids[0]).replace('{concept_id}', 'fixture-topic')
             for r in app.routes if r.path.startswith(('/api/wiki/', '/api/public/wiki/')) and 'GET' in (r.methods or set())]
    for path in paths:
        assert wiki.get(path, headers=bearer).status_code == 401
        if path.startswith('/api/public/'):
            assert backend.get(path, headers=bearer).status_code == 401
    assert not calls
    private = backend.get('/api/wiki/materials/'+ids[0], headers=bearer)
    assert private.status_code == 200 and 'secret-zoom' in private.text
    assert backend.get('/api/admin/wiki/articles/sources', headers=COOKIE).status_code == 401
    assert wiki.get('/api/admin/wiki/articles/sources', headers=COOKIE).status_code == 404
    assert wiki.get('/api/access/zoom', headers=COOKIE).status_code == 404
    assert wiki.post('/api/access/redeem-code', json={'code':'fake'}).status_code == 404
    assert wiki.post('/api/wiki/logout', headers=COOKIE).status_code == 405
    assert not calls


def test_private_articles_and_public_projection_redaction_preserved(tmp_path, monkeypatch):
    async def check(value): return SessionResult(204, RENEWAL)
    app, ids, _ = fixture(tmp_path, monkeypatch, check)
    client = TestClient(app, base_url='https://wiki.xuanxue.su')
    for path in ('graph?articles=1', 'articles/materials/'+ids[0], 'articles/concepts/fixture-topic'):
        r = client.get('/api/wiki/'+path, headers=COOKIE)
        assert r.status_code == 200 and r.headers.get_list('set-cookie') == [RENEWAL]
    for path in ('graph?articles=1', 'recent?articles=1', 'articles/materials/'+ids[0], 'articles/concepts/fixture-topic'):
        r = client.get('/api/public/wiki/'+path, headers=COOKIE)
        assert r.status_code == 200 and 'abcdefghijk' not in r.text and 'resource_id' not in r.text
    assert client.get('/api/wiki/session', headers=COOKIE).status_code == 204
    page = client.get('/wiki')
    assert page.status_code == 200 and 'data-cabinet-web="1"' in page.text and ids[0] not in page.text
    assert client.get('/', follow_redirects=False).headers['location'] == '/wiki'


@pytest.mark.parametrize('raw', ['session=a; session=b', 'session=a; session=a', 'session=', 'session',
                               'session="quoted"', 'session=bad value'])
def test_missing_or_ambiguous_cookie_never_calls_provider(tmp_path, monkeypatch, raw):
    async def unexpected(value): pytest.fail('Invalid session forwarded')
    app, _, _ = fixture(tmp_path, monkeypatch, unexpected)
    client = TestClient(app, base_url='https://wiki.xuanxue.su')
    assert client.get('/api/wiki/graph', headers={'Cookie':raw}).status_code == 401
    assert client.get('/api/wiki/graph', headers=[('Cookie','session=a'),('Cookie','session=b')]).status_code == 401


@pytest.mark.parametrize('status', [200, 302, 429, 500, 503])
def test_provider_bad_status_never_authorizes_or_follows_redirect(status, caplog):
    seen = []
    def provider(request):
        seen.append(request)
        assert str(request.url) == SESSION_URL and request.method == 'GET' and not request.content
        assert request.headers.get('cookie') == 'session=synthetic-browser-session'
        assert 'authorization' not in request.headers
        return httpx.Response(status, json={'private':'not forwarded'}, headers={'Cache-Control':'no-store','Location':'https://evil.test'})
    result = asyncio.run(cabinet_web_session_check(transport=httpx.MockTransport(provider))('synthetic-browser-session'))
    assert result.status == 503 and len(seen) == 1 and result.renewal is None
    assert 'synthetic-browser-session' not in caplog.text


@pytest.mark.parametrize('renewal', [RENEWAL.replace('; Secure',''), RENEWAL.replace('xuanxue.su','evil.test'),
                                  RENEWAL.replace('Path=/','Path=/wiki'), RENEWAL.replace('Lax','None'),
                                  RENEWAL.replace('Max-Age=3600','Max-Age=0'), RENEWAL+'; Domain=xuanxue.su'])
def test_invalid_renewal_is_integration_failure(renewal):
    transport = httpx.MockTransport(lambda r:httpx.Response(204,headers={'Cache-Control':'no-store','Set-Cookie':renewal}))
    assert asyncio.run(cabinet_web_session_check(transport=transport)('synthetic')).status == 503


def test_valid_renewal_and_refusal_never_issue_unrelated_or_expiration_cookies():
    for status in (204, 401, 403):
        response = httpx.Response(status,headers=[('Cache-Control','private,no-store'),('Set-Cookie',RENEWAL),('Set-Cookie','other=private')])
        result = asyncio.run(cabinet_web_session_check(transport=httpx.MockTransport(lambda r:response))('synthetic'))
        assert result.status == status
        assert result.renewal == (RENEWAL if status == 204 else None)
        assert 'synthetic-renewed' not in repr(result)


def test_nonempty_success_and_transport_exception_are_temporary():
    for mode in ('body', 'exception', 'no-store', 'duplicate-renewal'):
        def provider(request):
            if mode == 'exception': raise httpx.ReadTimeout('synthetic-cookie', request=request)
            headers = [('Cache-Control', 'no-store')]
            if mode == 'no-store': headers = []
            if mode == 'duplicate-renewal': headers += [('Set-Cookie', RENEWAL), ('Set-Cookie', RENEWAL)]
            return httpx.Response(204, content=b'not empty' if mode == 'body' else b'',headers=headers)
        assert asyncio.run(cabinet_web_session_check(transport=httpx.MockTransport(provider))('synthetic')).status == 503


def test_total_deadline_cancels_slow_provider_without_retry():
    calls = []
    async def provider(request):
        calls.append(request)
        await asyncio.sleep(6)
        return httpx.Response(204, headers={'Cache-Control': 'no-store'})
    start = time.monotonic()
    result = asyncio.run(cabinet_web_session_check(transport=httpx.MockTransport(provider))('synthetic'))
    assert result.status == 503 and len(calls) == 1 and time.monotonic() - start < 5.8


def test_multiple_readers_only_forward_their_cookie_and_create_no_wiki_sessions(tmp_path, monkeypatch):
    seen = []
    async def check(value): seen.append(value); return SessionResult(204)
    app, ids, _ = fixture(tmp_path, monkeypatch, check)
    client = TestClient(app, base_url='https://wiki.xuanxue.su')
    for value in ('reader-a', 'reader-b', 'reader-a'):
        assert client.get('/api/wiki/materials/'+ids[0], headers={'Cookie':'other=not-forwarded; session='+value}).status_code == 200
    assert seen == ['reader-a', 'reader-b', 'reader-a']
    with sqlite3.connect(tmp_path/'wiki.sqlite3') as db:
        assert db.execute('SELECT count(*) FROM sessions').fetchone()[0] == 0
    assert client.get('/api/wiki/graph', headers=[('Host','wiki.xuanxue.su'),('Host','other.test')]).status_code == 400


@pytest.mark.parametrize('profile', ['production', 'staging'])
def test_fixed_environment_only_active_cookie_and_renewal(tmp_path, monkeypatch, profile):
    from practice_api.web_wiki_session import PROFILES
    active = PROFILES[profile]
    other = PROFILES['staging' if profile == 'production' else 'production']
    calls = []
    renewal = f'{active.cookie_name}=renewed; Domain={active.cookie_domain}; Path=/; Secure; HttpOnly; SameSite=Lax'
    async def provider(request):
        calls.append(request)
        assert str(request.url) == active.cabinet_origin + '/api/auth/session'
        assert request.headers['cookie'] == active.cookie_name + '=own'
        assert 'authorization' not in request.headers and not request.content
        return httpx.Response(204, headers={'Cache-Control':'no-store','Set-Cookie':renewal})
    check = cabinet_web_session_check(profile=profile, transport=httpx.MockTransport(provider))
    app, ids, _ = fixture(tmp_path, monkeypatch, check, profile)
    client = TestClient(app, base_url='https://' + active.wiki_host)
    path = '/api/wiki/articles/materials/' + ids[0]
    assert client.get(path, headers={'Cookie':other.cookie_name+'=other'}).status_code == 401
    assert not calls
    for cookie in (f'{active.cookie_name}=own; {other.cookie_name}=other', f'{other.cookie_name}=other; {active.cookie_name}=own',
                   f'{active.cookie_name}=own; {other.cookie_name}=one; {other.cookie_name}=two'):
        response = client.get(path, headers={'Cookie':cookie})
        assert response.status_code == 200 and response.headers.get_list('set-cookie') == [renewal]
    assert len(calls) == 3
    assert client.get(path, headers={'Cookie':f'{active.cookie_name}=own; {active.cookie_name}=duplicate'}).status_code == 401
    assert len(calls) == 3
    assert TestClient(app, base_url='https://'+other.wiki_host).get(path, headers={'Cookie':active.cookie_name+'=own'}).status_code == 404
    assert len(calls) == 3
    page = client.get('/wiki')
    assert f'data-cabinet-profile="{profile}"' in page.text


@pytest.mark.parametrize('profile', ['production', 'staging'])
def test_cross_environment_relabel_and_wrong_renewal_refuse(profile):
    from practice_api.web_wiki_session import PROFILES
    active = PROFILES[profile]
    other = PROFILES['staging' if profile == 'production' else 'production']
    async def rejecting_provider(request):
        return httpx.Response(401, headers={'Cache-Control':'no-store'})
    assert asyncio.run(cabinet_web_session_check(profile=profile, transport=httpx.MockTransport(rejecting_provider))('other-env-token')).status == 401
    async def wrong_domain(request):
        return httpx.Response(204, headers={'Cache-Control':'no-store','Set-Cookie':f'{active.cookie_name}=renewed; Domain={other.cookie_domain}; Path=/; Secure; HttpOnly; SameSite=Lax'})
    assert asyncio.run(cabinet_web_session_check(profile=profile, transport=httpx.MockTransport(wrong_domain))('own')).status == 503
    async def inactive_renewal(request):
        return httpx.Response(204, headers={'Cache-Control':'no-store','Set-Cookie':f'{other.cookie_name}=ignored; Domain={other.cookie_domain}; Path=/; Secure; HttpOnly; SameSite=Lax'})
    result = asyncio.run(cabinet_web_session_check(profile=profile, transport=httpx.MockTransport(inactive_renewal))('own'))
    assert result.status == 204 and result.renewal is None


def test_runtime_requires_explicit_profile_and_no_browser_switch(tmp_path, monkeypatch):
    monkeypatch.setenv('DAYCHI_WEB_CABINET_ENABLED', '1')
    monkeypatch.delenv('DAYCHI_WEB_CABINET_PROFILE', raising=False)
    with pytest.raises(ValueError, match='Explicit'):
        create_daychee_app(WikiSettings(tmp_path/'index.json',tmp_path/'wiki.sqlite3','',''), Invitations(tmp_path/'access.sqlite3'))
    with pytest.raises(ValueError, match='Explicit'):
        cabinet_web_session_check(profile='https://evil.test')


def test_renewal_domain_rejects_multiple_leading_dots():
    from practice_api.web_wiki_session import renewal_cookie
    with pytest.raises(ValueError):
        renewal_cookie([RENEWAL.replace('Domain=xuanxue.su','Domain=..xuanxue.su')])


@pytest.mark.parametrize('profile,alias', [('production','app.xuanxue.su'),('production','daychee-api-production.up.railway.app'),('staging','staging-reader.test')])
def test_web_entry_alias_redirects_fixed_profile_without_authority(tmp_path, monkeypatch, profile, alias):
    from practice_api.web_wiki_session import PROFILES
    calls=[]
    async def check(v): calls.append(v); return SessionResult(204)
    app, _, _ = fixture(tmp_path, monkeypatch, check, profile)
    client=TestClient(app,base_url='https://'+alias)
    for path in ('/wiki','/wiki/graph'):
        response=client.get(path+'?q=%D1%82&returnTo=https%3A%2F%2Fevil.test',follow_redirects=False,headers={'Cookie':'session=ignored'})
        assert response.status_code==307 and response.headers['cache-control']=='no-store'
        assert response.headers['location']=='https://'+PROFILES[profile].wiki_host+path+'?q=%D1%82&returnTo=https%3A%2F%2Fevil.test'
        assert not response.headers.get_list('set-cookie')
    assert not calls
    wiki=TestClient(app,base_url='https://'+PROFILES[profile].wiki_host)
    assert 'href="https://app.xuanxue.su/"' in wiki.get('/wiki').text


def test_homepage_public_preview_and_protected_readers_preserve_public_release(tmp_path, monkeypatch):
    app, _, store=fixture(tmp_path,monkeypatch,lambda _:None)
    client=TestClient(app,base_url='https://app.xuanxue.su')
    page=client.get('/')
    assert page.status_code==200 and 'https://app.xuanxue.su/wiki#view=graph' in page.text
    assert 'https://app.xuanxue.su/downloads/daychee-android.apk?v=4' in page.text
    assert 'daychee-1.0.0-4.apk' in page.text and 'iPhone и iPad' in page.text
    assert '/api/public/wiki/' not in page.text and 'Загружаем граф' in page.text
    assert 'class="graph-preview-link"' in page.text
    script=client.get('/website-assets/site.js')
    assert script.status_code==200 and "fetch('/api/site/wiki-graph'" in script.text
    assert '/api/public/wiki/' not in script.text and "credentials:'omit'" in script.text
    assert client.get('/api/public/wiki/graph').status_code==401
    token=store.redeem(store.issue()[1])
    session=client.get('/api/access/session',headers={'Authorization':'Bearer '+token})
    assert session.status_code==200 and session.json()==store.session_details(token)
    assert client.get('/api/access/zoom').status_code==401


@pytest.mark.parametrize('status', [401, 403, 503])
def test_preview_is_anonymous_geometry_only_without_provider_or_query_escalation(tmp_path, monkeypatch, status):
    calls=[]
    async def check(v): calls.append(v); return SessionResult(status)
    app, ids, _=fixture(tmp_path,monkeypatch,check)
    client=TestClient(app,base_url='https://app.xuanxue.su')
    response=client.get('/api/site/wiki-graph?articles=1&semantics=1',headers=COOKIE)
    assert response.status_code==200 and response.headers['cache-control']=='no-store'
    assert not calls and not response.headers.get_list('set-cookie')
    graph=response.json()
    assert set(graph)=={'sections','nodes','edges'}
    assert graph==client.get('/api/site/wiki-graph').json()
    for forbidden in (*ids,'abcdefghijk','otherid1234','secret-zoom','https://','Урок','Описание','fixture-topic'):
        assert forbidden not in response.text
    assert all(set(s)=={'id','name','count'} for s in graph['sections'])
    assert all(set(n)=={'id','sec','type','label'} for n in graph['nodes'])
    assert all(n['label']=='' for n in graph['nodes'] if n['type']!='section')
    node_ids={n['id'] for n in graph['nodes']}
    section_ids={s['id'] for s in graph['sections']}
    assert all(n['sec'] in section_ids for n in graph['nodes'])
    assert all(e['s'] in node_ids and e['t'] in node_ids and e['k'] in ('structure','series') for e in graph['edges'])
    assert sum(s['count'] for s in graph['sections'])==len(ids)
    for path in ('/api/public/wiki/graph','/api/public/wiki/materials/'+ids[0]):
        assert client.get(path).status_code==401
    wiki=TestClient(app,base_url='https://wiki.xuanxue.su')
    assert wiki.get('/api/site/wiki-graph').status_code==404
    assert wiki.get('/api/wiki/materials/'+ids[0]).status_code==401
    assert not calls
