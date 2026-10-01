"""Next-version API; run locally until an explicit service cutover is approved."""
import json
import ipaddress
import os
from pathlib import Path
import threading
import time
from fastapi import Depends, Header, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from .invitations import Invitations, normalize_code
from .admin import mount_admin
from .feedback import mount_feedback
from .access_request_api import mount_access_requests
from .wiki_app import WikiSettings, create_wiki_app
from .wiki_content import mount_content_import
from .schedule_source import ScheduleSource, ScheduleSourceError, SCHOOL_TIMEZONE, SOURCE_URL


class Redeem(BaseModel):
    token: str = Field(min_length=32, max_length=128, pattern=r'^[A-Za-z0-9_-]+$')


class RedeemCode(BaseModel):
    code: str = Field(min_length=12, max_length=40)


def create_daychee_app(settings=None, invitations=None, zoom_path=None, schedule_source=None):
    store = invitations or Invitations(os.getenv('DAYCHEE_ACCESS_DATABASE', 'data/daychee-access.sqlite3'))
    rooms = Path(zoom_path or os.getenv('DAYCHEE_ZOOM', 'data/daychee-zoom.json'))
    schedule = schedule_source or ScheduleSource()
    def authorize(authorization: str = Header(default='')):
        if not authorization.startswith('Bearer ') or not store.authorized(authorization[7:]):
            raise HTTPException(401, 'Доступ отсутствует или отозван. Попросите новое приглашение.')
        return authorization[7:]
    app = create_wiki_app(settings or WikiSettings.from_env(), access_authorizer=authorize)
    admin_session, admin_mutation = mount_admin(app, store)
    mount_content_import(app, admin_session, admin_mutation)
    # Enable together with the reviewed mobile/admin UI, not during an
    # unrelated deployment from this shared working tree.
    if os.getenv('DAYCHEE_ACCESS_REQUESTS_ENABLED') == '1':
        mount_access_requests(app, store, admin_session, admin_mutation)
    mount_feedback(app, Path(store.path).with_name("feedback.sqlite3"))
    attempts = {}
    lock = threading.Lock()

    def consume_invitation(credential, request):
        host = request.client.host if request.client else 'unknown'
        # Trust provider headers only inside that provider's deployment.
        # Railway documents X-Real-IP as the edge client IP; verify overwrite
        # with a spoofed-header public smoke test before accepting deployment.
        header = ('x-real-ip' if os.getenv('RAILWAY_ENVIRONMENT_ID') else
                  'fly-client-ip' if os.getenv('FLY_APP_NAME') else None)
        if header:
            try:
                host = str(ipaddress.ip_address(request.headers.get(header, '')))
            except ValueError:
                pass
        now = time.time()
        with lock:
            for key in list(attempts):
                attempts[key] = [t for t in attempts[key] if t > now - 600]
                if not attempts[key]: del attempts[key]
            recent = attempts.setdefault(host, [])
            if len(recent) >= 10: raise HTTPException(429, 'Слишком много попыток. Повторите позже.')
            recent.append(now)
        token = store.redeem(credential)
        if not token: raise HTTPException(401, {'code': store.rejection_reason(credential)})
        return {'token': token}

    @app.post('/api/access/redeem')
    def redeem(body: Redeem, request: Request):
        return consume_invitation(body.token, request)

    @app.post('/api/access/redeem-code')
    def redeem_code(body: RedeemCode, request: Request):
        code = normalize_code(body.code)
        if not code:
            raise HTTPException(422, 'Проверьте код приглашения: 12 букв и цифр.')
        return consume_invitation(code, request)

    assets = Path(__file__).with_name('invitation_web')
    website = Path(__file__).with_name('website')
    website_headers = {
        'Content-Security-Policy': "default-src 'none'; img-src 'self'; font-src 'self'; script-src 'self'; style-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
    }

    @app.get('/', include_in_schema=False)
    def website_page():
        return FileResponse(website / 'index.html', headers=website_headers)

    @app.get('/downloads/daychee-android.apk', include_in_schema=False)
    def android_download():
        apk = Path(__file__).with_name('downloads') / 'daychee-android.apk'
        if not apk.is_file():
            raise HTTPException(404, 'Android-сборка пока недоступна')
        return FileResponse(apk, media_type='application/vnd.android.package-archive',
                            filename='daychee-1.0.0-3.apk',
                            headers={'X-Content-Type-Options': 'nosniff',
                                     'Cache-Control': 'no-cache'})

    @app.get('/website-assets/{name}', include_in_schema=False)
    def website_asset(name: str):
        if name not in ('apple.svg', 'android.svg', 'simple-icons-LICENSE.md', 'caprasimo-OFL.txt', 'figtree-OFL.txt', 'site.css', 'site.js', 'schedule-ios.png', 'font-0.ttf', 'font-1.ttf', 'font-2.ttf', 'font-3.ttf'):
            raise HTTPException(404)
        return FileResponse(website / name, headers=website_headers)

    page_headers = {
        'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
        'X-Robots-Tag': 'noindex, nofollow',
    }

    @app.get('/invite', include_in_schema=False)
    def invitation_page():
        return FileResponse(assets / 'index.html', headers=page_headers)

    @app.get('/invitation-assets/{name}', include_in_schema=False)
    def invitation_asset(name: str):
        if name not in ('invitation.js', 'invitation.css'):
            raise HTTPException(404)
        return FileResponse(assets / name, headers=page_headers)

    @app.get('/health')
    def health():
        return {'ok': True}

    @app.get('/api/v1/schedule')
    def public_schedule():
        try:
            data = schedule.get().model_dump(mode='json')
        except ScheduleSourceError:
            raise HTTPException(503, 'Не удалось проверить расписание школы') from None
        return {**data, 'source_url': SOURCE_URL, 'timezone': SCHOOL_TIMEZONE,
                'kind': 'weekly_template', 'exceptions_verified': False}

    @app.get('/api/access/session', dependencies=[Depends(authorize)])
    def session():
        return {'active': True}

    @app.post('/api/access/logout')
    def logout(token=Depends(authorize)):
        store.logout(token)
        return {'ok': True}

    @app.get('/api/access/zoom', dependencies=[Depends(authorize)])
    def zoom():
        try:
            rows = json.loads(rooms.read_text())
            if not isinstance(rows, list): raise ValueError()
            return rows
        except (OSError, ValueError):
            raise HTTPException(503, 'Подключения к занятиям временно недоступны') from None
    return app


app = create_daychee_app()
