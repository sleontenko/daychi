import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { typescriptLoader } from './fixtures/load-typescript.mjs';
const load = typescriptLoader(fileURLToPath(new URL('../src/features/', import.meta.url)));
const { createReminderClient, ReminderRequestError } = load('cabinet-account/reminders-client');
const { createAccountSession } = load('cabinet-account/session-core');
const { CabinetError } = load('cabinet-account/protocol');
const origin = 'https://staging.xuanxue.su', token = 'synthetic-bearer', grant = 'synthetic_grant_123456';
const profile = { id: 'synthetic-account', name: 'Synthetic', status: 'active', roles: [], telegramLinked: false,
  botChatActive: false, hasEmail: false, googleLinked: false, noTelegram: false, needsProfile: false,
  studentMode: false, canUseStudentMode: false, homeHiddenTiles: [] };
const result = { version: 1, accountId: profile.id, revision: '0', classIds: [], lessonIds: [], leadMinutes: null, schoolMinutes: 45, classes: [] };
const ok = () => new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store' } });

test('fixed native issuer, exact route, JSON specified-key PATCH, no cookies or redirects', async () => {
  const calls = [], request = createReminderClient(origin, async (url, options) => { calls.push({ url, options }); return ok(); });
  await request(token); await request(token, [{ kind: 'lead', minutes: 120 }]);
  assert.equal(calls.length, 2);
  for (const { url, options } of calls) {
    assert.equal(url, origin + '/api/me/notifications/lessons/sync'); assert.equal(options.headers.Authorization, 'Bearer ' + token);
    assert.equal(options.credentials, 'omit'); assert.equal(options.redirect, 'error'); assert.equal(options.cache, 'no-store');
    assert.equal(options.headers.Cookie, undefined); assert.equal(options.headers['X-Requested-With'], undefined);
  }
  assert.equal(calls[0].options.method, 'GET'); assert.equal(calls[0].options.body, undefined);
  assert.deepEqual(JSON.parse(calls[1].options.body), { version: 1, changes: [{ kind: 'lead', minutes: 120 }] });
  assert.throws(() => createReminderClient('https://other.test'));
});
test('route failures map HTTP lifecycle independently of native-auth error envelope', async () => {
  for (const [status, kind] of [[401, 'invalid_token'], [403, 'account_blocked']]) {
    const request = createReminderClient(origin, async () => new Response('unknown envelope', { status }));
    await assert.rejects(request(token), error => error instanceof CabinetError && error.kind === kind);
  }
  const request = createReminderClient(origin, async () => new Response('{"code":"rate_limited"}', { status: 429, headers: { 'Retry-After': '60' } }));
  await assert.rejects(request(token), error => error instanceof ReminderRequestError && error.retrySeconds === 60);
});
test('total deadline includes body decoding even if fetch/body ignores abort; no mutation replay', async () => {
  let calls = 0;
  const request = createReminderClient(origin, async () => { calls++; return { status: 200, redirected: false,
    headers: new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }), json: () => new Promise(() => {}) }; }, 15);
  await assert.rejects(request(token, [{ kind: 'lead', minutes: 0 }]), ReminderRequestError);
  assert.equal(calls, 1);
});
test('redirect/malformed/no-store failures cannot be interpreted as empty choices', async () => {
  for (const response of [new Response('{}', { status: 302 }), new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }),
    new Response('not-json', { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })]) {
    await assert.rejects(createReminderClient(origin, async () => response)(token), ReminderRequestError);
  }
});
function sessionHarness({ due = false } = {}) {
  const map = new Map([['daychi.cabinet.account.v1.staging', JSON.stringify({ version: 1, issuer: origin, pending: null,
    session: { token, grant, savedAt: 0, expiresAt: 100000000, renewAt: due ? 1 : 10000000 } })]]);
  const calls = []; let refusal = null, late = null;
  const session = createAccountSession({ origin, now: () => 1000000, random: async () => 'a'.repeat(43), challenge: async () => 'b'.repeat(43),
    storage: { get: async k => map.get(k) ?? null, set: async (k, v) => map.set(k, v), delete: async k => map.delete(k) },
    client: {
      me: async () => ({ account: profile, session: { id: grant, expires_in: 5000, renew_after: due ? 0 : 100 } }),
      renew: async () => { calls.push('renew'); return { access_token: 'renewed-synthetic', token_type: 'Bearer', scope: 'account:read', session_id: grant, expires_in: 5000, renew_after: 100 }; },
      reminders: async (bearer, changes) => { calls.push({ bearer, changes }); if (refusal) throw refusal; if (late) await late; return result; },
      revoke: async () => {}, exchange: async () => assert.fail(),
    },
  });
  return { session, map, calls, fail: e => { refusal = e; }, defer: value => { late = value; } };
}
test('credential owner uses renewed credential once; no bearer exists in public account state', async () => {
  const h = sessionHarness({ due: true }); await h.session.restore();
  await h.session.reminders([{ kind: 'lead', minutes: 120 }]);
  assert.equal(h.calls.filter(c => c === 'renew').length, 1);
  assert.equal(h.calls.at(-1).bearer, 'renewed-synthetic');
  assert.equal(JSON.stringify(h.session.getState()).includes(token), false);
});
test('401 removes only this credential; 403 preserves it; no automatic PATCH retry', async () => {
  for (const kind of ['invalid_token', 'account_blocked']) {
    const h = sessionHarness(); await h.session.restore(); h.fail(new CabinetError(kind));
    await assert.rejects(h.session.reminders([{ kind: 'lead', minutes: 0 }]));
    assert.equal(h.calls.length, 1);
    assert.equal(h.session.getState().hasSession, kind === 'account_blocked');
    assert.equal(h.session.getState().status, kind === 'account_blocked' ? 'blocked' : 'signed-out');
  }
});
test('logout during a reminder request rejects its late result and forbids further dispatch', async () => {
  const h = sessionHarness(); await h.session.restore(); let resolve;
  h.defer(new Promise(r => { resolve = r; })); const request = h.session.reminders();
  await h.session.logout(); resolve(); await assert.rejects(request);
  await assert.rejects(h.session.reminders()); assert.equal(h.calls.length, 1);
});
