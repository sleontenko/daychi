import assert from 'node:assert/strict';
import test from 'node:test';
import { cabinetWindow, cabinetLessonsURL, decodePublicLessons, createCabinetPilot } from '../src/features/schedule/cabinet-pilot.ts';

const now = () => Date.parse('2026-10-09T12:00:00Z');
const lesson = (id = 'opaque-occurrence', patch = {}) => ({
  id, classId: 'opaque-class', startsAt: '2026-10-09T06:00:00.000Z', durationMin: 60,
  classTitle: 'Тайцзи', groupLabel: 'Учебная группа', format: 'both', topic: 'Практика',
  status: 'scheduled', tags: [], ...patch,
});
const response = (rows, status = 200) => new Response(JSON.stringify(rows), {
  status, headers: { 'Content-Type': 'application/json' },
});

test('fourteen school dates use independent offsets across autumn and spring DST', () => {
  const autumn = cabinetWindow(Date.parse('2024-10-20T12:00:00Z'));
  assert.deepEqual(autumn, { from: '2024-10-20T00:00:00+03:00', to: '2024-11-03T00:00:00+02:00' });
  assert.equal((Date.parse(autumn.to) - Date.parse(autumn.from)) / 3600000, 337);
  const spring = cabinetWindow(Date.parse('2026-03-20T12:00:00Z'));
  assert.equal((Date.parse(spring.to) - Date.parse(spring.from)) / 3600000, 335);
  const afterSchoolMidnight = cabinetWindow(Date.parse('2026-10-08T22:00:00Z'));
  assert.equal(afterSchoolMidnight.from, '2026-10-09T00:00:00+03:00');
});

test('request uses encoded offsets and only the agreed window operation', async () => {
  let request;
  const pilot = createCabinetPilot({ origin: 'https://cabinet.example/', now,
    fetch: async (...args) => { request = args; return response([lesson()]); } });
  await pilot.refresh();
  const [url, options] = request;
  assert.match(url, /^https:\/\/cabinet.example\/api\/public\/lessons\?/);
  assert.match(url, /%2B03%3A00/);
  assert.deepEqual([...new URL(url).searchParams.keys()], ['from', 'to']);
  assert.equal(options.credentials, 'omit');
  assert.equal(options.cache, 'no-store');
  assert.equal(options.headers, undefined);
  assert.equal(options.body, undefined);
  assert.ok(options.signal instanceof AbortSignal);
  assert.equal(pilot.getState().result.lessons[0].id, 'opaque-occurrence');
});

test('reject bad origin configuration before any network read; allow disposable HTTP origin', async () => {
  let calls = 0;
  for (const origin of ['', 'file:///tmp', 'https://cabinet.example/api', 'https://u:p@cabinet.example', 'https://cabinet.example/?token=x']) {
    const pilot = createCabinetPilot({ origin, now, fetch: async () => { calls++; return response([]); } });
    assert.equal((await pilot.refresh()).error, 'configuration');
  }
  assert.equal(calls, 0);
  assert.match(cabinetLessonsURL('http://10.0.2.2:3000', cabinetWindow(now())), /^http:\/\/10.0.2.2:3000\/api\/public\/lessons/);
});

test('preserve empty fields, optional absent location, nonempty opaque IDs and shared class relationship', () => {
  const rows = decodePublicLessons([lesson('A', { classTitle: '', groupLabel: '', topic: '', durationMin: 0 }),
    lesson('a', { location: '', status: 'cancelled' })]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].classId, rows[1].classId);
  assert.equal(Object.hasOwn(rows[0], 'location'), false);
  assert.equal(rows[1].location, '');
  assert.equal(rows[1].status, 'cancelled');
});

test('malformed success rejects the entire refresh instead of dropping rows on the client', () => {
  const bad = [null, {}, { lessons: [] }, [null], [lesson(), lesson()], [lesson('', {})],
    [lesson('x', { classId: '' })], [lesson('x', { startsAt: '2026-10-09T06:00:00+03:00' })],
    [lesson('x', { startsAt: '2026-02-30T06:00:00Z' })], [lesson('x', { durationMin: Infinity })],
    [lesson('x', { format: 'unknown' })], [lesson('x', { status: 'deleted' })],
    [lesson('x', { tags: [1] })], [lesson('x', { location: null })],
    [lesson('x', { classTitle: null })], [lesson('x', { zoomLink: 'private-extra-field' })],
    [lesson('x', { tags: undefined })]];
  for (const value of bad) assert.throws(() => decodePublicLessons(value));
  const missing = lesson(); delete missing.durationMin;
  assert.throws(() => decodePublicLessons([lesson('valid'), missing]));
});

test('interval edges include earlier lessons today, reject outside starts and have no 200-row cap', () => {
  const window = cabinetWindow(now());
  assert.equal(decodePublicLessons([lesson('from', { startsAt: new Date(window.from).toISOString() }),
    lesson('earlier-today'), lesson('last', { startsAt: new Date(Date.parse(window.to) - 1000).toISOString() })], window).length, 3);
  for (const stamp of [Date.parse(window.from) - 1000, Date.parse(window.to)])
    assert.throws(() => decodePublicLessons([lesson('outside', { startsAt: new Date(stamp).toISOString() })], window));
  assert.equal(decodePublicLessons(Array.from({ length: 201 }, (_, i) => lesson(String(i))), window).length, 201);
  assert.throws(() => decodePublicLessons([lesson('later', { startsAt: '2026-10-10T06:00:00Z' }), lesson('earlier')], window));
});

test('moves and cancellation keep identities; omissions replace instead of merging; repair restores rows', async () => {
  const reads = [[lesson('a'), lesson('b')], [lesson('b'), lesson('a', { startsAt: '2026-10-10T06:00:00Z' })],
    [lesson('b', { status: 'cancelled' })], [], [lesson('a'), lesson('b')]];
  const pilot = createCabinetPilot({ origin: 'https://cabinet.example', now, fetch: async () => response(reads.shift()) });
  assert.deepEqual((await pilot.refresh()).result.lessons.map(row => row.id), ['a', 'b']);
  let state = await pilot.refresh();
  assert.deepEqual(state.result.lessons.map(row => row.id), ['b', 'a']);
  assert.equal(state.result.lessons[1].startsAt, '2026-10-10T06:00:00Z');
  state = await pilot.refresh();
  assert.deepEqual(state.result.lessons.map(row => [row.id, row.status]), [['b', 'cancelled']]);
  assert.deepEqual((await pilot.refresh()).result.lessons, []);
  assert.deepEqual((await pilot.refresh()).result.lessons.map(row => row.id), ['a', 'b']);
});

for (const failure of ['transport', '400', '401', '429', '500', '503', '201', '204', 'bad-json', 'bad-item', 'wrong-mime']) {
  test(`initial ${failure} exposes unavailable; later failure retains prior rows and recovery replaces`, async () => {
    let mode = failure;
    const pilot = createCabinetPilot({ origin: 'https://cabinet.example', now, fetch: async () => {
      if (mode === 'transport') throw new Error('Private transport details');
      if (mode === 'bad-json') return new Response('<html>failure</html>');
      if (mode === 'wrong-mime') return new Response(JSON.stringify([lesson()]), { headers: { 'Content-Type': 'text/plain' } });
      if (mode === 'bad-item') return response([lesson('bad', { format: 'invalid' })]);
      if (mode === '204') return new Response(null, { status: 204 });
      if (mode === 'success') return response([lesson('saved')]);
      if (mode === 'empty') return response([]);
      return response({ code: 'error' }, Number(mode));
    } });
    assert.equal((await pilot.refresh()).result, null);
    assert.ok(pilot.getState().error);
    mode = 'success';
    const saved = (await pilot.refresh()).result;
    mode = failure;
    const failed = await pilot.refresh();
    assert.equal(failed.result, saved);
    assert.ok(failed.error);
    assert.doesNotMatch(JSON.stringify(failed), /Private transport details/);
    mode = 'empty';
    assert.deepEqual((await pilot.refresh()).result.lessons, []);
    assert.equal(pilot.getState().error, null);
  });
}

test('concurrent refresh clicks share one request and timeouts keep the prior successful result', async () => {
  let release; let calls = 0;
  const pilot = createCabinetPilot({ origin: 'https://cabinet.example', now, fetch: () => {
    calls++; return new Promise(resolve => { release = () => resolve(response([lesson()])); });
  } });
  const first = pilot.refresh(), second = pilot.refresh();
  assert.equal(first, second);
  assert.equal(calls, 1);
  assert.equal(pilot.getState().loading, true);
  release(); await first;
  assert.equal(pilot.getState().loading, false);
  let timedCalls = 0;
  const timed = createCabinetPilot({ origin: 'https://cabinet.example', now, timeoutMs: 10,
    fetch: (_url, { signal }) => {
      if (!timedCalls++) return Promise.resolve(response([lesson('saved')]));
      return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('timeout'))));
    } });
  const saved = (await timed.refresh()).result;
  const failed = await timed.refresh();
  assert.equal(failed.error, 'network');
  assert.equal(failed.result, saved);
  assert.equal(failed.loading, false);
});
