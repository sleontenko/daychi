import test from 'node:test';
import assert from 'node:assert/strict';
import { createWebSessionReader, cabinetEntry, CABINET_LOGOUT, cabinetOrigin, cabinetLogout } from './src/web-session.js';

const json = value => new Response(JSON.stringify(value), { headers: {'Content-Type':'application/json'} });
test('cookie-only reads recheck after refusal and recover without credential storage', async () => {
  const outcomes=[json({id:'one'}),new Response(null,{status:401}),json({id:'one'})];
  const failures=[], seen=[]; let cleared=0;
  const reader=createWebSessionReader({fetch:async(path, options)=>{seen.push(options);return outcomes.shift();},suspend:()=>++cleared,failure:s=>failures.push(s)});
  assert.equal((await reader.read('/api/wiki/materials/one')).id,'one');
  await assert.rejects(reader.read('/api/wiki/materials/one'), e=>e.status===401);
  assert.equal((await reader.read('/api/wiki/materials/one')).id,'one');
  assert.equal(cleared,1);assert.deepEqual(failures,[401]);assert.equal(seen.length,3);
  for(const options of seen){assert.equal(options.credentials,'same-origin');assert.equal(options.cache,'no-store');assert.equal(options.redirect,'error');assert.equal(options.headers,undefined);}
});
test('late parallel success cannot restore an invalidated reader or clear a newer session', async () => {
  let release;const failures=[];let cleared=0;
  const reader=createWebSessionReader({fetch:path=>path.endsWith('slow')?new Promise(r=>release=r):Promise.resolve(new Response(null,{status:403})),suspend:()=>++cleared,failure:s=>failures.push(s)});
  const slow=reader.read('/api/wiki/materials/slow');const old=assert.rejects(slow,e=>e.stale===true);
  await assert.rejects(reader.read('/api/wiki/materials/current'), e=>e.status===403);
  release(json({private:'old'}));await old;
  assert.equal(cleared,1);assert.deepEqual(failures,[403]);
});
test('background invalidation and noncooperative timeout discard pending data', async () => {
  let release;const failures=[];let cleared=0;
  const reader=createWebSessionReader({fetch:()=>new Promise(r=>release=r),suspend:()=>++cleared,failure:s=>failures.push(s),timeoutMs:20});
  const pending=reader.read('/api/wiki/graph');const stale=assert.rejects(pending,e=>e.stale===true);
  reader.invalidate();release(json({private:'old'}));await stale;
  await assert.rejects(reader.read('/api/wiki/graph'),e=>e.status===503);
  assert.equal(cleared,2);assert.deepEqual(failures,[503]);
});
test('missing article preserves v1 fallback while HTML/profile session witnesses fail closed', async () => {
  let next=new Response(null,{status:404});let cleared=0;
  const reader=createWebSessionReader({fetch:async()=>next,suspend:()=>++cleared,failure:()=>{}});
  await assert.rejects(reader.read('/api/wiki/articles/materials/one'),e=>e.message==='404');assert.equal(cleared,0);
  next=json({account:{status:'active'}});
  await assert.rejects(reader.read('/api/wiki/session'),e=>e.status===503);assert.equal(cleared,1);
  next=new Response(null,{status:204});assert.equal(await reader.read('/api/wiki/session'),null);
  next=new Response('<html>login</html>',{headers:{'Content-Type':'text/html'}});
  await assert.rejects(reader.read('/api/wiki/graph'),e=>e.status===503);
});
test('Cabinet entry retains exact relative route and logout navigates to Cabinet',()=>{
  const location={pathname:'/wiki',search:'?a=1',hash:'#view=article&id=one'};
  const entry=new URL(cabinetEntry(location));assert.equal(entry.origin,'https://xuanxue.su');assert.equal(entry.pathname,'/wiki');
  assert.equal(entry.searchParams.get('returnTo'),'/wiki?a=1#view=article&id=one');
  assert.equal(CABINET_LOGOUT,'https://xuanxue.su/logout');
  for(const pathname of ['//evil.test/','/\\evil.test','/'+ 'я'.repeat(600)])assert.throws(()=>cabinetEntry({pathname,search:'',hash:''}));
});

test('fixed staging entry and logout never switch environments from browser paths',()=>{
  const location={pathname:'/wiki',search:'?environment=production',hash:'#view=article&id=one'};
  const entry=new URL(cabinetEntry(location,'staging'));
  assert.equal(entry.origin,'https://staging.xuanxue.su');
  assert.equal(entry.searchParams.get('returnTo'),'/wiki?environment=production#view=article&id=one');
  assert.equal(cabinetLogout('staging'),'https://staging.xuanxue.su/logout');
  assert.equal(cabinetOrigin('production'),'https://xuanxue.su');
  for(const profile of ['https://evil.test',undefined,'toString','__proto__']) {
    if(profile !== undefined) assert.throws(()=>cabinetEntry(location,profile));
  }
});
