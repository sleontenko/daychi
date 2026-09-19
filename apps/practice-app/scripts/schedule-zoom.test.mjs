import assert from 'node:assert/strict';
import test from 'node:test';
import { zoomForOccurrence, applyTelegramTimes } from '../src/features/schedule/zoom-model.ts';
const row = {seriesId:'class',weekday:0,start:'08:00',url:'https://zoom.us/j/123456789?pwd=test',password:'test-pass'};
const event = {id:'class:2026-09-21',title:'Lesson',starts_at:'2026-09-21T05:00:00Z',ends_at:'2026-09-21T06:00:00Z',status:'scheduled'};
test('Zoom matches Jerusalem time in summer/winter and retains original URL',()=>{
  assert.equal(zoomForOccurrence(event,[row])?.url,row.url);
  assert.equal(zoomForOccurrence({...event,id:'class:2026-10-26',starts_at:'2026-10-26T06:00:00Z'},[row])?.password,'test-pass');
});
test('no wrong room for moved, cancelled, different or ambiguous class',()=>{
  for (const changed of [{status:'cancelled'},{id:'other:2026-09-21'},{starts_at:'2026-09-21T06:00:00Z'}, {id:'class:2026-09-22',starts_at:'2026-09-22T05:00:00Z'}])
    assert.equal(zoomForOccurrence({...event,...changed},[row]),null);
  assert.equal(zoomForOccurrence(event,[row,row]),null);
});
test('reject unexpected protocols, hosts, credentials and paths',()=>{
  for(const url of ['javascript:alert(1)','https://zoom.us.evil.test/j/123','https://user:pass@zoom.us/j/123','https://zoom.us/profile','http://zoom.us/j/123'])
    assert.equal(zoomForOccurrence(event,[{...row,url}]),null);
});

test('Telegram end correction is idempotent, preserves selection identity and other events',()=>{
  const schedule={occurrences:[event,{...event,id:'unmatched'}]};
  const changed=applyTelegramTimes(schedule,[{...row,end:'09:30'}]);
  assert.equal(changed.occurrences[0].ends_at,'2026-09-21T06:30:00.000Z');
  assert.equal(changed.occurrences[0].id,event.id);
  assert.equal(changed.occurrences[0].starts_at,event.starts_at);
  assert.equal(changed.occurrences[1],schedule.occurrences[1]);
  assert.deepEqual(applyTelegramTimes(changed,[{...row,end:'09:30'}]),changed);
});
