"""Cabinet native content authority, Workshop a07f087; disabled until mounted."""
import asyncio
from dataclasses import dataclass, field
import json
import math
import re

import httpx2 as httpx

ISSUERS = ('https://staging.xuanxue.su', 'https://xuanxue.su')
MAX_RESPONSE_BYTES = 65536
_FLAGS = ('telegramLinked', 'botChatActive', 'hasEmail', 'googleLinked',
          'noTelegram', 'needsProfile', 'studentMode', 'canUseStudentMode')
_ROLES = ('admin', 'teacher', 'assistant', 'accountant')
_TILES = ('nextLesson', 'notice', 'exams', 'payment', 'grading', 'events')
BEARER = re.compile(r'[A-Za-z0-9._~+/-]+=*')


@dataclass(frozen=True)
class CabinetCredential:
    bearer: str = field(repr=False)


@dataclass(frozen=True)
class NativeSessionResult:
    status: int
    retry_after: int | None = None


def _constant(_):
    raise ValueError('Invalid JSON numeric literal')


def _object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('Ambiguous response')
        result[key] = value
    return result


def _current_session(body):
    """Full pinned native DTO; fields never add reader eligibility."""
    if not isinstance(body, dict):
        return False
    account, session = body.get('account'), body.get('session')
    if not isinstance(account, dict) or not isinstance(session, dict):
        return False
    if (not isinstance(account.get('id'), str)
            or not re.fullmatch(r'[A-Za-z0-9_-]{1,128}', account['id'])
            or not isinstance(account.get('name'), str)
            or account.get('status') != 'active'
            or any(type(account.get(flag)) is not bool for flag in _FLAGS)):
        return False
    roles, tiles = account.get('roles'), account.get('homeHiddenTiles')
    if (not isinstance(roles, list) or any(role not in _ROLES for role in roles)
            or (account['studentMode'] and roles)
            or not isinstance(tiles, list) or any(tile not in _TILES for tile in tiles)
            or tiles != [tile for tile in _TILES if tile in tiles]
            or any(key in account and not isinstance(account[key], str)
                   for key in ('email', 'pendingEmail'))
            or account['hasEmail'] != ('email' in account)):
        return False
    expiry, renewal = session.get('expires_in'), session.get('renew_after')
    return (isinstance(session.get('id'), str)
            and re.fullmatch(r'[A-Za-z0-9_-]{16,128}', session['id']) is not None
            and type(expiry) is int and 0 < expiry <= 7776000
            and type(renewal) is int and 0 <= renewal <= 604801 and renewal < expiry)


def native_me_session_validation(issuer, *, timeout_seconds=5.0, transport=None):
    """One fixed HTTPS GET, deadline covers DNS through response consumption."""
    if issuer not in ISSUERS:
        raise ValueError('Invalid Cabinet issuer')
    if (type(timeout_seconds) not in (int, float) or not math.isfinite(timeout_seconds)
            or not 0 < timeout_seconds <= 5):
        raise ValueError('Invalid Cabinet timeout')
    endpoint = issuer + '/api/auth/native/me'

    async def validate(credential):
        if (not isinstance(credential, CabinetCredential)
                or not isinstance(credential.bearer, str) or len(credential.bearer) > 1024
                or not BEARER.fullmatch(credential.bearer)):
            return NativeSessionResult(401)
        try:
            async with asyncio.timeout(timeout_seconds):
                async with httpx.AsyncClient(transport=transport, timeout=timeout_seconds,
                                             trust_env=False, follow_redirects=False) as client:
                    async with client.stream('GET', endpoint, headers={
                        'Authorization': 'Bearer ' + credential.bearer,
                        'Accept': 'application/json', 'Cache-Control': 'no-store',
                    }) as response:
                        if response.headers.get('content-type', '').split(';')[0].strip().lower() != 'application/json':
                            return NativeSessionResult(503)
                        raw = bytearray()
                        async for chunk in response.aiter_bytes():
                            if len(raw) + len(chunk) > MAX_RESPONSE_BYTES:
                                return NativeSessionResult(503)
                            raw.extend(chunk)
                        body = json.loads(raw.decode('utf-8'), object_pairs_hook=_object, parse_constant=_constant)
                        if response.status_code == 200 and _current_session(body):
                            return NativeSessionResult(200)
                        if response.status_code == 401 and body == {'error': 'invalid_token'}:
                            return NativeSessionResult(401)
                        if response.status_code == 403 and body == {'error': 'account_blocked'}:
                            return NativeSessionResult(403)
                        if response.status_code == 429 and body == {'error': 'rate_limited'}:
                            delay = response.headers.get('retry-after', '')
                            valid = re.fullmatch(r'[0-9]{1,2}', delay) and 1 <= int(delay) <= 60
                            return NativeSessionResult(503, int(delay) if valid else 60)
        except Exception:
            # No body, bearer, profile, transport exception or redirect target in logs.
            pass
        return NativeSessionResult(503)

    return validate
