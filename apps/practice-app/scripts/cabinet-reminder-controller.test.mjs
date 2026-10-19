import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { typescriptLoader } from './fixtures/load-typescript.mjs';
const load = typescriptLoader(fileURLToPath(new URL('../src/features/', import.meta.url)));
const { createReminderController, reminderCacheKey } = load('cabinet-reminders/controller');
const { CabinetError } = load('cabinet-account/protocol');
const { ReminderRequestError } = load('cabinet-account/reminders-client');
const { accountReminderPlan, reconcileAccountReminders, accountReminderPrefix } = load('cabinet-reminders/reminders');
const clone = v => JSON.parse(JSON.stringify(v));
const id = n => n.toString(16).padStart(24, '0');
const origin = 'https://staging.xuanxue.su';
const scope = { issuer: origin, accountId: 'synthetic-account' };
const snapshot = patch => ({ version: 1, accountId: scope.accountId, revision: '1', classIds: [], lessonIds: [],
  leadMinutes: null, schoolMinutes: 45, classes: [], ...patch });
const lesson = (n = 1, patch = {}) => ({ id: id(n), classId: id(100), startsAt: '2026-10-20T10:00:00Z',
  durationMin: 60, classTitle: 'Synthetic practice', groupLabel: '', format: 'online', topic: '', status: 'scheduled', tags: [], ...patch });
const calendar = rows => ({ from: '2026-10-20T00:00:00Z', to: '2026-11-03T00:00:00Z', fetchedAt: 1000, lessons: rows });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function harness({ beforeGet = async () => {} } = {}) {
  let ctx = { ...scope, generation: 1, logoutVersion: 0, grantId: 'synthetic-grant', status: 'active', signIn: 'idle' };
  let data = snapshot({ classIds: [id(100)] }), rows = calendar([lesson()]), stamp = Date.parse('2026-10-20T08:00:00Z');
  let failure = null, readOverride = null, saveOverride = null;
  const storage = new Map([['guest', 'guest-choice']]), calls = [], plans = [];
  const c = createReminderController({ context: () => ctx, now: () => stamp,
    get: async key => { await beforeGet(key); return storage.get(key) ?? null; }, set: async (key, value) => { storage.set(key, value); },
    request: async changes => {
      calls.push(changes ? clone(changes) : 'GET');
      if (failure) throw failure;
      if (!changes) return readOverride ? readOverride() : clone(data);
      if (saveOverride) return saveOverride(changes);
      for (const change of changes) {
        if (change.kind === 'lead') data.leadMinutes = change.minutes;
        else {
          const key = change.kind === 'class' ? 'classIds' : 'lessonIds';
          data[key] = [...new Set([...data[key].filter(x => x !== change.id), ...(change.selected ? [change.id] : [])])].sort();
        }
      }
      data.revision = String(BigInt(data.revision) + 1n); return clone(data);
    },
    calendar: async issuer => { assert.equal(issuer, ctx.issuer); if (rows instanceof Error) throw rows; return clone(rows); },
    reconcile: async (state, current) => { if (current()) plans.push(clone(state)); },
  });
  return { c, storage, calls, plans, async start() { c.setOnline(true); await c.attach(); await c.refresh(); },
    context: patch => { ctx = { ...ctx, ...patch }; }, data: patch => { data = { ...data, ...patch }; },
    rows: value => { rows = value; }, fail: error => { failure = error; },
    read: fn => { readOverride = fn; }, save: fn => { saveOverride = fn; }, advance: ms => { stamp += ms; } };
}

test('sign-in reads Cabinet without guest upload; complete choices and metadata are cached separately', async () => {
  const h = harness(); await h.start();
  assert.equal(h.c.canEdit(), true); assert.deepEqual(h.calls, ['GET']);
  assert.equal(h.storage.get('guest'), 'guest-choice');
  const cached = JSON.parse(h.storage.get(reminderCacheKey(scope)));
  assert.equal(cached.confirmed.schoolMinutes, 45); assert.equal(cached.calendar.lessons[0].id, id(1));
});
test('offline changes are refused without dispatch or intent replay; reconnect refreshes', async () => {
  const h = harness(); await h.start(); h.c.setOnline(false);
  assert.equal(await h.c.save([{ kind: 'lead', minutes: 120 }]), false);
  assert.deepEqual(h.calls, ['GET']); assert.equal(h.c.getState().confirmed.leadMinutes, null);
  h.c.setOnline(true); assert.equal(h.c.canEdit(), false); await h.c.refresh();
  assert.deepEqual(h.calls, ['GET', 'GET']); assert.equal(h.c.canEdit(), true);
});
test('deliberate saves are serial, confirmed only after response, and preserve other keys', async () => {
  const h = harness(); await h.start(); const d = deferred(); h.save(() => d.promise);
  const pending = h.c.save([{ kind: 'lead', minutes: 120 }]);
  assert.equal(h.c.getState().phase, 'saving'); assert.equal(h.c.getState().confirmed.leadMinutes, null);
  assert.equal(await h.c.save([{ kind: 'lesson', id: id(2), selected: true }]), false);
  d.resolve(snapshot({ revision: '2', classIds: [id(100)], leadMinutes: 120 })); await pending;
  assert.deepEqual(clone(h.c.getState().confirmed.classIds), [id(100)]); assert.equal(h.c.getState().confirmed.leadMinutes, 120);
  assert.equal(h.calls.filter(x => x !== 'GET').length, 1);
});
test('committed lost reply recovers current state, including another client change, without replay', async () => {
  const h = harness(); await h.start();
  h.save(async () => { h.data({ revision: '2', leadMinutes: 120 }); throw new ReminderRequestError(0); });
  await h.c.save([{ kind: 'lead', minutes: 120 }]);
  assert.equal(h.c.getState().phase, 'uncertain'); assert.equal(h.c.getState().confirmed.leadMinutes, null);
  h.data({ revision: '3', leadMinutes: 15 }); await h.c.refresh();
  assert.equal(h.c.getState().confirmed.leadMinutes, 15); assert.equal(h.c.getState().phase, 'ready');
  assert.equal(h.calls.filter(x => x !== 'GET').length, 1);
});
test('noncommitted timeout and malformed PATCH success retain confirmed reminders until readback', async () => {
  for (const value of [null, snapshot({ schoolMinutes: 1 }), snapshot({ revision: '0' })]) {
    const h = harness(); await h.start(); const before = h.plans.length;
    h.save(async () => value); await h.c.save([{ kind: 'lead', minutes: 0 }]);
    assert.equal(h.c.getState().phase, 'uncertain'); assert.equal(h.plans.length, before);
    await h.c.refresh(); assert.equal(h.c.canEdit(), true); assert.equal(h.c.getState().confirmed.leadMinutes, null);
  }
});
test('429 supplied delay blocks GET and further saves, without scheduling a retry timer', async () => {
  const h = harness(); await h.start(); h.fail(new ReminderRequestError(429, 60));
  await h.c.save([{ kind: 'lead', minutes: 0 }]); const count = h.calls.length;
  await h.c.refresh(); assert.equal(h.calls.length, count); assert.equal(h.c.canEdit(), false);
  h.advance(60000); h.fail(null); await h.c.refresh(); assert.equal(h.c.canEdit(), true);
});
test('validation refusal preserves confirmed state and permits a corrected deliberate operation', async () => {
  const h = harness(); await h.start(); h.fail(new ReminderRequestError(409));
  await h.c.save([{ kind: 'class', id: id(101), selected: true }]);
  assert.equal(h.c.getState().phase, 'ready'); assert.deepEqual(clone(h.c.getState().confirmed.classIds), [id(100)]);
  h.fail(null); await h.c.save([{ kind: 'lesson', id: id(2), selected: true }]);
  assert.deepEqual(clone(h.c.getState().confirmed.lessonIds), [id(2)]);
});
test('lower revision cannot regress; equal revision refreshes school and catalogue', async () => {
  const h = harness(); await h.start(); h.data({ revision: '0', classIds: [] }); await h.c.refresh();
  assert.deepEqual(clone(h.c.getState().confirmed.classIds), [id(100)]); assert.equal(h.c.canEdit(), false);
  h.data({ revision: '1', classIds: [id(100)], schoolMinutes: 120 }); await h.c.refresh();
  assert.equal(h.c.getState().confirmed.schoolMinutes, 120); assert.equal(h.c.canEdit(), true);
});
test('successful partial/empty calendar replaces rows without deleting IDs; failure retains rows', async () => {
  const h = harness(); await h.start(); h.rows(new Error('offline')); await h.c.refresh();
  assert.equal(h.c.getState().calendar.lessons.length, 1);
  h.rows(calendar([])); await h.c.refresh(); assert.equal(h.c.getState().calendar.lessons.length, 0);
  assert.deepEqual(clone(h.c.getState().confirmed.classIds), [id(100)]);
  h.rows(calendar([lesson(1, { startsAt: '2026-10-21T11:00:00Z' })])); await h.c.refresh();
  assert.equal(h.c.getState().calendar.lessons[0].startsAt, '2026-10-21T11:00:00Z');
});
test('logout invalidates late PATCH, cancels account ownership, and preserves guest/server cache', async () => {
  const h = harness(); await h.start(); const d = deferred(); h.save(() => d.promise);
  const pending = h.c.save([{ kind: 'lead', minutes: 120 }]);
  h.context({ generation: 2, logoutVersion: 1, grantId: null, accountId: null, status: 'signed-out' }); await h.c.attach();
  d.resolve(snapshot({ revision: '2', leadMinutes: 120 })); await pending;
  assert.equal(h.c.getState().scope, null); assert.equal(h.plans.at(-1).scope, null);
  assert.equal(h.storage.get('guest'), 'guest-choice'); assert.ok(h.storage.has(reminderCacheKey(scope)));
});
test('another issuer/account/grant and background generation fence late reads', async () => {
  for (const patch of [{ issuer: 'https://xuanxue.su', generation: 2 }, { accountId: 'other', grantId: 'other-grant', generation: 2 }, { generation: 2, status: 'unavailable' }]) {
    const h = harness(); await h.start(); const d = deferred(); h.read(() => d.promise);
    const pending = h.c.refresh(); await new Promise(resolve => setImmediate(resolve));
    h.context(patch); await h.c.attach(); d.resolve(snapshot({ revision: '99', leadMinutes: 120 })); await pending;
    assert.notEqual(h.c.getState().confirmed?.revision, '99');
  }
});
test('new unknown grant cannot inherit former account cache; bound grant can restore offline', async () => {
  const h = harness(); await h.start();
  h.context({ generation: 2, grantId: 'new-grant', accountId: null, status: 'checking' }); await h.c.attach();
  assert.equal(h.c.getState().confirmed, null);
  h.context({ generation: 3, grantId: 'synthetic-grant', accountId: null, status: 'unavailable' }); await h.c.attach();
  assert.equal(h.c.getState().confirmed?.accountId, scope.accountId); assert.equal(h.c.canEdit(), false);
});
test('blocked/auth failure retains confirmed cache and active plan without allowing edits', async () => {
  const h = harness(); await h.start(); h.fail(new CabinetError('account_blocked'));
  await h.c.refresh(); assert.equal(h.c.getState().phase, 'refused');
  assert.equal(h.c.getState().confirmed.revision, '1'); assert.equal(h.c.canEdit(), false);
});
test('a refused credential owner stays in the explicit account-recovery UI without dispatch', async () => {
  const h = harness(); await h.start(); const count = h.calls.length;
  h.context({ status: 'blocked', accountId: null }); await h.c.refresh();
  assert.equal(h.c.getState().phase, 'refused'); assert.equal(h.calls.length, count);
  assert.equal(h.c.getState().confirmed.revision, '1');
});
test('concurrent refresh waits for cache hydration and cannot be overwritten by an older disk snapshot', async () => {
  const gate = deferred();
  const h = harness({ beforeGet: key => key === reminderCacheKey(scope) ? gate.promise : Promise.resolve() });
  h.storage.set(reminderCacheKey(scope), JSON.stringify({ version: 1, confirmed: snapshot({ revision: '1' }), calendar: calendar([]) }));
  h.data({ revision: '2', leadMinutes: 120 }); h.c.setOnline(true);
  const attach = h.c.attach(), refresh = h.c.refresh();
  await new Promise(resolve => setImmediate(resolve)); assert.equal(h.calls.length, 0);
  gate.resolve(); await Promise.all([attach, refresh]);
  assert.equal(h.c.getState().confirmed.revision, '2'); assert.equal(h.c.getState().confirmed.leadMinutes, 120);
});
test('invalid deliberate IDs are refused before IO without an unhandled error', async () => {
  const h = harness(); await h.start();
  assert.equal(await h.c.save([{ kind: 'lesson', id: 'legacy-label', selected: true }]), false);
  assert.deepEqual(h.calls, ['GET']); assert.equal(h.c.getState().phase, 'ready');
});
test('initial disk loading preserves current-account OS entries while removing a former account and guest', async () => {
  const mine = accountReminderPrefix(scope) + id(1), other = accountReminderPrefix({ ...scope, accountId: 'other' }) + id(1);
  const pending = new Map([mine, other, 'quiet-class:guest'].map(id => [id, { id, at: 100, title: 'Synthetic' }]));
  await reconcileAccountReminders([], scope, { current: () => true, capacity: 60, preserveCurrent: true,
    pending: async () => [...pending.values()], cancel: async id => pending.delete(id), schedule: async () => assert.fail() });
  assert.deepEqual([...pending.keys()], [mine]);
});
test('union eligibility, cancelled/restored identity, zero/120/default45 and no start catch-up', () => {
  const now = Date.parse('2026-10-20T08:00:00Z'), rows = [lesson()];
  for (const [leadMinutes, effective] of [[null, 45], [0, 0], [120, 120]]) {
    const plan = accountReminderPlan(scope, snapshot({ classIds: [id(100)], lessonIds: [id(1)], leadMinutes }), rows, true, now - 1);
    assert.equal(plan.length, 1); assert.equal(plan[0].at, Date.parse(rows[0].startsAt) - effective * 60000);
  }
  assert.equal(accountReminderPlan(scope, snapshot({ lessonIds: [id(1)], leadMinutes: 0 }), rows, true, Date.parse(rows[0].startsAt)).length, 0);
  assert.equal(accountReminderPlan(scope, snapshot({ classIds: [id(100)] }), [lesson(1, { status: 'cancelled' })], true, now).length, 0);
  assert.equal(accountReminderPlan(scope, snapshot({ classIds: [id(100)] }), rows, true, now).length, 1);
  assert.equal(accountReminderPlan(scope, snapshot({}), rows, true, now).length, 0);
});
test('bounded queue removes/moves first under pressure, preserving all choices and unrelated notifications', async () => {
  const now = Date.parse('2026-10-20T00:00:00Z');
  const rows = Array.from({ length: 100 }, (_, n) => lesson(n + 1, { startsAt: new Date(now + (n + 1) * 3600000).toISOString() }));
  const state = snapshot({ classIds: [id(100)], lessonIds: rows.map(r => r.id) });
  const plan = accountReminderPlan(scope, state, rows, true, now);
  const pending = new Map([['unrelated', { id: 'unrelated', at: 1, title: 'other' }], ['quiet-class:guest', { id: 'quiet-class:guest', at: 1, title: 'guest' }],
    [accountReminderPrefix(scope) + id(999), { id: accountReminderPrefix(scope) + id(999), at: 2, title: 'cancelled' }]]);
  const order = [];
  const result = await reconcileAccountReminders(plan, scope, { current: () => true, capacity: 60, totalCapacity: 64,
    pending: async () => [...pending.values()], cancel: async id => { order.push('cancel'); pending.delete(id); },
    schedule: async row => { order.push('schedule'); pending.set(row.id, { id: row.id, at: row.at, title: row.lesson.classTitle }); } });
  assert.equal(result.scheduled, 60); assert.equal(result.eligible, 100); assert.equal(state.lessonIds.length, 100);
  assert.equal(pending.has('quiet-class:guest'), false); assert.equal(pending.has('unrelated'), true);
  assert.deepEqual(order.slice(0, 2), ['cancel', 'cancel']);
  await reconcileAccountReminders([], scope, { current: () => true, capacity: 60,
    pending: async () => [...pending.values()], cancel: async id => pending.delete(id), schedule: async () => assert.fail() });
  assert.equal(pending.size, 1);
});
