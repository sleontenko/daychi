import assert from 'node:assert/strict';
import test from 'node:test';
import { cabinetMatchesFormat, cabinetPresentation } from '../src/features/schedule/cabinet-presentation.ts';

const lesson = { id: 'opaque', classId: 'class', startsAt: '2026-10-09T06:00:00Z',
  durationMin: 60, classTitle: 'Plain title', groupLabel: 'Group', topic: 'Topic',
  format: 'both', tags: [], status: 'cancelled' };

test('format filters use provider enum, independently of words in titles', () => {
  for (const format of ['online', 'offline', 'both']) {
    const row = { ...lesson, format, classTitle: 'Онлайн в парке' };
    assert.equal(cabinetMatchesFormat(row, 'all'), true);
    assert.equal(cabinetMatchesFormat(row, 'online'), format !== 'offline');
    assert.equal(cabinetMatchesFormat(row, 'in-person'), format !== 'online');
  }
});

test('presentation preserves exact title and metadata without inventing school content', () => {
  const before = structuredClone(lesson);
  assert.deepEqual(cabinetPresentation(lesson), { title: 'Plain title', meta: 'Онлайн и очно',
    description: 'Group · Topic', endsAt: '2026-10-09T07:00:00.000Z' });
  assert.equal(cabinetPresentation({ ...lesson, location: 'Test hall' }).meta, 'Test hall · Онлайн и очно');
  assert.equal(cabinetPresentation({ ...lesson, classTitle: '', groupLabel: '', topic: '' }).title, '');
  assert.equal(cabinetPresentation({ ...lesson, groupLabel: '', topic: '' }).description, '');
  assert.deepEqual(lesson, before);
});

test('finite zero/negative/extreme durations cannot crash the read-only display', () => {
  assert.equal(cabinetPresentation({ ...lesson, durationMin: 0 }).endsAt, '2026-10-09T06:00:00.000Z');
  assert.equal(cabinetPresentation({ ...lesson, durationMin: -60 }).endsAt, '2026-10-09T05:00:00.000Z');
  assert.equal(cabinetPresentation({ ...lesson, durationMin: Number.MAX_VALUE }).endsAt, null);
});
