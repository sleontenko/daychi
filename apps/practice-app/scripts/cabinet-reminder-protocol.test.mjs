import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const file = new URL('../src/features/cabinet-reminders/protocol.ts', import.meta.url);
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports, Intl }, { filename: file.pathname });
const { decodeReminderSnapshot: decode, compareReminderRevisions: compare,
  acceptReminderSnapshot: accept, encodeReminderChanges: encode } = exports;
const account = 'synthetic-account';
const id = n => n.toString(16).padStart(24, '0');
const clone = value => JSON.parse(JSON.stringify(value));
const snapshot = (patch = {}) => ({ version: 1, accountId: account, revision: '0',
  classIds: [], lessonIds: [], leadMinutes: null, schoolMinutes: 45, classes: [], ...patch });
const klass = (patch = {}) => ({ id: id(1), title: 'Synthetic practice', groupLabel: '',
  tz: 'Asia/Jerusalem', slots: [{ weekday: 0, time: '09:00', durationMin: 60 }], ...patch });
const invalid = value => assert.throws(() => decode(value, account), /Invalid Cabinet reminder data/);

test('complete empty choices, opaque account identity, school default and additive fields', () => {
  const raw = snapshot({ future: 'ignored', classes: [klass({ meeting: 'not projected' })] });
  const result = decode(raw, account);
  assert.deepEqual(clone(result), snapshot({ classes: [klass()] }));
  raw.classes[0].slots[0].time = '10:00';
  assert.equal(result.classes[0].slots[0].time, '09:00');
  for (const minutes of [0, 15, 30, 60, 120, null]) assert.equal(decode(snapshot({ leadMinutes: minutes }), account).leadMinutes, minutes);
  for (const schoolMinutes of [5, 45, 1440]) assert.equal(decode(snapshot({ schoolMinutes }), account).schoolMinutes, schoolMinutes);
});

test('malformed successes never become empty settings', () => {
  for (const key of Object.keys(snapshot())) { const raw = snapshot(); delete raw[key]; invalid(raw); }
  for (const patch of [{ version: true }, { version: 2 }, { accountId: 'other' }, { revision: 1 },
    { revision: '01' }, { revision: '-1' }, { revision: '1e3' }, { revision: '' }, { leadMinutes: false },
    { leadMinutes: 45 }, { schoolMinutes: true }, { schoolMinutes: 4 }, { schoolMinutes: 1441 },
    { schoolMinutes: 45.5 }, { classes: null }, { classIds: null }, { lessonIds: {} }]) invalid(snapshot(patch));
  for (const raw of [null, [], false, {}, 'settings']) invalid(raw);
  assert.throws(() => decode(snapshot(), ''), /Invalid/);
});

test('selection IDs remain canonical, unique, sorted and complete outside metadata/window', () => {
  const raw = snapshot({ classIds: [id(1), id(2)], lessonIds: [id(10), id(11)], classes: [] });
  assert.deepEqual(clone(decode(raw, account)), raw);
  for (const field of ['classIds', 'lessonIds']) {
    for (const values of [[id(2), id(1)], [id(1), id(1)], [id(10).toUpperCase()], ['legacy-label'], [null], [1]])
      invalid(snapshot({ [field]: values }));
  }
  invalid(snapshot({ classIds: Array.from({ length: 51 }, (_, n) => id(n)) }));
  const many = Array.from({ length: 1000 }, (_, n) => id(n));
  assert.equal(decode(snapshot({ lessonIds: many }), account).lessonIds.length, 1000);
});

test('catalogue is public projection with strict IDs, slots, timezone and metadata shape', () => {
  for (const patch of [{ id: 'label' }, { title: null }, { groupLabel: null }, { tz: 'Unknown/Zone' },
    { tz: '+02:00' }, { slots: null }]) invalid(snapshot({ classes: [klass(patch)] }));
  for (const patch of [{ weekday: true }, { weekday: -1 }, { weekday: 7 }, { weekday: 0.5 },
    { time: '9:00' }, { time: '24:00' }, { time: '12:60' }, { durationMin: false },
    { durationMin: 0 }, { durationMin: 0.5 }, { everyWeeks: 0 }, { everyWeeks: null }, { everyWeeks: 3 }])
    invalid(snapshot({ classes: [klass({ slots: [{ ...klass().slots[0], ...patch }] })] }));
  invalid(snapshot({ classes: [klass(), klass()] }));
  invalid(snapshot({ classes: [klass({ id: id(2) }), klass()] }));
  const valid = klass({ slots: [{ weekday: 6, time: '23:59', durationMin: 1, everyWeeks: 2, future: true }] });
  assert.equal(decode(snapshot({ classes: [valid] }), account).classes[0].slots[0].everyWeeks, 2);
  assert.equal('future' in decode(snapshot({ classes: [valid] }), account).classes[0].slots[0], false);
});

test('arbitrary precision revisions compare numerically; lower snapshots cannot regress', () => {
  for (const [left, right, result] of [['0', '0', 0], ['2', '10', -1], ['10', '2', 1],
    ['9007199254740992', '9007199254740993', -1], ['100000000000000000000', '99999999999999999999', 1]])
    assert.equal(compare(left, right), result);
  for (const value of ['01', '-1', '1.0', ' 1', '1e20']) assert.throws(() => compare(value, '0'), /Invalid/);
  const current = decode(snapshot({ revision: '10', lessonIds: [id(1)] }), account);
  assert.equal(accept(current, snapshot({ revision: '9' }), account), current);
  assert.equal(accept(current, snapshot({ revision: '11' }), account).revision, '11');
  assert.throws(() => accept(current, snapshot({ accountId: 'other' }), 'other'), /Invalid/);
});

test('equal account revision refreshes independent school/catalogue metadata', () => {
  const current = decode(snapshot({ revision: '10', classIds: [id(1)] }), account);
  const refreshed = accept(current, snapshot({ revision: '10', classIds: [id(1)], schoolMinutes: 120, classes: [klass()] }), account);
  assert.equal(refreshed.schoolMinutes, 120);
  assert.equal(refreshed.classes.length, 1);
  assert.deepEqual(clone(refreshed.classIds), [id(1)]);
});

test('specified-key encoding preserves independent class/lesson keys and nullable/zero/120 lead', () => {
  const changes = [{ kind: 'class', id: id(1), selected: true }, { kind: 'lesson', id: id(1), selected: false }, { kind: 'lead', minutes: null }];
  assert.deepEqual(JSON.parse(encode(changes)), { version: 1, changes });
  for (const minutes of [0, 15, 30, 60, 120, null])
    assert.equal(JSON.parse(encode([{ kind: 'lead', minutes }])).changes[0].minutes, minutes);
});

test('invalid batches fail before encoding; no implicit normalization, partial batch or splitting', () => {
  const selected = { kind: 'lesson', id: id(1), selected: true };
  for (const batch of [[], null, {}, [selected, { ...selected, selected: false }],
    [{ kind: 'lead', minutes: 0 }, { kind: 'lead', minutes: null }],
    [{ ...selected, id: id(10).toUpperCase() }], [{ ...selected, selected: 1 }],
    [{ kind: 'all', id: id(1), selected: true }], [{ ...selected, timestamp: 1 }],
    [{ kind: 'lead', minutes: 45 }], [{ kind: 'lead' }], [{ kind: 'lead', minutes: 0, selected: true }],
    [{ ...selected, selected: null }], [{ kind: 'lesson', id: id(1) }],
    Array.from({ length: 65 }, (_, n) => ({ ...selected, id: id(n) }))]) assert.throws(() => encode(batch), /Invalid/);
  const maximum = Array.from({ length: 64 }, (_, n) => ({ ...selected, id: id(n) }));
  const body = encode(maximum);
  assert.equal(JSON.parse(body).changes.length, 64);
  assert.ok(Buffer.byteLength(body, 'utf8') < 128 * 1024);
});
