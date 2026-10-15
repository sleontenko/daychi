import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProtectedReader } from './src/protected-read.js';

const material = { id: 'lesson_1', links: [{ url: 'https://youtu.be/abcdefghijk' }] };
const validate = (value, identity) => value?.id === identity && Array.isArray(value.links) ? value : null;
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

test('every reopen checks again; refused and unavailable reads discard the previous private payload', async () => {
  const outcomes = [{ kind: 'allowed', value: material }, { kind: 'denied' }, { kind: 'allowed', value: material },
    { kind: 'invalid-credential' }, { kind: 'unavailable' }, { kind: 'missing' }];
  const seen = [], reader = createProtectedReader({ read: async (id, signal) => {
    seen.push(id); assert.equal(signal.aborted, false); return outcomes.shift();
  }, validate });
  for (const status of ['ready', 'denied', 'ready', 'sign-in-required', 'unavailable', 'missing']) {
    await reader.open('lesson_1');
    assert.equal(reader.getState().status, status);
    assert.equal(reader.getState().value, status === 'ready' ? material : null);
  }
  assert.equal(seen.length, 6);
});

test('close/logout/background immediately clears private state; a delayed result cannot reopen it', async () => {
  const gate = deferred(), entered = deferred(); let signal;
  const reader = createProtectedReader({ read: async (_id, ownSignal) => {
    signal = ownSignal; entered.resolve(); return gate.promise;
  }, validate });
  const opening = reader.open('lesson_1'); await entered.promise;
  reader.invalidate(); assert.equal(signal.aborted, true);
  assert.deepEqual(reader.getState(), { status: 'idle', materialId: null, value: null });
  await opening;
  gate.resolve({ kind: 'allowed', value: material }); await Promise.resolve();
  assert.equal(reader.getState().value, null);
});

test('a new material owns the state even when an earlier request fails or succeeds later', async () => {
  const old = deferred(), entered = deferred();
  const reader = createProtectedReader({ read: async id => {
    if (id === 'lesson_1') { entered.resolve(); return old.promise; }
    return { kind: 'allowed', value: { ...material, id } };
  }, validate });
  const first = reader.open('lesson_1'); await entered.promise;
  await reader.open('lesson_2'); old.resolve({ kind: 'denied' }); await first;
  assert.equal(reader.getState().materialId, 'lesson_2');
  assert.equal(reader.getState().status, 'ready');
});

test('profile, malformed/private material, thrown secrets and invalid IDs never produce a ready state', async () => {
  for (const outcome of [true, { account: { status: 'active' } }, { kind: 'allowed', value: {} },
    { kind: 'allowed', value: { ...material, id: 'other' } }, { kind: 'unknown' }]) {
    const reader = createProtectedReader({ read: async () => outcome, validate });
    await reader.open('lesson_1'); assert.equal(reader.getState().status, 'unavailable');
    assert.equal(reader.getState().value, null);
  }
  let count = 0;
  const reader = createProtectedReader({ read: async () => { count++; throw new Error('synthetic-secret'); }, validate });
  await reader.open('https://untrusted.test/'); assert.equal(count, 0);
  await reader.open('lesson_1'); assert.equal(count, 1);
  assert.equal(JSON.stringify(reader.getState()).includes('synthetic-secret'), false);
});

test('timeout bounds even a transport that ignores cancellation; retry recovers', async () => {
  let hung = true;
  const reader = createProtectedReader({ read: async () => hung ? new Promise(() => {}) : { kind: 'allowed', value: material }, validate, timeoutMs: 3 });
  await reader.open('lesson_1'); assert.equal(reader.getState().status, 'unavailable');
  hung = false; await reader.open('lesson_1'); assert.equal(reader.getState().status, 'ready');
});

test('dispose clears private state and stops future reads and notifications', async () => {
  let reads = 0, notifications = 0;
  const reader = createProtectedReader({ read: async () => { reads++; return { kind: 'allowed', value: material }; }, validate });
  reader.subscribe(() => { notifications++; });
  await reader.open('lesson_1'); reader.dispose(); const final = notifications;
  await reader.open('lesson_1'); assert.equal(notifications, final); assert.equal(reads, 1);
  assert.deepEqual(reader.getState(), { status: 'idle', materialId: null, value: null });
});
