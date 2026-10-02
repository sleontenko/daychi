"""Feedback relay. Telegram credentials remain exclusively on the server."""
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import sqlite3
import time
from typing import Literal
from uuid import UUID

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import requests


class Feedback(BaseModel):
    operation_id: UUID
    kind: Literal['Ошибка', 'Идея', 'Вопрос']
    message: str = Field(min_length=2, max_length=3000)
    contact: str = Field(default='', max_length=200)
    version: str = Field(default='', max_length=40)


def mount_feedback(app, database):
    path = Path(database)

    @app.middleware('http')
    async def limit_feedback_body(request, call_next):
        if request.url.path == '/api/feedback':
            chunks = []; size = 0
            async for chunk in request.stream():
                size += len(chunk)
                if size > 16384:
                    return JSONResponse({'detail': 'Сообщение слишком длинное.'}, status_code=413)
                chunks.append(chunk)
            request._body = b''.join(chunks)
        return await call_next(request)

    def connect():
        path.parent.mkdir(parents=True, exist_ok=True)
        db = sqlite3.connect(path, timeout=15)
        db.execute('CREATE TABLE IF NOT EXISTS feedback (id TEXT PRIMARY KEY, digest TEXT NOT NULL, host TEXT NOT NULL, created REAL NOT NULL, status TEXT NOT NULL)')
        path.chmod(0o600)
        return db

    @app.post('/api/feedback')
    def submit(body: Feedback, request: Request):
        token = os.getenv('DAYCHEE_FEEDBACK_BOT_TOKEN', '')
        chat = os.getenv('DAYCHEE_FEEDBACK_CHAT_ID', '')
        if not token or not chat:
            raise HTTPException(503, 'Отправка пока не подключена. Черновик сохранён.')
        if len(body.message.strip()) < 2:
            raise HTTPException(422, 'Напишите хотя бы пару слов.')
        origin = request.headers.get('origin')
        if origin and origin != os.getenv('DAYCHEE_PUBLIC_ORIGIN'):
            raise HTTPException(403, 'Недопустимый источник запроса.')
        host = request.client.host if request.client else 'unknown'
        if os.getenv('RAILWAY_ENVIRONMENT_ID'):
            try:
                host = str(ipaddress.ip_address(request.headers.get('x-real-ip', '')))
            except ValueError:
                pass
        host = hashlib.sha256(host.encode()).hexdigest()
        payload = body.model_dump(mode='json')
        key = payload.pop('operation_id')
        digest = hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        now = time.time()
        with connect() as db:
            db.execute('BEGIN IMMEDIATE')
            db.execute('DELETE FROM feedback WHERE created < ?', (now - 30 * 86400,))
            row = db.execute('SELECT digest, status FROM feedback WHERE id=?', (key,)).fetchone()
            if row:
                if row[0] != digest:
                    raise HTTPException(409, 'Текст изменился. Создайте новое сообщение.')
                if row[1] == 'sent':
                    return {'status': 'sent'}
                if row[1] in ('sending', 'unknown'):
                    raise HTTPException(503, 'Не удалось подтвердить доставку. Чтобы не отправить дубликат, автоматический повтор остановлен. Черновик сохранён.')
            total, recent = db.execute('SELECT count(*), coalesce(sum(host=?),0) FROM feedback WHERE created>?', (host, now-3600)).fetchone()
            if (not row and (total >= 60 or recent >= 5)) or (row and now - db.execute('SELECT created FROM feedback WHERE id=?',(key,)).fetchone()[0] < 30):
                raise HTTPException(429, 'Слишком много попыток. Повторите позже.')
            db.execute('INSERT INTO feedback VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status, created=excluded.created', (key, digest, host, now, 'sending'))
        # No user text or contact is retained in the database or logged.
        text = f'Дейчи · {body.kind}\n\n{body.message.strip()}'
        if body.contact.strip():
            text += f'\n\nКонтакт: {body.contact.strip()}'
        text += f'\n\nВерсия: {body.version or "не указана"}\nСообщение: {key}'
        status = 'unknown'
        try:
            response = requests.post(f'https://api.telegram.org/bot{token}/sendMessage', json={'chat_id': chat, 'text': text, 'link_preview_options': {'is_disabled': True}}, timeout=(5, 12))
            result = response.json()
            if response.status_code == 200 and result.get('ok') is True:
                status = 'sent'
            elif response.status_code < 500 and result.get('ok') is False:
                status = 'failed'
        except (requests.RequestException, ValueError):
            pass  # Never expose exceptions containing the bot-token URL.
        with connect() as db:
            db.execute('UPDATE feedback SET status=? WHERE id=?', (status, key))
        if status != 'sent':
            raise HTTPException(503, 'Не удалось подтвердить доставку. Черновик сохранён.' if status == 'unknown' else 'Не удалось отправить. Текст сохранён — попробуйте позже.')
        return {'status': 'sent'}
