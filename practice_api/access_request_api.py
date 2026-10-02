"""Request transport shares existing admin authorization, never participant auth."""
import asyncio
from contextlib import asynccontextmanager, suppress
import os

from fastapi import Depends, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .access_requests import AccessRequests, RequestConflict, RequestLimit
from .access_request_notifications import deliver_one
from .admin import client_ip


class Applicant(BaseModel):
    first_name: str = Field(min_length=1, max_length=80)
    last_name: str = Field(min_length=1, max_length=80)
    telegram: str = Field(default='', max_length=33)


class Claim(BaseModel):
    session_token: str = Field(min_length=43, max_length=128, pattern=r'^[A-Za-z0-9_-]+$')


def mount_access_requests(app, invitations, admin_session, admin_mutation):
    store = AccessRequests(invitations)
    origin = os.getenv('DAYCHEE_PUBLIC_ORIGIN', '').rstrip('/')

    @app.middleware('http')
    async def request_limits(request, call_next):
        if request.url.path.startswith('/api/access/request'):
            if request.headers.get('origin') and request.headers['origin'] != origin:
                return JSONResponse({'detail': 'Недопустимый источник запроса.'}, status_code=403, headers={'Cache-Control': 'no-store'})
            size, chunks = 0, []
            async for chunk in request.stream():
                size += len(chunk)
                if size > 4096:
                    return JSONResponse({'detail': 'Заявка слишком длинная.'}, status_code=413, headers={'Cache-Control': 'no-store'})
                chunks.append(chunk)
            request._body = b''.join(chunks)
            response = await call_next(request)
            # FastAPI validation responses otherwise echo input, including
            # a malformed session token. Return only a generic safe message.
            if response.status_code == 422:
                return JSONResponse({'detail': 'Проверьте имя, фамилию и Telegram.'}, status_code=422, headers={'Cache-Control': 'no-store'})
            return response
        return await call_next(request)

    def secret(authorization: str = Header(default='')):
        from .access_requests import credential
        if not authorization.startswith('Bearer '):
            raise HTTPException(401, 'Не найдена заявка на этом телефоне.')
        value = authorization[7:]
        try:
            credential(value)
        except ValueError:
            raise HTTPException(401, 'Не найдена заявка на этом телефоне.') from None
        return value

    def invoke(action):
        try:
            result = action()
        except RequestLimit:
            raise HTTPException(429, 'Слишком много заявок. Попробуйте позже.', headers={'Retry-After': '3600'}) from None
        except RequestConflict:
            raise HTTPException(409, 'Состояние уже изменилось. Обновите заявку.') from None
        except ValueError:
            raise HTTPException(422, 'Проверьте имя, фамилию и Telegram.') from None
        if result is None:
            raise HTTPException(404, 'Заявка не найдена.')
        return result

    @app.post('/api/access/request')
    def submit(body: Applicant, request: Request, key=Depends(secret)):
        return invoke(lambda: store.submit(key, body.first_name, body.last_name, body.telegram, host=client_ip(request)))

    @app.get('/api/access/request')
    def status(key=Depends(secret)):
        return invoke(lambda: store.status(key))

    @app.post('/api/access/request/claim')
    def claim(body: Claim, key=Depends(secret)):
        return invoke(lambda: store.claim(key, body.session_token))

    @app.get('/api/admin/requests', dependencies=[Depends(admin_session)])
    def inventory():
        return {'items': store.inventory()}

    @app.post('/api/admin/requests/{identity}/{decision}', dependencies=[Depends(admin_mutation)])
    def decide(identity: str, decision: str):
        if decision not in ('approve', 'reject'):
            raise HTTPException(404)
        return invoke(lambda: store.decide(identity, 'approved' if decision == 'approve' else 'rejected'))

    old_lifespan = app.router.lifespan_context

    async def notifications():
        while True:
            try:
                await asyncio.to_thread(deliver_one, store,
                    bot_token=os.getenv('DAYCHEE_FEEDBACK_BOT_TOKEN', ''),
                    chat_id=os.getenv('DAYCHEE_FEEDBACK_CHAT_ID', ''), origin=origin)
            except Exception:
                # Keep the queue alive without logging token URLs or profiles.
                # Entries retain retry/lease state for the next iteration.
                pass
            await asyncio.sleep(5)

    @asynccontextmanager
    async def lifespan(instance):
        async with old_lifespan(instance) as state:
            task = asyncio.create_task(notifications())
            try:
                yield state
            finally:
                task.cancel()
                with suppress(asyncio.CancelledError):
                    await task

    app.router.lifespan_context = lifespan
    return store
