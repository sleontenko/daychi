// Loopback-only synthetic provider for client preparation, never imported by app
// runtime. It models the pinned native account profile; not Cabinet conformance.
import { createServer } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';

const issuers = ['https://staging.xuanxue.su', 'https://xuanxue.su'];
const callback = 'su.xuanxue.daychi:/oauth/cabinet';
const client = 'daychi-native', lifetime = 90 * 86400, renewalAge = 7 * 86400;
const hash = value => createHash('sha256').update(value).digest('hex');
const fresh = () => randomBytes(32).toString('base64url');
export const syntheticAccount = () => ({ id: 'synthetic_student', name: 'Тестовый ученик', roles: [], status: 'active',
  telegramLinked: true, botChatActive: false, hasEmail: false, googleLinked: true,
  noTelegram: false, needsProfile: false, studentMode: false, canUseStudentMode: false, homeHiddenTiles: [] });

export async function startCabinetProvider() {
  let clock = 1000000000, blocked = false, browserAlive = true, account = syntheticAccount();
  const codes = new Map(), tokens = new Map(), grants = new Map(), operations = [];
  function issue(issuer, grant = fresh()) {
    grants.set(grant, true);
    const bearer = fresh();
    tokens.set(hash(bearer), { issuer, grant, created: clock, expires: clock + lifetime * 1000 });
    return { access_token: bearer, token_type: 'Bearer', scope: 'account:read',
      expires_in: lifetime, renew_after: renewalAge + 1, session_id: grant };
  }
  function authorize(url) {
    const u = new URL(url), p = u.searchParams;
    if (!issuers.includes(u.origin) || u.pathname !== '/auth/native/authorize' ||
        p.get('client_id') !== client || p.get('redirect_uri') !== callback ||
        p.get('scope') !== 'account:read' || p.get('response_type') !== 'code' ||
        p.get('code_challenge_method') !== 'S256' || !/^[\w-]{43}$/.test(p.get('state')) ||
        !/^[\w-]{43}$/.test(p.get('code_challenge'))) throw new Error('Invalid synthetic authorization');
    const code = fresh();
    codes.set(hash(code), { issuer: u.origin, challenge: p.get('code_challenge'), expires: clock + 60000 });
    return callback + '?' + new URLSearchParams({ code, state: p.get('state'), iss: u.origin });
  }
  const server = createServer(async (request, response) => {
    const send = (status, body) => {
      response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(body === null ? '' : JSON.stringify(body));
    };
    try {
      const segments = request.url.split('/'), issuer = issuers[Number(segments[1])], operation = segments.at(-1);
      if (!issuer || segments.slice(2, 5).join('/') !== 'api/auth/native' || request.headers.cookie) return send(400, { error: 'invalid_request' });
      operations.push({ issuer, operation, method: request.method, cookie: Boolean(request.headers.cookie) });
      let body = ''; for await (const part of request) { body += part; if (body.length > 8192) return send(400, { error: 'invalid_request' }); }
      const form = new URLSearchParams(body);
      if (operation === 'token') {
        if (request.method !== 'POST' || request.headers['content-type'] !== 'application/x-www-form-urlencoded' ||
            form.get('client_id') !== client || form.get('redirect_uri') !== callback || form.get('grant_type') !== 'authorization_code') return send(400, { error: 'invalid_request' });
        const codeKey = hash(form.get('code') || ''), pending = codes.get(codeKey);
        const challenge = createHash('sha256').update(form.get('code_verifier') || '').digest('base64url');
        if (!pending || pending.issuer !== issuer || pending.expires <= clock || challenge !== pending.challenge) return send(400, { error: 'invalid_grant' });
        codes.delete(codeKey);
        if (blocked) return send(403, { error: 'account_blocked' });
        return send(200, issue(issuer));
      }
      if (operation === 'revoke') {
        if (request.method !== 'POST' || request.headers.authorization || form.get('client_id') !== client ||
            form.get('token_type_hint') !== 'access_token') return send(400, { error: 'invalid_request' });
        const token = tokens.get(hash(form.get('token') || ''));
        if (token?.issuer === issuer) grants.set(token.grant, false);
        return send(200, null);
      }
      const header = request.headers.authorization || '';
      const token = header.startsWith('Bearer ') ? tokens.get(hash(header.slice(7))) : null;
      if (!token || token.issuer !== issuer || !grants.get(token.grant) || token.expires <= clock) return send(401, { error: 'invalid_token' });
      if (blocked) return send(403, { error: 'account_blocked' });
      const renew_after = Math.max(0, Math.floor((renewalAge * 1000 - (clock - token.created)) / 1000) + 1);
      if (operation === 'me' && request.method === 'GET') return send(200, { account,
        session: { id: token.grant, expires_in: Math.ceil((token.expires - clock) / 1000), renew_after } });
      if (operation === 'renew' && request.method === 'POST' && body === '{}' && renew_after === 0) return send(200, issue(issuer, token.grant));
      return send(400, { error: 'invalid_request' });
    } catch { return send(503, { error: 'temporarily_unavailable' }); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  async function transport(url, options) {
    const u = new URL(url), index = issuers.indexOf(u.origin);
    if (index < 0 || !u.pathname.startsWith('/api/auth/native/')) throw new Error('Unexpected synthetic transport target');
    return fetch(`http://127.0.0.1:${port}/${index}${u.pathname}`, options);
  }
  return { authorize, transport, now: () => clock, advance: delta => { clock += delta; },
    setBlocked: value => { blocked = value; }, setAccount: value => { account = value; },
    operations, browserAlive: () => browserAlive,
    // No raw bearer/code records, logging, arbitrary network or fixture admin route.
    recordsAreHashed: () => [...tokens.keys(), ...codes.keys()].every(key => /^[a-f0-9]{64}$/.test(key)),
    async close() { browserAlive = false; await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); },
  };
}
