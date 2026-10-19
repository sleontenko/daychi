import { CALLBACK, CLIENT_ID, CabinetError, issuer, meDTO, record, tokenDTO, type Failure } from './protocol';
import { createReminderClient } from './reminders-client';

// Dedicated transport: never uses the existing Daychi access request/401 handler.
export function createAccountClient(origin: string, read: typeof fetch = globalThis.fetch, timeoutMs = 12000) {
  const base = issuer(origin);
  async function request(path: string, options: RequestInit, revoke = false): Promise<unknown> {
    const abort = new AbortController(), timer = setTimeout(() => abort.abort(), timeoutMs);
    try {
      const response = await read(`${base}/api/auth/native/${path}`, {
        ...options, credentials: 'omit', cache: 'no-store', redirect: 'error', signal: abort.signal,
      }).catch(() => { throw new CabinetError('network'); });
      if (revoke && response.status === 200) {
        if ((await response.text()) !== '') throw new CabinetError('invalid-response');
        return null;
      }
      if (response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json')
        throw new CabinetError('invalid-response');
      let body: Record<string, unknown>;
      try { body = record(await response.json()); } catch { throw new CabinetError('invalid-response'); }
      if (response.status === 200) return body;
      const allowed: Record<number, string[]> = {
        400: path === 'me' || path === 'renew' ? ['invalid_request'] :
          ['invalid_request', 'invalid_client', ...(path === 'token' ? ['invalid_grant', 'unsupported_grant_type'] : [])],
        401: ['invalid_token'], 403: ['account_blocked'], 429: ['rate_limited'],
        500: ['server_error'], 503: ['temporarily_unavailable'],
      };
      if (Object.keys(body).length !== 1 || !allowed[response.status]?.includes(String(body.error)))
        throw new CabinetError('invalid-response');
      let delay: number | undefined;
      if (response.status === 429) {
        const raw = response.headers.get('retry-after');
        if (!raw || !/^[0-9]+$/.test(raw) || Number(raw) < 1 || Number(raw) > 3600) throw new CabinetError('invalid-response');
        delay = Number(raw);
      }
      throw new CabinetError(body.error as Failure, delay);
    } finally { clearTimeout(timer); }
  }
  return {
    reminders: createReminderClient(origin, read, timeoutMs),
    async exchange(code: string, verifier: string) {
      return tokenDTO(await request('token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'authorization_code', client_id: CLIENT_ID, redirect_uri: CALLBACK, code, code_verifier: verifier }).toString() }));
    },
    async me(token: string, grant: string) {
      return meDTO(await request('me', { headers: { Authorization: `Bearer ${token}` } }), grant);
    },
    async renew(token: string, grant: string) {
      const result = tokenDTO(await request('renew', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}' }));
      if (result.session_id !== grant) throw new CabinetError('invalid-response');
      return result;
    },
    async revoke(token: string) {
      await request('revoke', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: CLIENT_ID, token, token_type_hint: 'access_token' }).toString() }, true);
    },
  };
}
