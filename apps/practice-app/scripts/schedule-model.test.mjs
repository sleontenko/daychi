import assert from 'node:assert/strict';
import test from 'node:test';
import { dayKey, decodeChoices, decodeSchedule, isFresh } from '../src/features/schedule/model.ts';

const valid = () => ({
  revision: 'test', fetched_at: '2026-09-17T09:00:00Z', valid_until: '2026-09-17T09:05:00Z',
  source_url: 'https://www.telaviv-taiji.com/kogda', timezone: 'Asia/Jerusalem',
  kind: 'weekly_template', exceptions_verified: false,
  occurrences: [{ id: 'test:2026-09-17', title: 'Test', starts_at: '2026-09-17T14:00:00+03:00',
    ends_at: '2026-09-17T15:00:00+03:00', status: 'scheduled' }],
});

test('reject naive timestamps and duplicated occurrence IDs', () => {
  assert.throws(() => decodeSchedule({ ...valid(), fetched_at: '2026-09-17T09:00:00' }));
  const data = valid(); data.occurrences.push(data.occurrences[0]);
  assert.throws(() => decodeSchedule(data));
});
test('reject unexpected source and invalid event interval', () => {
  assert.throws(() => decodeSchedule({ ...valid(), source_url: 'https://example.org' }));
  const data = valid(); data.occurrences[0].ends_at = data.occurrences[0].starts_at;
  assert.throws(() => decodeSchedule(data));
});
test('freshness has explicit boundaries', () => {
  const data = decodeSchedule(valid());
  assert.equal(isFresh(data, Date.parse(data.fetched_at)), true);
  assert.equal(isFresh(data, Date.parse(data.fetched_at) - 1), false);
  assert.equal(isFresh(data, Date.parse(data.valid_until)), false);
});
test('Israel date handles midnight and winter time', () => {
  assert.equal(dayKey('2026-09-16T22:00:00Z'), '2026-09-17');
  assert.equal(dayKey('2026-10-25T21:30:00Z'), '2026-10-25');
  assert.equal(dayKey('2026-10-25T22:30:00Z'), '2026-10-26');
});
test('preferences accept only explicit true values', () => {
  assert.deepEqual(decodeChoices({ a: true, b: false, c: 'true' }), { a: true });
  assert.deepEqual(decodeChoices(null), {});
  assert.deepEqual(decodeChoices(['a']), {});
});
