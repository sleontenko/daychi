import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { parseWeek, scheduleFromHTML, schoolInstant } from '../src/features/schedule/source.ts';
import { reminderPlan, reconcileReminders } from '../src/features/schedule/reminder-plan.ts';

const days = ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'];
const html = (clock='08.00-09.00') => days.map(day => `<div data-testid="richTextElement"><h2>${day}</h2><p>${clock} Тайцзи <span>онлайн</span></p><p>\u200b</p></div>`).join('');
test('native source matches server identity, inline text and all seven weekdays', () => {
  const rows = parseWeek(html());
  assert.equal(rows.length,7);
  assert.equal(rows[0].title,'Тайцзи онлайн');
  assert.equal(rows[0].id,createHash('sha256').update('0:Тайцзи онлайн').digest('hex').slice(0,20));
});
test('reject incomplete, ambiguous, invalid or changed source', () => {
  for (const page of ['error',html()+html(),html('25.00-26.00'),html('09.00-08.00'),html().replace('Пятница','Праздник'),html().replace('<p>\u200b</p>','<p>Сегодня отмена</p>')])
    assert.throws(()=>parseWeek(page));
});
test('Israel dates handle DST and device timezone independently', () => {
  assert.equal(schoolInstant('2026-10-23','08:00'),'2026-10-23T05:00:00.000Z');
  assert.equal(schoolInstant('2026-10-25','08:00'),'2026-10-25T06:00:00.000Z');
  const data = scheduleFromHTML(html(),Date.parse('2026-10-23T12:00:00Z'));
  assert.equal(data.occurrences.length,14);
  assert.equal(data.occurrences[2].starts_at,'2026-10-25T06:00:00.000Z');
});
test('time edits keep selection IDs while changing actual reminder dates', () => {
  const now=Date.parse('2026-09-17T00:00:00Z');
  const a=scheduleFromHTML(html(),now),b=scheduleFromHTML(html('10.00-11.00'),now);
  assert.equal(a.occurrences[0].id,b.occurrences[0].id);
  assert.notEqual(a.revision,b.revision);
});
const event={id:'abc:2026-09-17', title:'Тайцзи', starts_at:'2026-09-17T09:00:00Z',ends_at:'2026-09-17T10:00:00Z',status:'scheduled'};
const now=Date.parse('2026-09-17T08:00:00Z');
const prefs={choices:{[event.id]:true},enabled:true,lead:30};
test('one dated reminder, no past/cancelled/unselected reminders; optout empty',()=>{
  assert.equal(reminderPlan([event],prefs,now)[0].at,Date.parse('2026-09-17T08:30:00Z'));
  assert.deepEqual(reminderPlan([event],prefs,now+31*60000),[]);
  assert.deepEqual(reminderPlan([{...event,status:'cancelled'}],prefs,now),[]);
  assert.deepEqual(reminderPlan([event],{...prefs,choices:{}},now),[]);
  assert.deepEqual(reminderPlan([event],{...prefs,enabled:false},now),[]);
});
test('reconcile is idempotent, reschedules moves, cancels deselection and preserves unrelated requests',async()=>{
  const pending=new Map([['other',{id:'other',at:1,title:'other'}]]);let writes=0;
  const port={pending:async()=>[...pending.values()],cancel:async id=>{pending.delete(id);},schedule:async n=>{writes++;pending.set(n.id,{id:n.id,at:n.at,title:n.event.title});}};
  const plan=reminderPlan([event],prefs,now);
  await reconcileReminders(plan,port);await reconcileReminders(plan,port);assert.equal(writes,1);
  await reconcileReminders([{...plan[0],at:plan[0].at+60000}],port);assert.equal(writes,2);
  await reconcileReminders([],port);assert.deepEqual([...pending.keys()],['other']);
});
test('scheduling/cancellation failures surface instead of pretending success',async()=>{
  const plan=reminderPlan([event],prefs,now);
  await assert.rejects(reconcileReminders(plan,{pending:async()=>[],cancel:async()=>{},schedule:async()=>{throw Error('no');}}));
  await assert.rejects(reconcileReminders(plan,{pending:async()=>[],cancel:async()=>{},schedule:async()=>{}}));
  await assert.rejects(reconcileReminders([],{pending:async()=>[{id:plan[0].id,at:1,title:'x'}],cancel:async()=>{throw Error('no');},schedule:async()=>{}}));
});
test('precision permission changes replace an existing reminder once, without duplicating it', async () => {
  const plan = reminderPlan([event], prefs, now);
  const item = plan[0];
  const pending = new Map([[item.id, { id: item.id, at: item.at, title: event.title, stale: true }]]);
  const calls = [];
  const port = {
    pending: async () => [...pending.values()],
    cancel: async id => { calls.push(['cancel', id]); pending.delete(id); },
    schedule: async next => {
      calls.push(['schedule', next.id]);
      pending.set(next.id, { id: next.id, at: next.at, title: next.event.title, stale: false });
    },
  };
  await reconcileReminders(plan, port);
  await reconcileReminders(plan, port);
  assert.deepEqual(calls, [['cancel', item.id], ['schedule', item.id]]);
  assert.equal(pending.size, 1);
});
