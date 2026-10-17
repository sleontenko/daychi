"""Explicit coexisting native reader; no browser/legacy fallback or activation."""
import asyncio
from starlette.responses import JSONResponse

from .cabinet_session_http import BEARER, CabinetCredential, NativeSessionResult

PROFILES = {'staging': 'https://staging.xuanxue.su', 'production': 'https://xuanxue.su'}
PREFIX = '/api/native/wiki'
WIKI_HOSTS = {'wiki.xuanxue.su', 'wiki.staging.xuanxue.su'}
MESSAGES = {401: 'Войдите через кабинет школы', 403: 'Доступ к кабинету ограничен',
            503: 'Не удалось проверить вход. Повторите позже'}


def native_route_inventory(app):
    return tuple(route for route in app.routes
                 if getattr(route, 'path', '').startswith('/api/wiki/')
                 and 'GET' in getattr(route, 'methods', set()))


class NativeContentBoundary:
    def __init__(self, app, *, check, profile, routes):
        if profile not in PROFILES:
            raise ValueError('Explicit production/staging native profile required')
        self.app, self.check, self.routes = app, check, routes

    async def __call__(self, scope, receive, send):
        path = scope.get('path', '')
        if scope['type'] != 'http' or not (path == PREFIX or path.startswith(PREFIX + '/')):
            return await self.app(scope, receive, send)

        async def refuse(status, retry=None):
            headers = {'Cache-Control': 'no-store'}
            if retry is not None:
                headers['Retry-After'] = str(retry)
            return await JSONResponse({'detail': MESSAGES.get(status, 'Интерфейс недоступен')},
                                      status, headers=headers)(scope, receive, send)

        headers = scope.get('headers', [])
        hosts = [v.decode('latin-1').lower().split(':')[0] for k, v in headers if k.lower() == b'host']
        if len(hosts) != 1 or hosts[0].rstrip('.') in WIKI_HOSTS:
            return await refuse(404)
        if scope.get('method') != 'GET':
            return await refuse(405)
        target = '/api/wiki' + path[len(PREFIX):]
        if not any(route.path_regex.fullmatch(target) for route in self.routes):
            return await refuse(404)
        values = [v.decode('latin-1') for k, v in headers if k.lower() == b'authorization']
        if len(values) != 1 or not values[0].startswith('Bearer '):
            return await refuse(401)
        token = values[0][7:]
        if len(token) > 1024 or not BEARER.fullmatch(token):
            return await refuse(401)
        try:
            async with asyncio.timeout(5):
                result = await self.check(CabinetCredential(token))
            if (not isinstance(result, NativeSessionResult)
                    or result.status not in (200, 401, 403, 503)
                    or (result.retry_after is not None
                        and (result.status != 503 or type(result.retry_after) is not int
                             or not 1 <= result.retry_after <= 60))):
                result = NativeSessionResult(503)
        except Exception:
            result = NativeSessionResult(503)
        if result.status != 200:
            return await refuse(result.status, result.retry_after)

        child = dict(scope)
        child['path'], child['raw_path'] = target, target.encode('utf-8')
        child['state'] = {**scope.get('state', {}), 'cabinet_native_authorized': True}
        child['headers'] = [(k, v) for k, v in headers
                            if k.lower() not in (b'authorization', b'cookie')]

        async def no_store(message):
            if message['type'] == 'http.response.start':
                message = dict(message)
                message['headers'] = [(k, v) for k, v in message.get('headers', [])
                                      if k.lower() not in (b'cache-control', b'set-cookie')]
                message['headers'].append((b'cache-control', b'no-store'))
            await send(message)
        await self.app(child, receive, no_store)
