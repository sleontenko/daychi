import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
const source=readFileSync(new URL('../src/features/access/request-client.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function client({storage=new Map(),fetch,accept=async()=>{},write=async(key,value)=>storage.set(key,value)}={}){
 const exports={};
 vm.runInNewContext(code,{exports,require:name=>({
  'expo-crypto':{getRandomBytesAsync:async()=>randomBytes(32)},
  'expo-secure-store':{getItemAsync:async key=>storage.get(key),setItemAsync:write,WHEN_UNLOCKED_THIS_DEVICE_ONLY:1},
  react:{useSyncExternalStore:(_subscribe,snapshot)=>snapshot()},'react-native':{Platform:{OS:'ios'}},
  './session':{acceptApprovedSession:accept},
 }[name]),process:{env:{EXPO_PUBLIC_DAYCHEE_API_URL:'https://example.test'}},fetch,AbortController,setTimeout,clearTimeout,console,TypeError});
 return {api:exports,storage,state:()=>exports.useAccessRequest()};
}
const response=status=>({ok:true,json:async()=>({status})});
async function fill(c){await c.api.loadAccessRequest();c.api.changeApplicant('first_name','Ирина');c.api.changeApplicant('last_name','Примерова');}
test('persist credentials before sending, retry after restart without duplicate',async()=>{
 const storage=new Map(),calls=[];let fail=true;
 const fetch=async(url,options)=>{assert.ok([...storage.values()][0].includes('secret'));calls.push(options);if(fail){fail=false;throw new TypeError('network');}return response('pending');};
 let c=client({storage,fetch});await fill(c);await c.api.submitAccessRequest();assert.match(c.state().error,/Нет ответа/);
 c.api.changeApplicant('first_name','Different');assert.equal(c.state().record.profile.first_name,'Ирина');
 c=client({storage,fetch});await c.api.loadAccessRequest();await c.api.submitAccessRequest();
 assert.equal(c.state().record.status,'pending');assert.equal(calls[0].headers.Authorization,calls[1].headers.Authorization);assert.equal(calls[0].body,calls[1].body);
});
test('do not submit if local storage failed',async()=>{
 let calls=0;const c=client({fetch:async()=>{calls++;return response('pending');},write:async()=>{throw Error('disk');}});
 await fill(c);await c.api.submitAccessRequest();assert.equal(calls,0);assert.match(c.state().error,/Не удалось сохранить заявку/);
});
test('claim response loss and restart preserve the same session token',async()=>{
 const storage=new Map(),claims=[],accepted=[];let server='pending',lost=true;
 const fetch=async(url,options)=>{if(url.endsWith('/claim')){claims.push(JSON.parse(options.body).session_token);server='active';if(lost){lost=false;throw new TypeError('lost response');}return response('active');}return response(server);};
 let c=client({storage,fetch,accept:async value=>accepted.push(value)});await fill(c);await c.api.submitAccessRequest();server='approved';await c.api.checkAccessRequest();assert.equal(accepted.length,0);
 c=client({storage,fetch,accept:async value=>accepted.push(value)});await c.api.loadAccessRequest();await c.api.checkAccessRequest();assert.equal(c.state().record.status,'active');assert.equal(claims[0],claims[1]);assert.equal(accepted[0],claims[0]);
 await c.api.checkAccessRequest();assert.equal(accepted.length,1,'must not overwrite another login with the old session');
 server='revoked';await c.api.checkAccessRequest();assert.equal(c.state().record.status,'revoked');await c.api.newAccessRequest();assert.equal(c.state().record.status,'draft');assert.equal(c.state().record.profile.first_name,'Ирина');
});
test('reject empty fields and ignore concurrent submit clicks',async()=>{
 let calls=0;const c=client({fetch:async()=>{calls++;return response('pending');}});await c.api.loadAccessRequest();await c.api.submitAccessRequest();assert.equal(calls,0);
 await fill(c);await Promise.all([c.api.submitAccessRequest(),c.api.submitAccessRequest()]);assert.equal(calls,1);
});

test('native Expo network errors do not leak implementation details and remain retryable',async()=>{
 const calls=[];let offline=true;const c=client({fetch:async(_url,options)=>{calls.push(options);if(offline)throw Error('UnexpectedException: Could not connect (ExpoModulesCore/Promise.swift:56)');return response('pending');}});
 await fill(c);await c.api.submitAccessRequest();assert.match(c.state().error,/Нет ответа сервера/);assert.doesNotMatch(c.state().error,/UnexpectedException|swift/);
 offline=false;await c.api.submitAccessRequest();assert.equal(c.state().record.status,'pending');assert.equal(c.state().error,'');assert.equal(calls[0].headers.Authorization,calls[1].headers.Authorization);
});
