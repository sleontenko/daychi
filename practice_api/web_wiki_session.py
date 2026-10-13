"""Cabinet web-reader boundary, Workshop 25def59e (opt-in cutover only)."""
import asyncio
from dataclasses import dataclass, field
from email.utils import parsedate_to_datetime
from pathlib import Path
import re

import httpx2 as httpx
from starlette.responses import HTMLResponse, JSONResponse, RedirectResponse, Response


@dataclass(frozen=True)
class WebProfile:
    name: str
    cabinet_origin: str
    wiki_host: str
    cookie_name: str
    cookie_domain: str


PROFILES = {
    'production': WebProfile('production', 'https://xuanxue.su', 'wiki.xuanxue.su', 'session', 'xuanxue.su'),
    'staging': WebProfile('staging', 'https://staging.xuanxue.su', 'wiki.staging.xuanxue.su', 'session_staging', 'staging.xuanxue.su'),
}


def web_profile(name):
    if name not in PROFILES:
        raise ValueError('Explicit production/staging web profile required')
    return PROFILES[name]


SESSION_URL = PROFILES['production'].cabinet_origin + '/api/auth/session'
WIKI_HOST = PROFILES['production'].wiki_host
COOKIE_VALUE = re.compile(r'[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]{1,8192}')


@dataclass(frozen=True)
class SessionResult:
    status: int
    renewal: str | None = field(default=None, repr=False)


def session_cookie(headers, *, profile='production'):
    """Read raw fields: framework cookie maps silently choose duplicate values."""
    active = web_profile(profile)
    values = []
    for name, raw in headers:
        if name.lower() != b'cookie':
            continue
        if len(raw) > 16384:
            return None
        for part in raw.decode('latin-1').split(';'):
            key, sep, value = part.strip().partition('=')
            if key == active.cookie_name:
                if not sep or not COOKIE_VALUE.fullmatch(value):
                    return None
                values.append(value)
    return values[0] if len(values) == 1 else None


def renewal_cookie(headers, *, profile='production'):
    active = web_profile(profile)
    sessions = []
    for raw in headers:
        if raw.split('=', 1)[0].strip() != active.cookie_name:
            continue
        if len(raw) > 16384 or '\r' in raw or '\n' in raw:
            raise ValueError('Invalid renewal')
        parts = raw.split(';')
        name, _, value = parts[0].partition('=')
        if name.strip() != active.cookie_name or not COOKIE_VALUE.fullmatch(value):
            raise ValueError('Invalid renewal')
        attrs = {}
        for part in parts[1:]:
            key, sep, val = part.strip().partition('=')
            key = key.lower()
            if key in attrs or key not in ('domain', 'path', 'secure', 'httponly', 'samesite', 'max-age', 'expires'):
                raise ValueError('Invalid renewal')
            attrs[key] = val if sep else None
        if (attrs.get('domain', '').lower().removeprefix('.') != active.cookie_domain
                or attrs.get('path') != '/' or attrs.get('samesite', '').lower() != 'lax'
                or 'secure' not in attrs or attrs['secure'] is not None
                or 'httponly' not in attrs or attrs['httponly'] is not None):
            raise ValueError('Invalid renewal')
        if 'max-age' in attrs and (not re.fullmatch(r'[0-9]{1,10}', attrs['max-age'] or '') or int(attrs['max-age']) <= 0):
            raise ValueError('Invalid renewal')
        if 'expires' in attrs and parsedate_to_datetime(attrs['expires']).tzinfo is None:
            raise ValueError('Invalid renewal')
        sessions.append(raw)
    if len(sessions) > 1:
        raise ValueError('Ambiguous renewal')
    return sessions[0] if sessions else None


def cabinet_web_session_check(*, profile='production', transport=None):
    """Fixed production wire; transport injection is for controlled local proof."""
    active = web_profile(profile)
    async def operation(value):
        async with httpx.AsyncClient(transport=transport, trust_env=False,
                                     follow_redirects=False, timeout=5) as client:
            async with client.stream('GET', active.cabinet_origin + '/api/auth/session', headers={
                'Cookie': active.cookie_name + '=' + value, 'Cache-Control': 'no-store',
            }) as response:
                if 'no-store' not in [part.strip().lower() for part in response.headers.get('cache-control', '').split(',')]:
                    return SessionResult(503)
                if response.status_code in (401, 403):
                    return SessionResult(response.status_code)
                if response.status_code != 204 or response.headers.get('content-length', '0') != '0':
                    return SessionResult(503)
                async for chunk in response.aiter_bytes():
                    if chunk:
                        return SessionResult(503)
                return SessionResult(204, renewal_cookie(response.headers.get_list('set-cookie'), profile=profile))

    async def check(value):
        if not isinstance(value, str) or not COOKIE_VALUE.fullmatch(value):
            return SessionResult(401)
        try:
            return await asyncio.wait_for(operation(value), timeout=5)
        except Exception:
            # Never log/copy cookies, user data, provider bodies or exception text.
            return SessionResult(503)
    return check


class WebWikiBoundary:
    """Protect web delivery and all public reader aliases, retain native/private API.

    Cookie authority is selected by server routing, never by a frontend/native flag.
    The canonical wiki host cannot redeem invitations, read Zoom or mutate owners.
    Direct backend private bearer paths keep their separate existing authority.
    """
    def __init__(self, app, *, check, profile='production'):
        self.app, self.check, self.profile = app, check, web_profile(profile)

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http':
            return await self.app(scope, receive, send)
        path, method = scope['path'], scope['method']
        headers = scope.get('headers', [])
        hosts = [v.decode('latin-1') for k, v in headers if k.lower() == b'host']
        if len(hosts) != 1:
            return await JSONResponse({'detail': 'Некорректный запрос'}, 400,
                                      headers={'Cache-Control': 'no-store'})(scope, receive, send)
        wiki_host = hosts[0].lower() in (self.profile.wiki_host, self.profile.wiki_host + ':443')
        if not wiki_host and hosts[0].lower().removesuffix(':443') in {p.wiki_host for p in PROFILES.values()}:
            return await JSONResponse({'detail': 'Неверное окружение'}, 404,
                                      headers={'Cache-Control': 'no-store'})(scope, receive, send)
        public_reader = path == '/api/public/wiki' or path.startswith('/api/public/wiki/')
        private_reader = path == '/api/wiki' or path.startswith('/api/wiki/')
        protected = public_reader or (wiki_host and private_reader)
        renewal = None
        if wiki_host and (path.startswith('/api/') and not protected):
            return await JSONResponse({'detail': 'Этот интерфейс здесь недоступен'}, 404,
                                      headers={'Cache-Control': 'no-store'})(scope, receive, send)
        if protected:
            if method not in ('GET', 'HEAD'):
                return await JSONResponse({'detail': 'Используйте кабинет школы'}, 405,
                                          headers={'Cache-Control': 'no-store'})(scope, receive, send)
            value = session_cookie(headers, profile=self.profile.name)
            result = SessionResult(401)
            if value:
                try:
                    result = await asyncio.wait_for(self.check(value), timeout=5)
                    if not isinstance(result, SessionResult) or result.status not in (204, 401, 403, 503):
                        result = SessionResult(503)
                    elif result.renewal is not None:
                        if result.status != 204 or renewal_cookie([result.renewal], profile=self.profile.name) != result.renewal:
                            result = SessionResult(503)
                except Exception:
                    result = SessionResult(503)
            if result.status != 204:
                messages = {401: 'Войдите через кабинет школы', 403: 'Доступ к кабинету ограничен',
                            503: 'Не удалось проверить вход. Повторите позже'}
                return await JSONResponse({'detail': messages[result.status]}, result.status,
                                          headers={'Cache-Control': 'no-store'})(scope, receive, send)
            renewal = result.renewal
            scope.setdefault('state', {})['cabinet_web_authorized'] = True
            if wiki_host and path == '/api/wiki/session':
                response = Response(status_code=204, headers={'Cache-Control': 'no-store'})
                if renewal:
                    response.headers.append('Set-Cookie', renewal)
                return await response(scope, receive, send)
        if wiki_host and path == '/':
            return await RedirectResponse('/wiki', status_code=307,
                                           headers={'Cache-Control': 'no-store'})(scope, receive, send)
        if method in ('GET', 'HEAD') and path in ('/wiki', '/wiki/graph'):
            page = Path(__file__).with_name('wiki_graph_web') / 'index.html'
            html = page.read_text().replace('<body>', f'<body data-cabinet-web="1" data-cabinet-profile="{self.profile.name}">')
            from .wiki_graph import PAGE_HEADERS
            return await HTMLResponse(html, headers={**PAGE_HEADERS, 'Cache-Control': 'no-store'})(scope, receive, send)

        async def scoped_send(message):
            if message['type'] == 'http.response.start' and protected:
                message = dict(message)
                response_headers = [(k, v) for k, v in message.get('headers', [])
                                    if k.lower() not in (b'cache-control', b'set-cookie')]
                response_headers.append((b'cache-control', b'no-store'))
                if renewal:
                    response_headers.append((b'set-cookie', renewal.encode('latin-1')))
                message['headers'] = response_headers
            await send(message)
        return await self.app(scope, receive, scoped_send)
