"""Durable, best-effort Telegram notifications; no participant data or secrets.

The access-request API lifespan calls deliver_one periodically, using the
existing feedback bot and recipient. No Telegram updates/webhook are consumed.
"""
from contextlib import closing
import time
from urllib.parse import urlsplit

import requests


def deliver_one(store, *, bot_token, chat_id, origin, post=requests.post, now=None):
    now = time.time() if now is None else now
    parts = urlsplit(origin)
    if not bot_token or not chat_id:
        return 'not_configured'
    if parts.scheme != 'https' or not parts.netloc or parts.path not in ('', '/') or parts.query or parts.fragment or parts.username:
        raise ValueError('An HTTPS admin origin is required')
    with closing(store.db()) as con, con:
        con.execute('BEGIN IMMEDIATE')
        con.execute("UPDATE access_request_notifications SET status='failed' WHERE status='sending' AND attempts>=8 AND next_attempt<=?", (now,))
        # A crashed worker's lease expires. Telegram has no idempotency key:
        # a crash/timeout after delivery can cause a duplicate notification.
        row = con.execute('''SELECT n.request_id,n.attempts FROM access_request_notifications n
            JOIN access_requests r ON r.id=n.request_id
            WHERE n.status IN ('pending','sending') AND n.next_attempt<=?
              AND r.status='pending' AND n.attempts<8
            ORDER BY n.next_attempt LIMIT 1''', (now,)).fetchone()
        if not row:
            return 'idle'
        attempt = row['attempts'] + 1
        con.execute("UPDATE access_request_notifications SET status='sending',attempts=?,next_attempt=? WHERE request_id=?",
                    (attempt, now + 60, row['request_id']))
    payload = {'chat_id': chat_id, 'text': 'Дейчи · Новая заявка на доступ',
               'link_preview_options': {'is_disabled': True},
               'reply_markup': {'inline_keyboard': [[{'text': 'Открыть в админке',
                   'url': origin.rstrip('/') + '/admin#request=' + row['request_id']}]]}}
    delivered = False
    retry_after = min(3600, 30 * 2 ** (attempt - 1))
    try:
        response = post(f'https://api.telegram.org/bot{bot_token}/sendMessage', json=payload, timeout=(5, 12))
        result = response.json()
        delivered = response.status_code == 200 and isinstance(result, dict) and result.get('ok') is True
        if response.status_code == 429 and isinstance(result, dict):
            parameters = result.get('parameters')
            value = parameters.get('retry_after') if isinstance(parameters, dict) else None
            if isinstance(value, (int, float)) and not isinstance(value, bool):
                retry_after = max(retry_after, min(86400, max(0, value)))
    except (requests.RequestException, ValueError):
        pass  # Never log exceptions which may contain a bot-token URL.
    status = 'sent' if delivered else 'failed' if attempt >= 8 else 'pending'
    with closing(store.db()) as con, con:
        con.execute('UPDATE access_request_notifications SET status=?,next_attempt=? WHERE request_id=? AND attempts=?',
                    (status, now + retry_after, row['request_id'], attempt))
    return status
