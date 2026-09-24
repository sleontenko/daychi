"""Next-version API; run locally until an explicit service cutover is approved."""
import json
import os
from pathlib import Path
import threading
import time
from fastapi import Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field
from .invitations import Invitations
from .wiki_app import WikiSettings, create_wiki_app


class Redeem(BaseModel):
    token: str = Field(min_length=32, max_length=128, pattern=r'^[A-Za-z0-9_-]+$')


def create_daychee_app(settings=None, invitations=None, zoom_path=None):
    store = invitations or Invitations(os.getenv('DAYCHEE_ACCESS_DATABASE', 'data/daychee-access.sqlite3'))
    rooms = Path(zoom_path or os.getenv('DAYCHEE_ZOOM', 'data/daychee-zoom.json'))
    def authorize(authorization: str = Header(default='')):
        if not authorization.startswith('Bearer ') or not store.authorized(authorization[7:]):
            raise HTTPException(401, 'Доступ отсутствует или отозван. Попросите новое приглашение.')
        return authorization[7:]
    app = create_wiki_app(settings or WikiSettings.from_env(), access_authorizer=authorize)
    attempts = {}
    lock = threading.Lock()

    @app.post('/api/access/redeem')
    def redeem(body: Redeem, request: Request):
        host = request.client.host if request.client else 'unknown'
        now = time.time()
        with lock:
            for key in list(attempts):
                attempts[key] = [t for t in attempts[key] if t > now - 600]
                if not attempts[key]: del attempts[key]
            recent = attempts.setdefault(host, [])
            if len(recent) >= 10: raise HTTPException(429, 'Слишком много попыток. Повторите позже.')
            recent.append(now)
        token = store.redeem(body.token)
        if not token: raise HTTPException(401, 'Приглашение истекло, уже использовано или недействительно.')
        return {'token': token}

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
