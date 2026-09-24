import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseWeekly, cancelWeekly, decodeSubscriptions, isChosen, toggleDate } from '../src/features/schedule/attendance.ts';
import { reminderPlan, reconcileReminders } from '../src/features/schedule/reminder-plan.ts';
import { calendarWallTime, googleCalendarURL, nativeCalendarEvent } from '../src/features/schedule/calendar-model.ts';

const event = (date, hour = '18:00', offset = '+03:00') => ({ id: `series:${date}`, title: 'Практика & отдых',
  starts_at: `${date}T${hour}:00${offset}`, ends_at: `${date}T19:30:00${offset}`, status: 'scheduled' });
const first = event('2026-10-18'), second = event('2026-10-25', '18:00', '+02:00');
const prefs = () => ({ choices: {}, enabled: true, lead: 30 });
test('weekly subscription persists through reload, DST, future windows and time changes', () => {
  const stored = JSON.parse(JSON.stringify(chooseWeekly(prefs(), first)));
  stored.subscriptions = decodeSubscriptions(stored.subscriptions);
  assert.equal(isChosen(event('2026-10-11'), stored), false);
  assert.equal(isChosen(second, stored), true);
  assert.equal(isChosen(event('2027-01-17', '17:00', '+02:00'), stored), true);
  assert.equal(isChosen({ ...second, id: 'different:2026-10-25' }, stored), false);
  assert.equal(reminderPlan([second], stored, 0)[0].at, Date.parse('2026-10-25T15:30:00Z'));
});
test('skip and restore a date, cancel subscription, preserve unrelated one-off choices', () => {
  let selected = chooseWeekly({ ...prefs(), choices: { [first.id]: true, 'other:2026-10-25': true } }, first);
  selected = toggleDate(selected, first);
  assert.equal(isChosen(first, selected), false);
  assert.equal(isChosen(second, selected), true);
  selected = toggleDate(selected, first);
  assert.equal(isChosen(first, selected), true);
  selected = cancelWeekly(selected, 'series');
  assert.equal(isChosen(first, selected), false);
  assert.equal(isChosen(second, selected), false);
  assert.equal(selected.choices['other:2026-10-25'], true);
});
test('old choices remain single-date; malformed subscriptions are rejected', () => {
  const old = { ...prefs(), choices: { [first.id]: true } };
  assert.equal(isChosen(first, old), true);
  assert.equal(isChosen(second, old), false);
  assert.deepEqual(decodeSubscriptions([true]), {});
  assert.deepEqual(decodeSubscriptions({ broken: { from: true }, bad: { title: 'Test', from: 'no', startsAt: 'no' } }), {});
});
test('cancelled dates never notify and cancelling subscription removes pending reminders', async () => {
  const selected = chooseWeekly(prefs(), first);
  assert.equal(reminderPlan([{ ...first, status: 'cancelled' }], selected, 0).length, 0);
  let pending = reminderPlan([first, second], selected, 0).map(x => ({ id: x.id, at: x.at, title: x.event.title }));
  await reconcileReminders(reminderPlan([first, second], cancelWeekly(selected, 'series'), 0), {
    pending: async () => pending, cancel: async id => { pending = pending.filter(x => x.id !== id); },
    schedule: async () => assert.fail('must not schedule'),
  });
  assert.equal(pending.length, 0);
});
test('calendar exports retain Israel wall time across DST, encode text and distinguish recurrence', () => {
  assert.equal(calendarWallTime(first.starts_at), '20261018T180000');
  assert.equal(calendarWallTime(second.starts_at), '20261025T180000');
  const url = new URL(googleCalendarURL(second, true, 'Зал, Тель-Авив'));
  assert.equal(url.searchParams.get('ctz'), 'Asia/Jerusalem');
  assert.equal(url.searchParams.get('dates'), '20261025T180000/20261025T193000');
  assert.equal(url.searchParams.get('text'), second.title);
  assert.equal(url.searchParams.get('recur'), 'RRULE:FREQ=WEEKLY');
  assert.equal(new URL(googleCalendarURL(second, false, '')).searchParams.has('recur'), false);
  const native = nativeCalendarEvent(second, 'Зал');
  assert.equal(native.timeZone, 'Asia/Jerusalem');
  assert.equal(native.startDate.toISOString(), '2026-10-25T16:00:00.000Z');
});
