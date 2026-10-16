import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const root=fileURLToPath(new URL('../src/features/cabinet-account/',import.meta.url));
const cache=new Map();
function module(file) {
 const name=path.resolve(root,file.endsWith('.ts')?file:file+'.ts');
 if(cache.has(name))return cache.get(name);
 const exports={};cache.set(name,exports);
 const code=ts.transpileModule(readFileSync(name,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,require:id=>module(path.resolve(path.dirname(name),id)),
  URLSearchParams,URL,AbortController,setTimeout,clearTimeout,fetch,Date,console}, {filename:name});
 return exports;
}
const P=module('protocol'),{createAccountClient}=module('client'),{createAccountSession}=module('session-core');
const ORIGIN='https://staging.xuanxue.su', KEY='daychi.cabinet.account.v1.staging', TOKEN='a'.repeat(43), NEW='b'.repeat(43), GRANT='grant_account_123456';
const clone=v=>JSON.parse(JSON.stringify(v));
const profile=(extra={})=>({id:'school_123',name:'Тестовый ученик',roles:[],status:'active',telegramLinked:true,botChatActive:false,hasEmail:false,
 googleLinked:false,noTelegram:false,needsProfile:false,studentMode:false,canUseStudentMode:false,homeHiddenTiles:[],...extra});
const token=(access_token=TOKEN)=>({access_token,token_type:'Bearer',expires_in:7776000,scope:'account:read',session_id:GRANT,renew_after:604801});
const me=(extra={},renew=604801)=>({account:profile(extra),session:{id:GRANT,expires_in:7776000,renew_after:renew}});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function harness({map=new Map(),client={},storage={}}={}) {
 let stamp=1000000,nonce=0;
 const seen=[];
 const provider={exchange:async()=>token(),me:async()=>me(),renew:async()=>token(NEW),revoke:async()=>{},...client};
 const api=Object.fromEntries(Object.keys(provider).map(k=>[k,async(...args)=>{seen.push({operation:k,args});return provider[k](...args);} ]));
 const store={get:async key=>map.get(key)??null,set:async(key,value)=>{map.set(key,value);},delete:async key=>{map.delete(key);},...storage};
 const session=createAccountSession({origin:ORIGIN,storage:store,client:api,now:()=>stamp,
  random:async()=>String(++nonce%10).repeat(43),challenge:async v=>createHash('sha256').update(v).digest('base64url')});
 return {session,map,seen,provider,advance:value=>{stamp+=value;},time:value=>{stamp=value;},stamp:()=>stamp};
}
const returnURL=(attempt,changes={})=>P.CALLBACK+'?'+new URLSearchParams({code:'c'.repeat(43),state:attempt.state,iss:ORIGIN,...changes});
async function login(h){const a=await h.session.begin();assert.ok(a);assert.equal(await h.session.receive(returnURL(a)),true);assert.equal(h.session.getState().status,'active');return a;}

// Common case IDs are shared with Cabinet. These prove only client behavior.
test('N01 acquisition securely persists a separate grant; restart reads current full profile',async()=>{
 const h=harness();h.map.set('daychee.access.session.v1','legacy');h.map.set('ordinary.schedule','selected');
 await login(h);const saved=JSON.parse(h.map.get(KEY));assert.equal(saved.session.token,TOKEN);assert.equal(saved.pending,null);
 assert.equal(h.map.get('daychee.access.session.v1'),'legacy');assert.equal(h.map.get('ordinary.schedule'),'selected');
 const next=harness({map:h.map,client:{me:async()=>me({hasEmail:true,email:'test@example.test',pendingEmail:'new@example.test',homeHiddenTiles:['notice'],roles:['teacher'],canUseStudentMode:true})}});
 await next.session.restore();assert.equal(next.session.getState().account.email,'test@example.test');assert.deepEqual(clone(next.session.getState().account.homeHiddenTiles),['notice']);
 assert.equal('token' in next.session.getState(),false);
});
test('N01 profile requires exact types and normalized hidden tiles; ignores extra fields',()=>{
 for(const tiles of [[],['notice'],['payment','events']])assert.deepEqual(clone(P.accountDTO(profile({homeHiddenTiles:tiles})).homeHiddenTiles),tiles);
 for(const patch of [{homeHiddenTiles:null},{homeHiddenTiles:['gone']},{homeHiddenTiles:['events','payment']},{homeHiddenTiles:['notice','notice']},{hasEmail:true},{email:null},{roles:['root']},{studentMode:true,roles:['teacher']},{status:'blocked'}])assert.throws(()=>P.accountDTO(profile(patch)));
 const raw=profile();delete raw.homeHiddenTiles;assert.throws(()=>P.accountDTO(raw));
 assert.equal(P.accountDTO(profile({phone:'ignored'})).phone,undefined);
});
test('N02 authorize entry includes S256, exact registered callback and no secret',async()=>{
 const h=harness(),a=await h.session.begin(),u=new URL(a.url),p=JSON.parse(h.map.get(KEY)).pending;
 assert.equal(u.pathname,'/auth/native/authorize');assert.equal(u.searchParams.get('redirect_uri'),P.CALLBACK);
 assert.equal(u.searchParams.get('code_challenge_method'),'S256');assert.equal(u.searchParams.get('code_challenge'),createHash('sha256').update(p.verifier).digest('base64url'));
 assert.equal(u.searchParams.get('client_id'),'daychi-native');assert.equal(u.searchParams.get('scope'),'account:read');
 assert.equal(u.searchParams.has('code_verifier'),false);
});
test('N03/N04 callback rejects mismatch, replay shape, normalization, duplicate decoded names and malformed encodings',async()=>{
 const h=harness(),a=await h.session.begin();const good=returnURL(a);
 const bad=[good.replace(':/','://'),good.replace('/oauth/','/%6fauth/'),good+'#fragment',good+'&code=x',good+'&%73tate=x',good+'&x=y',good+'&error=access_denied',good.replace('state=','state=%ZZ'),returnURL(a,{state:'x'.repeat(43)}),returnURL(a,{iss:'https://xuanxue.su'}),returnURL(a,{code:''}),good.replace('su.xuanxue','SU.XUANXUE')];
 for(const url of bad)assert.equal(await h.session.receive(url),false);
 assert.equal(h.seen.length,0);assert.equal(h.session.getState().signIn,'browser');
 assert.equal(await h.session.receive(good),true);
});
test('N04 pending attempt expires at 900 seconds and on backwards local clock',async()=>{
 for(const delta of [900000,-1]){const h=harness(),a=await h.session.begin();h.advance(delta);assert.equal(await h.session.receive(returnURL(a)),false);assert.equal(h.seen.length,0);await h.session.restore();assert.equal(JSON.parse(h.map.get(KEY)).pending,null);}
});
test('N05 browser cancellation preserves an existing session and rejects its late callback',async()=>{
 const h=harness();await login(h);const a=await h.session.begin();await h.session.cancel(a.state);assert.equal(await h.session.receive(returnURL(a)),false);assert.equal(JSON.parse(h.map.get(KEY)).session.token,TOKEN);
});
test('N05 new attempt supersedes old callback and old browser cancellation',async()=>{
 const h=harness(),a=await h.session.begin(),b=await h.session.begin();await h.session.cancel(a.state);
 assert.equal(await h.session.receive(returnURL(a)),false);assert.equal(await h.session.receive(returnURL(b)),true);
});
test('N05/N10 cancelling an in-flight exchange prevents session resurrection',async()=>{
 const gate=deferred(),entered=deferred(),h=harness({client:{exchange:async()=>{entered.resolve();return gate.promise;}}});
 const a=await h.session.begin(),receiving=h.session.receive(returnURL(a));await entered.promise;await h.session.cancel(a.state);gate.resolve(token());await receiving;
 assert.equal(JSON.parse(h.map.get(KEY)).session,null);assert.equal(h.session.getState().hasSession,false);
});
test('N06/N10 simultaneous callbacks dispatch exactly one exchange and no replay',async()=>{
 const gate=deferred(),h=harness({client:{exchange:()=>gate.promise}}),a=await h.session.begin();
 const first=h.session.receive(returnURL(a)),second=h.session.receive(returnURL(a));
 await second;gate.resolve(token());await first;await h.session.receive(returnURL(a));
 assert.equal(h.seen.filter(x=>x.operation==='exchange').length,1);
});
test('N07 invalid_grant preserves predecessor and requires a fresh attempt',async()=>{
 const h=harness();await login(h);h.provider.exchange=async()=>{throw new P.CabinetError('invalid_grant');};
 const a=await h.session.begin();await h.session.receive(returnURL(a));await h.session.receive(returnURL(a));
 assert.equal(JSON.parse(h.map.get(KEY)).session.token,TOKEN);assert.equal(h.session.getState().error,'invalid_grant');
 assert.equal(h.seen.filter(x=>x.operation==='exchange').length,2);
});
test('N08 renew only on authoritative renew_after=0 and retain the stable grant',async()=>{
 const h=harness();await login(h);h.provider.me=async()=>me({},1);await h.session.restore();assert.equal(h.seen.some(x=>x.operation==='renew'),false);
 h.provider.me=async()=>me({},0);await h.session.restore();assert.equal(JSON.parse(h.map.get(KEY)).session.token,NEW);assert.equal(JSON.parse(h.map.get(KEY)).session.grant,GRANT);
});
test('N09 lost renewal and failed secure write preserve the usable predecessor',async()=>{
 for(const failure of ['network','storage']){
  const h=harness();await login(h);h.provider.me=async()=>me({},0);
  if(failure==='network')h.provider.renew=async()=>{throw new P.CabinetError('network');};
  else {const old=h.map.set.bind(h.map);h.map.set=(key,value)=>{if(value.includes(NEW))throw Error('IO');return old(key,value);};}
  await h.session.restore();assert.equal(JSON.parse(h.map.get(KEY)).session.token,TOKEN);assert.equal(h.session.getState().hasSession,true);
 }
});
test('N10 crash after exchange dispatch keeps single-use marker and cannot replay on restart',async()=>{
 const entered=deferred(),gate=deferred(),h=harness({client:{exchange:()=>{entered.resolve();return gate.promise;}}});
 const a=await h.session.begin(),pending=h.session.receive(returnURL(a));await entered.promise;
 assert.equal(JSON.parse(h.map.get(KEY)).pending.phase,'exchange');const next=harness({map:new Map(h.map)});await next.session.restore();
 assert.equal(next.session.getState().error,'interrupted');assert.equal(await next.session.receive(returnURL(a)),false);assert.equal(next.seen.length,0);
 gate.resolve(token());await pending;
});
test('N10 lost exchange response and failed install do not replay or replace predecessor',async()=>{
 for(const failure of ['network','storage']){
  const h=harness();await login(h);
  if(failure==='network')h.provider.exchange=async()=>{throw new P.CabinetError('network');};
  else {h.provider.exchange=async()=>token(NEW);const old=h.map.set.bind(h.map);h.map.set=(key,value)=>{if(value.includes(NEW))throw Error('write');return old(key,value);};}
  const a=await h.session.begin();await h.session.receive(returnURL(a));await h.session.receive(returnURL(a));assert.equal(JSON.parse(h.map.get(KEY)).session.token,TOKEN);
  assert.equal(h.seen.filter(x=>x.operation==='exchange').length,2);
 }
});
test('N11/N17 logout deletes only this issuer record and revokes its current grant',async()=>{
 const h=harness();await login(h);h.map.set('daychee.access.session.v1','legacy');h.map.set('daychi.cabinet.account.v1.production','other');h.map.set('schedule','chosen');
 await h.session.logout();assert.equal(h.map.has(KEY),false);assert.equal(h.map.get('daychee.access.session.v1'),'legacy');assert.equal(h.map.get('schedule'),'chosen');assert.equal(h.map.get('daychi.cabinet.account.v1.production'),'other');
 assert.equal(h.seen.at(-1).operation,'revoke');assert.equal(h.seen.at(-1).args[0],TOKEN);
});
test('N12/N15 late renewal/read cannot resurrect a logged-out grant',async()=>{
 for(const operation of ['me','renew']){
  const h=harness();await login(h);h.provider.me=async()=>me({},0);const entered=deferred(),gate=deferred();
  h.provider[operation]=()=>{entered.resolve();return gate.promise;};const checking=h.session.restore();await entered.promise;
  await h.session.logout();gate.resolve(operation==='me'?me():token(NEW));await checking;assert.equal(h.map.has(KEY),false);assert.equal(h.session.getState().status,'signed-out');
 }
});
test('N13 blocked credential is retained and recovers; invalid clears only matching Cabinet session',async()=>{
 const h=harness();await login(h);h.provider.me=async()=>{throw new P.CabinetError('account_blocked');};await h.session.restore();assert.equal(h.session.getState().status,'blocked');assert.equal(JSON.parse(h.map.get(KEY)).session.token,TOKEN);
 h.provider.me=async()=>me();await h.session.restore();assert.equal(h.session.getState().status,'active');h.provider.me=async()=>{throw new P.CabinetError('invalid_token');};await h.session.restore();assert.equal(JSON.parse(h.map.get(KEY)).session,null);
});
test('N13 stale invalid response cannot clear a newer successful sign-in',async()=>{
 const h=harness();await login(h);const gate=deferred(),entered=deferred();h.provider.me=()=>{entered.resolve();return gate.promise;};
 const checking=h.session.restore();await entered.promise;h.provider.me=async()=>me();h.provider.exchange=async()=>token(NEW);await login(h);
 gate.resolve(Promise.reject(new P.CabinetError('invalid_token')));await checking;assert.equal(JSON.parse(h.map.get(KEY)).session.token,NEW);
});
test('N14 temporary failures and malformed success preserve stored credential',async()=>{
 const h=harness();await login(h);
 for(const failure of ['network','temporarily_unavailable','server_error','invalid-response']){h.provider.me=async()=>{throw new P.CabinetError(failure);};await h.session.restore();assert.equal(h.session.getState().status,'unavailable');assert.equal(JSON.parse(h.map.get(KEY)).session.token,TOKEN);}
 h.provider.me=async()=>me();await h.session.restore();assert.equal(h.session.getState().status,'active');
});
test('N14 Retry-After prevents explicit/foreground retry until elapsed',async()=>{
 const h=harness();await login(h);h.provider.me=async()=>{throw new P.CabinetError('rate_limited',10);};await h.session.restore();const count=h.seen.length;
 await h.session.restore();await h.session.begin();assert.equal(h.seen.length,count);h.advance(10000);h.provider.me=async()=>me();await h.session.restore();assert.equal(h.session.getState().status,'active');
});
test('N15 offline logout completes without awaiting revoke and restart stays signed out',async()=>{
 const gate=deferred(),h=harness({client:{revoke:()=>gate.promise}});await login(h);await h.session.logout();assert.equal(h.map.has(KEY),false);
 const next=harness({map:h.map});await next.session.restore();assert.equal(next.session.getState().status,'signed-out');gate.resolve();
});
test('N15 secure deletion failure is explicitly incomplete and disables restoration until retry',async()=>{
 let fail=false;const h=harness({storage:{delete:async key=>{if(fail)throw Error('IO');h.map.delete(key);}}});await login(h);fail=true;
 await h.session.logout();assert.equal(h.session.getState().status,'signout-incomplete');assert.equal(h.session.getState().account,null);await h.session.restore();assert.equal(h.session.getState().status,'signout-incomplete');
 fail=false;await h.session.logout();assert.equal(h.map.has(KEY),false);assert.equal(h.session.getState().status,'signed-out');
});
test('N15 logout queued behind a native credential write durably removes it',async()=>{
 const entered=deferred(),gate=deferred();let block=false;
 const h=harness({storage:{set:async(key,value)=>{if(block && JSON.parse(value).session){entered.resolve();await gate.promise;}h.map.set(key,value);}}});
 const a=await h.session.begin();block=true;const receiving=h.session.receive(returnURL(a));await entered.promise;const leaving=h.session.logout();gate.resolve();await Promise.all([receiving,leaving]);assert.equal(h.map.has(KEY),false);assert.equal(h.session.getState().status,'signed-out');
});
test('N16 cold callback restores the pending secure attempt for the same issuer',async()=>{
 const h=harness(),a=await h.session.begin(),next=harness({map:h.map});assert.equal(await next.session.receive(returnURL(a)),true);assert.equal(next.session.getState().status,'active');
 const wrong=new Map([[KEY,JSON.stringify({...JSON.parse(h.map.get(KEY)),issuer:'https://xuanxue.su'})]]);const other=harness({map:wrong});await other.session.restore();assert.equal(other.session.getState().error,'storage');assert.equal(other.seen.length,0);
});
test('secure read and pending-write failures are explicit and prevent browser/network dispatch',async()=>{
 for(const operation of ['get','set']){
  const h=harness({storage:{[operation]:async()=>{throw Error('secure IO');}}});assert.equal(await h.session.begin(),null);assert.equal(h.session.getState().error,'storage');assert.equal(h.seen.length,0);
 }
});
test('provider cancellation consumes only the matching attempt and preserves account',async()=>{
 const h=harness();await login(h);const a=await h.session.begin();const u=P.CALLBACK+'?'+new URLSearchParams({error:'access_denied',state:a.state,iss:ORIGIN});assert.equal(await h.session.receive(u),true);assert.equal(JSON.parse(h.map.get(KEY)).pending,null);assert.equal(JSON.parse(h.map.get(KEY)).session.token,TOKEN);
});
const response=(body,status=200,extra={})=>new Response(typeof body==='string'?body:JSON.stringify(body),{status,headers:{'Content-Type':'application/json',...extra}});
test('transport uses exact native paths/media/credentials, no cookies or redirect following',async()=>{
 const seen=[],api=createAccountClient(ORIGIN,async(url,options)=>{seen.push({url,options});return response(url.endsWith('/me')?me():url.endsWith('/revoke')?'':token());});
 await api.exchange('c'.repeat(43),'v'.repeat(43));await api.me(TOKEN,GRANT);await api.renew(TOKEN,GRANT);await api.revoke(TOKEN);
 assert.deepEqual(seen.map(x=>x.url),['token','me','renew','revoke'].map(x=>ORIGIN+'/api/auth/native/'+x));
 for(const {options} of seen){assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');}
 assert.equal(seen[0].options.headers.Authorization,undefined);assert.equal(seen[3].options.headers.Authorization,undefined);assert.equal(seen[2].options.body,'{}');
 assert.equal(new URLSearchParams(seen[0].options.body).get('redirect_uri'),P.CALLBACK);
});
test('transport malformed 401 is not invalid_token; malformed success never becomes a session',async()=>{
 for(const r of [response({error:'invalid_token',extra:true},401),response({},401),response({account:profile(),session:{id:'other',expires_in:90,renew_after:0}}),new Response('<html>',{status:200})]){
  const api=createAccountClient(ORIGIN,async()=>r);await assert.rejects(()=>api.me(TOKEN,GRANT),e=>e.kind==='invalid-response');
 }
});
test('transport validates 429 delay and bounded timeout; failures never echo secrets',async()=>{
 const api=createAccountClient(ORIGIN,async()=>response({error:'rate_limited'},429,{'Retry-After':'12'}));await assert.rejects(()=>api.me(TOKEN,GRANT),e=>e.kind==='rate_limited'&&e.retrySeconds===12);
 const bad=createAccountClient(ORIGIN,async()=>response({error:'rate_limited'},429,{'Retry-After':'tomorrow'}));await assert.rejects(()=>bad.me(TOKEN,GRANT),e=>e.kind==='invalid-response');
 const timed=createAccountClient(ORIGIN,async(_u,o)=>new Promise((_resolve,reject)=>o.signal.addEventListener('abort',()=>reject(Error(TOKEN)),{once:true})),2);await assert.rejects(()=>timed.me(TOKEN,GRANT),e=>e.kind==='network'&&!e.message.includes(TOKEN));
});

test('foreground can recheck immediately while a superseded background read is still pending',async()=>{
 const h=harness();await login(h);const gate=deferred(),entered=deferred();h.provider.me=()=>{entered.resolve();return gate.promise;};
 const stale=h.session.restore();await entered.promise;h.session.suspend();h.provider.me=async()=>me({name:'Актуальное имя'});await h.session.restore();assert.equal(h.session.getState().status,'active');
 gate.resolve(me({name:'Старое имя'}));await stale;assert.equal(h.session.getState().account.name,'Актуальное имя');
});
test('N16 release gate strips Cabinet callbacks and preserves legacy invitations on both platforms',async()=>{
 const app=JSON.parse(readFileSync(new URL('../app.json',import.meta.url),'utf8'));assert.deepEqual(app.expo.scheme,['quietpractice','su.xuanxue.daychi']);
 assert.equal(app.expo.ios.bundleIdentifier,'ai.mypraxis.quietpractice');assert.equal(app.expo.android.package,'ai.mypraxis.quietpractice');
 const source=readFileSync(path.join(root,'session.ts'),'utf8'),code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 for(const os of ['ios','android']){
  const exports={};vm.runInNewContext(code,{exports,__DEV__:false,process:{env:{EXPO_PUBLIC_CABINET_ACCOUNT_PILOT:'1'}},require:name=>({
   react:{useSyncExternalStore(){}},'react-native':{Platform:{OS:os}},'expo-secure-store':{WHEN_UNLOCKED_THIS_DEVICE_ONLY:1},'expo-crypto':{},'expo-web-browser':{},'./client':{},'./session-core':{},'./protocol':P
  }[name])});
  assert.equal(exports.cabinetAccountEnabled,false);assert.equal(await exports.redirectCabinetCallback(P.CALLBACK+'?code=private'),'/');assert.equal(await exports.redirectCabinetCallback('quietpractice://invite#legacy'),null);
 }
});

test('Back/cancel during secure preparation cannot open a late browser attempt',async()=>{
 const gate=deferred(),h=harness({storage:{get:()=>gate.promise}});const beginning=h.session.begin();assert.equal(h.session.getState().signIn,'browser');const cancel=h.session.cancel();assert.equal(h.session.getState().signIn,'idle');gate.resolve(null);await cancel;assert.equal(await beginning,null);assert.equal(JSON.parse(h.map.get(KEY)).pending,null);
});
