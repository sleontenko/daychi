import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=readFileSync(new URL('../src/features/access/session.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const A='a'.repeat(64), B='b'.repeat(64), KEY='daychee.access.session.v1';
const response=(data={},status=200)=>({ok:status===200,status,json:async()=>data});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function client(fetch,saved=null,write){
 const storage=new Map(saved?[[KEY,saved]]:[]),exports={};
 vm.runInNewContext(code,{exports,require:name=>({
  './access-errors':{AccessError:Error,invitationErrors:{}},'./invitation-code':{isInvitationCode:()=>false},
  'expo-secure-store':{getItemAsync:async key=>storage.get(key)??null,setItemAsync:async(key,value)=>{await write?.(value);storage.set(key,value);},deleteItemAsync:async key=>storage.delete(key),WHEN_UNLOCKED_THIS_DEVICE_ONLY:1},
  react:{useSyncExternalStore:(_subscribe,snapshot)=>snapshot()},'react-native':{Platform:{OS:'ios'}},
 }[name]),process:{env:{EXPO_PUBLIC_DAYCHEE_API_URL:'https://example.test'}},fetch,AbortController,setTimeout,clearTimeout});
 return {api:exports,storage};
}
test('approved request does not replace an existing invitation session',async()=>{
 const seen=[];const c=client(async(url,options)=>{seen.push(options.headers.Authorization);return response();},B);
 await c.api.restoreAccess();await c.api.acceptApprovedSession(A);await c.api.privateRequest('/private');
 assert.deepEqual(seen,['Bearer '+B,'Bearer '+B]);assert.equal(c.storage.get(KEY),B);
});
test('invitation login wins over an older claim verification',async()=>{
 const entered=deferred(),verification=deferred();
 const c=client(async(url)=>{if(url.endsWith('/session')){entered.resolve();return verification.promise;}return response({token:B});});
 const claim=c.api.acceptApprovedSession(A);await entered.promise;await c.api.redeemInvitation('invitation');verification.resolve(response());
 await assert.rejects(claim,/Доступ изменился/);assert.equal(c.storage.get(KEY),B);assert.equal(c.api.useAccess(),'active');
});
test('serialize Keychain writes so an older claim cannot overwrite a newer login',async()=>{
 const entered=deferred(),write=deferred();
 const c=client(async(url)=>response(url.endsWith('/redeem')?{token:B}:{}),null,async value=>{if(value===A){entered.resolve();await write.promise;}});
 const claim=c.api.acceptApprovedSession(A);await entered.promise;const login=c.api.redeemInvitation('invitation');write.resolve();await Promise.all([claim,login]);
 assert.equal(c.storage.get(KEY),B);assert.equal(c.api.useAccess(),'active');
});
test('delayed logout response cannot clear a newer login',async()=>{
 const entered=deferred(),logout=deferred();
 const c=client(async(url)=>{if(url.endsWith('/logout')){entered.resolve();return logout.promise;}return response(url.endsWith('/redeem')?{token:B}:{});},A);
 await c.api.restoreAccess();const exiting=c.api.logoutAccess();await entered.promise;await c.api.redeemInvitation('invitation');logout.resolve(response());await exiting;
 assert.equal(c.storage.get(KEY),B);assert.equal(c.api.useAccess(),'active');
});
test('foreground restore does not consume and lose an in-flight invitation',async()=>{
 const entered=deferred(),redeem=deferred();
 const c=client(async(url)=>{if(url.endsWith('/redeem')){entered.resolve();return redeem.promise;}return response();});
 const login=c.api.redeemInvitation('invitation');await entered.promise;await c.api.restoreAccess();redeem.resolve(response({token:B}));await login;
 assert.equal(c.storage.get(KEY),B);assert.equal(c.api.useAccess(),'active');
});
test('old unauthorized response cannot erase a new session whose Keychain write is pending',async()=>{
 const queried=deferred(),privateResponse=deferred(),writing=deferred(),finishWrite=deferred();
 const c=client(async(url)=>{if(url.endsWith('/private')){queried.resolve();return privateResponse.promise;}return response(url.endsWith('/redeem')?{token:B}:{});},A,async value=>{if(value===B){writing.resolve();await finishWrite.promise;}});
 await c.api.restoreAccess();const old=c.api.privateRequest('/private');const rejection=assert.rejects(old);await queried.promise;
 const login=c.api.redeemInvitation('invitation');await writing.promise;privateResponse.resolve(response({},401));finishWrite.resolve();await Promise.all([login,rejection]);
 assert.equal(c.storage.get(KEY),B);assert.equal(c.api.useAccess(),'active');
});
