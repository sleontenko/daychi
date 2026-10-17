import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const root = fileURLToPath(new URL('../src/features/', import.meta.url));
function loader(stubs = {}, env = {}) {
  const cache = new Map();
  function load(file) {
    const name = path.resolve(root, file.endsWith('.ts') ? file : file + '.ts');
    if (cache.has(name)) return cache.get(name);
    const exports = {}; cache.set(name, exports);
    const code = ts.transpileModule(readFileSync(name, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, { exports, require: id => Object.hasOwn(stubs, id) ? stubs[id] : load(path.resolve(path.dirname(name), id)),
      URL, URLSearchParams, AbortController, setTimeout, clearTimeout, fetch, Date, console, process: { env } }, { filename: name });
    return exports;
  }
  return load;
}
const load = loader(), P = load('cabinet-account/protocol');
const { createAccountSession } = load('cabinet-account/session-core');
const { createCabinetContentClient } = load('wiki/cabinet-content-client');
const TOKEN = 'a'.repeat(43), NEW = 'b'.repeat(43), KEY = 'daychi.cabinet.account.v1.staging';
const defer = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function harness() {
  let stamp = 1000000, renewal = false;
  const map = new Map([[KEY, JSON.stringify({ version: 1, issuer: 'https://staging.xuanxue.su',
    session: { token: TOKEN, grant: 'synthetic-grant-1234', savedAt: stamp, expiresAt: stamp + 7776000000, renewAt: stamp + 604801000 }, pending: null })],
    ['daychee.access.session.v1', 'legacy-secret'], ['schedule-cache', 'selected-reminders']]);
  const session = createAccountSession({ origin: 'https://staging.xuanxue.su', now: () => stamp,
    storage: { get: async k => map.get(k) ?? null, set: async (k,v) => { map.set(k,v); }, delete: async k => { map.delete(k); } },
    client: { me: async () => ({ account: {}, session: { renew_after: renewal ? 0 : 604801 } }),
      renew: async () => ({ access_token: NEW, session_id: 'synthetic-grant-1234', expires_in: 7776000, renew_after: 604801 }),
      revoke: async () => {} }, random: async () => TOKEN, challenge: async () => TOKEN });
  return { session, map, advance: n => { stamp += n; }, renew: () => { renewal = true; } };
}

test('C01 C13 C16 explicit fixed native transport forwards exactly one bearer and no cookie', async () => {
  const requests = [];
  const read = createCabinetContentClient('https://backend.test', async (url, options) => {
    requests.push({url, options}); return new Response(JSON.stringify({links:[{url:'https://youtu.be/abcdefghijk'}]}), { headers: {'Content-Type':'application/json'} });
  });
  for (let i=0;i<2;i++) assert.ok((await read('/materials/synthetic?issuer=ignored', TOKEN)).links);
  assert.equal(requests.length, 2);
  for (const {url,options} of requests) {
    assert.equal(url, 'https://backend.test/api/native/wiki/materials/synthetic?issuer=ignored');
    assert.equal(options.headers.Authorization, 'Bearer '+TOKEN);
    assert.equal(options.credentials, 'omit'); assert.equal(options.redirect, 'error'); assert.equal(options.cache, 'no-store');
    assert.equal(Object.keys(options.headers).length, 2);
  }
});
test('C13 caller paths and canonical wiki cannot select another authority', async () => {
  for (const endpoint of ['http://backend.test', 'https://user@backend.test', 'https://wiki.staging.xuanxue.su', 'https://wiki.staging.xuanxue.su.', 'https://backend.test/path']) {
    assert.throws(() => createCabinetContentClient(endpoint), e => e.kind === 'configuration');
  }
  let calls=0;
  const read=createCabinetContentClient('https://backend.test',async()=>{calls++;throw Error();});
  for (const route of ['//evil.test', '/../access/zoom', '/%2e%2e/access/zoom', '/materials/x#private', '/\\evil']) {
    await assert.rejects(read(route,TOKEN),e=>e.kind==='configuration');
  }
  assert.equal(calls,0);
});
test('C07 whole client read is bounded when fetch or body ignores AbortSignal', async () => {
  for (const body of [false,true]) {
    let calls=0;
    const read=createCabinetContentClient('https://backend.test',async()=>{
      calls++;
      if (!body) return new Promise(()=>{});
      return {status:200,url:'',headers:new Headers({'content-type':'application/json'}),json:()=>new Promise(()=>{})};
    },10);
    await assert.rejects(read('/categories',TOKEN),e=>e.kind==='temporarily_unavailable');
    assert.equal(calls,1);
  }
});
test('C03 C04 C06 failure never relays provider body; quota delay has safe fallback', async () => {
  for (const [status, delay, kind, retry] of [[401,null,'invalid_token',undefined],[403,null,'account_blocked',undefined],
      [503,'7','rate_limited',7],[503,'bad','rate_limited',60],[503,null,'temporarily_unavailable',undefined]]) {
    let bodyReads=0;
    const read=createCabinetContentClient('https://backend.test',async()=>({status,url:'',
      headers:new Headers(delay===null?{}:{'Retry-After':delay}),json:async()=>{bodyReads++;return {private:TOKEN};}}));
    await assert.rejects(read('/categories',TOKEN),e=>e.kind===kind && e.retrySeconds===retry && !e.message.includes(TOKEN));
    assert.equal(bodyReads,0);
  }
});
test('C04 C06 C07 session preserves Cabinet and nonempty legacy state on block/temporary refusal and observes retry delay', async () => {
  const h=harness();await h.session.restore();
  let calls=0;
  await assert.rejects(h.session.readContent(async()=>{calls++;throw new P.CabinetError('rate_limited',7);}));
  await assert.rejects(h.session.readContent(async()=>{calls++;}),e=>e.kind==='rate_limited');
  assert.equal(calls,1);h.advance(7000);
  assert.equal(await h.session.readContent(async token=>{calls++;assert.equal(token,TOKEN);return 'recovered';}),'recovered');
  await assert.rejects(h.session.readContent(async()=>{throw new P.CabinetError('account_blocked');}));
  assert.equal(h.session.getState().hasSession,true);
  assert.equal(JSON.parse(h.map.get(KEY)).session.token,TOKEN);
  assert.equal(h.map.get('daychee.access.session.v1'),'legacy-secret');
  assert.equal(h.map.get('schedule-cache'),'selected-reminders');
});
for (const kind of ['invalid_token','temporarily_unavailable']) test('C14 late '+kind+' cannot clear replacement or legacy credential',async()=>{
  const h=harness();await h.session.restore();const pending=defer();
  const read=h.session.readContent(async()=>{await pending.promise;throw new P.CabinetError(kind);});
  await new Promise(r=>setTimeout(r,0));h.renew();await h.session.restore();
  assert.equal(JSON.parse(h.map.get(KEY)).session.token,NEW);
  pending.resolve();await assert.rejects(read);
  assert.equal(h.session.getState().status,'active');
  assert.equal(JSON.parse(h.map.get(KEY)).session.token,NEW);
  assert.equal(h.map.get('daychee.access.session.v1'),'legacy-secret');
});
test('C14 current 401 clears only matching Cabinet credential and sign-out rejects in-flight success',async()=>{
  const h=harness();await h.session.restore();
  await assert.rejects(h.session.readContent(async()=>{throw new P.CabinetError('invalid_token');}));
  assert.equal(JSON.parse(h.map.get(KEY)).session,null);
  assert.equal(h.map.get('daychee.access.session.v1'),'legacy-secret');
  const k=harness();await k.session.restore();const pending=defer();
  const result=k.session.readContent(async()=>{await pending.promise;return 'protected';});
  await new Promise(r=>setTimeout(r,0));await k.session.logout();pending.resolve();
  await assert.rejects(result,e=>e.kind==='interrupted');
  assert.equal(k.map.has(KEY),false);
  assert.equal(k.map.get('daychee.access.session.v1'),'legacy-secret');
});
test('C15 explicit Cabinet adapter has no public or legacy fallback; disabled candidate makes no request',async()=>{
  for (const enabled of [true,false]) {
    let native=0,publicOrLegacy=0;
    const api=loader({
      '../access/session':{privateRequest:async()=>{publicOrLegacy++;throw Error('Forbidden fallback');}},
      './api':{wikiRequest:async()=>{publicOrLegacy++;throw Error('Forbidden fallback');}},
      '../cabinet-account/session':{cabinetAccountEnabled:true,cabinetSession:()=>({readContent:async cb=>cb(TOKEN)})},
      './cabinet-content-client':{createCabinetContentClient:()=>async()=>{native++;throw new P.CabinetError('temporarily_unavailable');}},
    },{EXPO_PUBLIC_DAYCHEE_API_URL:'https://backend.test',EXPO_PUBLIC_CABINET_CONTENT_ENABLED:enabled?'1':'0'})('wiki/cabinet-api');
    await assert.rejects(api.cabinetWikiRequest('/categories'),e=>enabled?e.kind==='temporarily_unavailable':e.kind==='configuration');
    assert.equal(publicOrLegacy,0);assert.equal(native,enabled?1:0);
  }
});
