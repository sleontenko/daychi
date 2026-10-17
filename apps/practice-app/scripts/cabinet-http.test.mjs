import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { startCabinetProvider, syntheticAccount } from './fixtures/cabinet-provider.mjs';

const root = fileURLToPath(new URL('../src/features/cabinet-account/', import.meta.url));
const modules = new Map();
function load(file) {
  const name = path.resolve(root, file.endsWith('.ts') ? file : file + '.ts');
  if (modules.has(name)) return modules.get(name);
  const exports = {}; modules.set(name, exports);
  const code = ts.transpileModule(readFileSync(name, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, require: id => load(path.resolve(path.dirname(name), id)),
    URLSearchParams, URL, AbortController, setTimeout, clearTimeout, fetch, Date }, { filename: name });
  return exports;
}
const P = load('protocol'), { createAccountClient } = load('client'), { createAccountSession } = load('session-core');
const origin = P.ISSUERS[0], key = 'daychi.cabinet.account.v1.staging';
const random = async () => randomBytes(32).toString('base64url');
const challenge = async value => createHash('sha256').update(value).digest('base64url');
const clone = value => JSON.parse(JSON.stringify(value));
function installation(provider, map = new Map(), read = provider.transport, issuer = origin) {
  const client = createAccountClient(issuer, read);
  const storage = { get: async name => map.get(name) ?? null, set: async (name, value) => { map.set(name, value); }, delete: async name => { map.delete(name); } };
  return { client, map, storage, session: createAccountSession({ origin: issuer, client, storage, random, challenge, now: provider.now }) };
}
async function login(provider, h) {
  const attempt = await h.session.begin(); assert.ok(attempt);
  assert.equal(await h.session.receive(provider.authorize(attempt.url)), true);
  assert.equal(h.session.getState().status, 'active');
  return JSON.parse(h.map.get(key)).session;
}

test('N01 actual HTTP code/PKCE exchange, complete profile, cold restart and issuer isolation', async t => {
  const provider = await startCabinetProvider(); t.after(() => provider.close());
  const profile = { ...syntheticAccount(), hasEmail: true, email: 'student@example.test', pendingEmail: 'next@example.test',
    roles: ['teacher'], canUseStudentMode: true, homeHiddenTiles: ['payment', 'events'] };
  provider.setAccount(profile);
  const h = installation(provider); h.map.set('daychee.access.session.v1', 'legacy'); h.map.set('ordinary.schedule', 'selected');
  const saved = await login(provider, h);
  assert.deepEqual(clone(h.session.getState().account), profile);
  const next = installation(provider, h.map); await next.session.restore();
  assert.deepEqual(clone(next.session.getState().account), profile);
  assert.equal(JSON.parse(next.map.get(key)).session.grant, saved.grant);
  const otherIssuer = installation(provider, h.map, provider.transport, P.ISSUERS[1]); await otherIssuer.session.restore();
  assert.equal(otherIssuer.session.getState().status, 'signed-out');
  assert.equal(h.map.get('daychee.access.session.v1'), 'legacy'); assert.equal(h.map.get('ordinary.schedule'), 'selected');
  assert.equal(provider.recordsAreHashed(), true);
  assert.ok(provider.operations.every(entry => entry.cookie === false));
});

test('N04/N07 HTTP code expiry rejects exchange without replacing a predecessor', async t => {
  const provider = await startCabinetProvider(); t.after(() => provider.close());
  const h = installation(provider), before = await login(provider, h), attempt = await h.session.begin();
  const callback = provider.authorize(attempt.url); provider.advance(60000);
  await h.session.receive(callback);
  assert.equal(h.session.getState().error, 'invalid_grant');
  assert.equal(JSON.parse(h.map.get(key)).session.token, before.token);
  assert.equal(JSON.parse(h.map.get(key)).pending, null);
});

test('N08/N09 HTTP renewal follows server timing; a lost reply preserves a valid predecessor', async t => {
  const provider = await startCabinetProvider(); t.after(() => provider.close());
  let lose = false;
  const h = installation(provider, new Map(), async (url, options) => {
    const response = await provider.transport(url, options);
    if (lose && url.endsWith('/renew')) { lose = false; throw new Error('Synthetic lost response'); }
    return response;
  });
  const before = await login(provider, h);
  provider.advance(7 * 86400 * 1000); await h.session.restore();
  assert.equal(provider.operations.filter(o => o.operation === 'renew').length, 0);
  provider.advance(1000); lose = true; await h.session.restore();
  assert.equal(h.session.getState().status, 'unavailable');
  assert.equal(JSON.parse(h.map.get(key)).session.token, before.token);
  await h.session.restore(); const after = JSON.parse(h.map.get(key)).session;
  assert.equal(h.session.getState().status, 'active'); assert.equal(after.grant, before.grant);
  assert.notEqual(after.token, before.token);
  assert.equal((await h.client.me(before.token, before.grant)).session.id, before.grant);
});

test('N11/N12 two HTTP native grants and browser session survive isolated logout', async t => {
  const provider = await startCabinetProvider(); t.after(() => provider.close());
  const first = installation(provider), second = installation(provider);
  const a = await login(provider, first), b = await login(provider, second); assert.notEqual(a.grant, b.grant);
  await first.session.logout(); assert.equal(first.map.has(key), false);
  // Logout is intentionally asynchronous: wait for acknowledgement explicitly.
  await first.client.revoke(a.token);
  await assert.rejects(() => first.client.me(a.token, a.grant), error => error.kind === 'invalid_token');
  await second.session.restore(); assert.equal(second.session.getState().status, 'active');
  assert.equal(provider.browserAlive(), true);
});

test('N13/N14 HTTP block/unblock, malformed profile, outage and recovery retain the proper credential', async t => {
  const provider = await startCabinetProvider(); t.after(() => provider.close());
  let offline = false;
  const h = installation(provider, new Map(), (url, options) => {
    if (offline) return Promise.reject(new Error('Synthetic outage'));
    return provider.transport(url, options);
  });
  const before = await login(provider, h);
  provider.setBlocked(true); await h.session.restore(); assert.equal(h.session.getState().status, 'blocked');
  provider.setBlocked(false); await h.session.restore(); assert.equal(h.session.getState().status, 'active');
  provider.setAccount({ ...syntheticAccount(), homeHiddenTiles: ['unapproved'] });
  await h.session.restore(); assert.equal(h.session.getState().error, 'invalid-response');
  provider.setAccount(syntheticAccount()); offline = true; await h.session.restore();
  assert.equal(h.session.getState().status, 'unavailable'); assert.equal(JSON.parse(h.map.get(key)).session.token, before.token);
  offline = false; await h.session.restore(); assert.equal(h.session.getState().status, 'active');
  await h.client.revoke(before.token); await h.session.restore();
  assert.equal(h.session.getState().status, 'signed-out'); assert.equal(JSON.parse(h.map.get(key)).session, null);
});

test('N15 failed secure deletion stays disabled; retry plus HTTP-backed restart stays signed out', async t => {
  const provider = await startCabinetProvider(); t.after(() => provider.close());
  const h = installation(provider); await login(provider, h);
  const normal = h.storage.delete; h.storage.delete = async () => { throw new Error('Synthetic storage failure'); };
  await h.session.logout(); assert.equal(h.session.getState().status, 'signout-incomplete');
  const count = provider.operations.length; await h.session.restore(); assert.equal(provider.operations.length, count);
  h.storage.delete = normal; await h.session.logout();
  const next = installation(provider, h.map); await next.session.restore(); assert.equal(next.session.getState().status, 'signed-out');
});

// Execute the actual Expo browser orchestration with synthetic native IO and real
// loopback HTTP. This proves wrapper behavior, NOT device/browser/SecureStore runtime.
function nativeWrapper(os, provider, map, { development = true, pilot = '1', enabled = '0' } = {}) {
  const exports = {}, seen = [], browser = { mode: 'success' };
  const code = ts.transpileModule(readFileSync(path.join(root, 'session.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, __DEV__: development, process: { env: {
    EXPO_PUBLIC_CABINET_ACCOUNT_PILOT: pilot, EXPO_PUBLIC_CABINET_ACCOUNT_ENABLED: enabled,
  } },
    setTimeout, clearTimeout, Date, require: name => ({
      react: { useSyncExternalStore() {} }, 'react-native': { Platform: { OS: os } },
      'expo-secure-store': { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1, getItemAsync: async key => map.get(key) ?? null,
        setItemAsync: async (key, value) => { map.set(key, value); }, deleteItemAsync: async key => { map.delete(key); } },
      'expo-crypto': { getRandomBytesAsync: async size => randomBytes(size),
        CryptoDigestAlgorithm: { SHA256: 'sha256' }, CryptoEncoding: { BASE64: 'base64' },
        digestStringAsync: async (algorithm, value) => createHash(algorithm).update(value).digest('base64') },
      'expo-web-browser': { openAuthSessionAsync: async (url, callback, options) => {
        seen.push({ callback, options });
        return browser.mode === 'success' ? { type: 'success', url: provider.authorize(url) } : { type: 'cancel' };
      }, dismissAuthSession() {}, dismissBrowser() {} },
      './client': { createAccountClient: origin => createAccountClient(origin, provider.transport) },
      './session-core': { createAccountSession: options => createAccountSession({ ...options, now: provider.now }) }, './protocol': P,
    })[name],
  }, { filename: 'synthetic-native-session' });
  return { ...exports, seen, browser };
}
test('Release Cabinet opt-in signs in, restores and revokes without enabling web or a development-only pilot', async t => {
  const provider = await startCabinetProvider(); t.after(() => provider.close());
  for (const [os, enabled] of [['ios', '0'], ['android', '0'], ['web', '1']]) {
    const map = new Map(), native = nativeWrapper(os, provider, map, { development: false, enabled });
    const operations = provider.operations.length;
    assert.equal(native.cabinetAccountEnabled, false);
    await native.signInCabinet(); await native.signOutCabinet();
    assert.equal(await native.redirectCabinetCallback(`${P.CALLBACK}?code=synthetic&state=synthetic`), '/');
    assert.equal(native.seen.length, 0); assert.equal(map.size, 0);
    assert.equal(provider.operations.length, operations);
  }
  for (const os of ['ios', 'android']) {
    const map = new Map(), options = { development: false, pilot: '0', enabled: '1' };
    const native = nativeWrapper(os, provider, map, options);
    assert.equal(native.cabinetAccountEnabled, true);
    await native.signInCabinet(); assert.equal(native.cabinetSession().getState().status, 'active');
    const cold = nativeWrapper(os, provider, map, options);
    await cold.cabinetSession().restore(); assert.equal(cold.cabinetSession().getState().status, 'active');
    const attempt = await cold.cabinetSession().begin(), callback = provider.authorize(attempt.url);
    const restored = nativeWrapper(os, provider, map, options);
    assert.equal(await restored.redirectCabinetCallback(callback), '/cabinet-account');
    assert.equal(restored.cabinetSession().getState().status, 'active');
    await restored.signOutCabinet(); assert.equal(restored.cabinetSession().getState().status, 'signed-out');
  }
});
for (const os of ['ios', 'android']) test(`N01/N05/N16/N17 ${os} Expo wrapper uses PKCE over HTTP, restores cold callback and preserves invitations`, async t => {
  const provider = await startCabinetProvider(); t.after(() => provider.close());
  const map = new Map([['daychee.access.session.v1', 'legacy'], ['ordinary.schedule', 'selected']]);
  const native = nativeWrapper(os, provider, map);
  await native.signInCabinet(); assert.equal(native.cabinetSession().getState().status, 'active');
  assert.equal(native.seen[0].callback, P.CALLBACK); assert.equal(native.seen[0].options.preferEphemeralSession, false);
  native.browser.mode = 'cancel'; await native.signInCabinet(); assert.equal(native.cabinetSession().getState().hasSession, true);
  assert.equal(await native.redirectCabinetCallback('quietpractice://invite#synthetic'), null);
  const attempt = await native.cabinetSession().begin(), callback = provider.authorize(attempt.url);
  const cold = nativeWrapper(os, provider, map);
  assert.equal(await cold.redirectCabinetCallback(callback), '/cabinet-account');
  assert.equal(cold.cabinetSession().getState().status, 'active');
  await cold.signOutCabinet(); assert.equal(cold.cabinetSession().getState().status, 'signed-out');
  assert.equal(map.get('daychee.access.session.v1'), 'legacy'); assert.equal(map.get('ordinary.schedule'), 'selected');
});
