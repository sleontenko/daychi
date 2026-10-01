from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
import json
import secrets
import time
from types import SimpleNamespace

import requests

from practice_api.access_requests import AccessRequests
from practice_api.access_request_notifications import deliver_one
from practice_api.invitations import Invitations


def test_notification_failure_does_not_lose_request_and_retry_is_private(tmp_path):
    store = AccessRequests(Invitations(tmp_path / 'access.sqlite3'))
    secret = secrets.token_urlsafe(32)
    row = store.submit(secret, 'PrivateFirst', 'PrivateLast', '@private_contact')
    now = time.time() + 1
    config = dict(bot_token='test-only', chat_id='test-chat', origin='https://example.test')

    def offline(*args, **kwargs):
        raise requests.Timeout('not logged')

    assert deliver_one(store, **config, post=offline, now=now) == 'pending'
    assert store.status(secret)['status'] == 'pending'
    delivered = []

    def send(url, **kwargs):
        delivered.append(kwargs['json'])
        return SimpleNamespace(status_code=200, json=lambda: {'ok': True})

    assert deliver_one(store, **config, post=send, now=now + 5) == 'idle'
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda _: deliver_one(store, **config, post=send, now=now + 61), range(4)))
    assert results.count('sent') == 1
    assert len(delivered) == 1
    text = json.dumps(delivered)
    for private in ('PrivateFirst', 'PrivateLast', 'private_contact', secret):
        assert private not in text
    assert row['id'] in text
    assert store.status(secret)['status'] == 'pending'


def test_disabled_and_already_decided_requests_do_not_send(tmp_path):
    store = AccessRequests(Invitations(tmp_path / 'access.sqlite3'))
    row = store.submit(secrets.token_urlsafe(32), 'Test', 'Person')
    def forbidden(*args, **kwargs):
        raise AssertionError('must not send')
    assert deliver_one(store, bot_token='', chat_id='', origin='', post=forbidden) == 'not_configured'
    store.decide(row['id'], 'approved')
    assert deliver_one(store, bot_token='test', chat_id='test', origin='https://example.test', post=forbidden) == 'idle'


def test_retry_after_and_crashed_final_attempt(tmp_path):
    store = AccessRequests(Invitations(tmp_path / 'access.sqlite3'))
    row = store.submit(secrets.token_urlsafe(32), 'Test', 'Person')
    now = time.time() + 1
    config = dict(bot_token='test', chat_id='test', origin='https://example.test')
    def limited(*args, **kwargs):
        return SimpleNamespace(status_code=429, json=lambda: {'ok': False, 'parameters': {'retry_after': 120}})
    assert deliver_one(store, **config, post=limited, now=now) == 'pending'
    assert deliver_one(store, **config, post=limited, now=now + 60) == 'idle'
    with closing(store.db()) as con, con:
        con.execute("UPDATE access_request_notifications SET status='sending',attempts=8,next_attempt=?", (now + 120,))
    assert deliver_one(store, **config, post=limited, now=now + 121) == 'idle'
    with closing(store.db()) as con:
        assert con.execute('SELECT status FROM access_request_notifications WHERE request_id=?', (row['id'],)).fetchone()[0] == 'failed'
