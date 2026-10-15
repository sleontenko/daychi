import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
const sources = Object.fromEntries(['deletion-client', 'session', 'request-client'].map(name => [name, ts.transpileModule(
  readFileSync(new URL('../src/features/access/' + name + '.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText]));
const A = 'a'.repeat(64), B = 'b'.repeat(64);
const response = (data, status = 200) => ({ ok: status === 200, status, json: async () => data });
function client({ storage = new Map(), fetch, write = async (key, value) => storage.set(key, value), remove = async key => storage.delete(key) } = {}) {
  const modules = {};
  const require = name => {
    if (name.startsWith('./') && sources[name.slice(2)]) return load(name.slice(2));
    return {
      'expo-crypto': { CryptoDigestAlgorithm: { SHA256: 'sha256' }, digestStringAsync: async (_, value) => createHash('sha256').update(value).digest('hex'), getRandomBytesAsync: async () => randomBytes(32) },
      'expo-secure-store': { getItemAsync: async key => storage.get(key) ?? null, setItemAsync: write, deleteItemAsync: remove, WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1 },
      './access-errors': { AccessError: Error, invitationErrors: {} }, './invitation-code': { isInvitationCode: () => false },
      react: { useSyncExternalStore: (_, snapshot) => snapshot() }, 'react-native': { Platform: { OS: 'ios' } },
    }[name];
  };
  function load(name) {
    if (modules[name]) return modules[name];
    const exports = modules[name] = {};
    vm.runInNewContext(sources[name], { exports, require, process: { env: { EXPO_PUBLIC_DAYCHEE_API_URL: 'https://example.test' } }, fetch, AbortController, setTimeout, clearTimeout });
    return exports;
  }
  return { deletion: load('deletion-client'), session: () => load('session'), request: () => load('request-client'), storage };
}
test('lost response, concurrent taps and restart retry the exact operation before cleanup', async () => {
  const storage = new Map([['classes', 'preserve'], ['bookmarks', 'preserve']]), bodies = [];
  let lost = true, cleaned = 0;
  const fetch = async (_, options) => { bodies.push(options.body); if (lost) { lost = false; throw Error('lost'); } return response({ deleted: true }); };
  let c = client({ storage, fetch }); await c.deletion.rememberDeletionCredential(A);
  await assert.rejects(Promise.all([c.deletion.deleteAccessData(async () => cleaned++), c.deletion.deleteAccessData(async () => cleaned++)]), /Не удалось подтвердить/);
  assert.equal(cleaned, 0); assert.equal(bodies.length, 1);
  c = client({ storage, fetch }); assert.equal(await c.deletion.hasPendingDeletion(), true);
  await assert.rejects(c.deletion.rememberDeletionCredential(B), /Сначала завершите/);
  await c.deletion.deleteAccessData(async () => cleaned++);
  assert.equal(bodies[0], bodies[1]); assert.equal(cleaned, 1); assert.equal(await c.deletion.hasPendingDeletion(), false);
  assert.equal(storage.get('classes'), 'preserve'); assert.equal(storage.get('bookmarks'), 'preserve');
  assert.ok(![...storage.values()].includes(A));
});
test('restart finishes confirmed cleanup after proof deletion fails, without sending again', async () => {
  const storage = new Map(); let calls = 0, fail = true, cleanups = 0;
  const fetch = async () => { calls++; return response({ deleted: true }); };
  let c = client({ storage, fetch, remove: async key => { storage.delete(key); if (fail) { fail = false; throw Error('disk'); } } });
  await c.deletion.rememberDeletionCredential(A);
  await assert.rejects(c.deletion.deleteAccessData(async () => cleanups++), /disk/);
  c = client({ storage, fetch }); await c.deletion.deleteAccessData(async () => cleanups++);
  assert.equal(calls, 1); assert.equal(cleanups, 2); assert.equal(await c.deletion.hasPendingDeletion(), false);
});
test('server errors and false confirmation retain keys and never clean personal data', async () => {
  for (const answer of [response({}, 503), response({ deleted: false }), response({ deleted: true }, 404)]) {
    let cleaned = false; const c = client({ fetch: async () => answer }); await c.deletion.rememberDeletionCredential(A);
    await assert.rejects(c.deletion.deleteAccessData(async () => { cleaned = true; }), /Не удалось подтвердить/);
    assert.equal(cleaned, false); assert.ok([...c.storage.values()].includes(A)); assert.equal(await c.deletion.hasPendingDeletion(), true);
  }
});
test('never send deletion before its operation is durably saved', async () => {
  const storage = new Map(); let calls = 0;
  const c = client({ storage, fetch: async () => { calls++; }, write: async (key, value) => { if (key.endsWith('.operation')) throw Error('disk'); storage.set(key, value); } });
  await c.deletion.rememberDeletionCredential(A); await assert.rejects(c.deletion.deleteAccessData(async () => {}), /disk/);
  assert.equal(calls, 0); assert.ok([...storage.values()].includes(A));
});
test('proof history fits Keychain values and does not silently discard prior identities', async () => {
  const c = client();
  await Promise.all(Array.from({ length: 50 }, (_, i) => c.deletion.rememberDeletionCredential(i.toString(16).padStart(128, '0'))));
  assert.ok([...c.storage.values()].every(value => Buffer.byteLength(value) < 2048));
  await assert.rejects(c.deletion.rememberDeletionCredential(B), /прежних заявок/);
  assert.equal([...c.storage.values()].filter(value => value.length === 128).length, 50);
});
test('migrate legacy session before unauthorized response and preserve proof after logout', async () => {
  const storage = new Map([['daychee.access.session.v1', A]]);
  const c = client({ storage, fetch: async url => response({}, url.endsWith('/session') ? 401 : 200) });
  await c.session().restoreAccess(); assert.equal(storage.has('daychee.access.session.v1'), false);
  assert.ok([...storage.values()].includes(A));
});
test('new request retains rejected request secret and deletion proves both identities', async () => {
  const storage = new Map([['daychee.access.request.v1', JSON.stringify({ profile: { first_name: 'Demo', last_name: 'Test', telegram: '' }, status: 'rejected', submitted: true, secret: A, session: B })]]);
  let proofs;
  const c = client({ storage, fetch: async (url, options) => {
    if (url.endsWith('/delete')) { proofs = JSON.parse(options.body).credentials; return response({ deleted: true }); }
    return response({ status: 'pending' });
  } });
  await c.request().loadAccessRequest(); await c.request().newAccessRequest(); await c.request().submitAccessRequest();
  await c.deletion.deleteAccessData(async () => {});
  assert.equal(proofs.length, 2); assert.ok(proofs.includes(A));
});
test('deletion waits for an in-flight access grant and includes its persisted proof', async () => {
  let release, entered;
  const started = new Promise(resolve => { entered = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  let proofs;
  const c = client({ fetch: async (_, options) => { proofs = JSON.parse(options.body).credentials; return response({ deleted: true }); } });
  await c.deletion.rememberDeletionCredential(A);
  const grant = c.deletion.withAccessMutation(async () => { entered(); await gate; await c.deletion.rememberDeletionCredential(B); });
  await started;
  const removal = c.deletion.deleteAccessData(async () => {});
  await Promise.resolve(); assert.equal(proofs, undefined);
  release(); await grant; await removal;
  assert.deepEqual([...proofs].sort(), [A, B]);
});
test('a saved deletion prevents later access mutation until its exact retry completes', async () => {
  let lost = true, changed = false;
  const c = client({ fetch: async () => { if (lost) throw Error('lost'); return response({ deleted: true }); } });
  await c.deletion.rememberDeletionCredential(A);
  await assert.rejects(c.deletion.deleteAccessData(async () => {}));
  await assert.rejects(c.deletion.withAccessMutation(async () => { changed = true; }), /Сначала завершите/);
  assert.equal(changed, false);
  lost = false; await c.deletion.deleteAccessData(async () => {});
  await c.deletion.withAccessMutation(async () => { changed = true; });
  assert.equal(changed, true);
});
