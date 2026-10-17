import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const root=new URL('../src/features/',import.meta.url).pathname;
const cache=new Map();
function load(file){const name=path.resolve(root,file.endsWith('.ts')?file:file+'.ts');if(cache.has(name))return cache.get(name);const exports={};cache.set(name,exports);const code=ts.transpileModule(readFileSync(name,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(code,{exports,require:id=>load(path.resolve(path.dirname(name),id)),URL,URLSearchParams,Set,Map,Error,Number,Promise,Symbol});return exports;}
const {createProtectedWikiReader,protectedWikiPath,readerLocation,meetingSource}=load('wiki/protected-reader');
const {publicWikiPath}=load('wiki/bridge');const {CabinetError}=load('cabinet-account/protocol');
const defer=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function harness(read=async()=>({links:[{url:'https://youtu.be/synthetic00'}]})){
 let state={status:'active',hasSession:true,signIn:'idle',account:{id:'one'},retryAt:0,error:null};const listeners=new Set();
 const session={getState:()=>state,subscribe:cb=>{listeners.add(cb);return()=>listeners.delete(cb);}};
 const reader=createProtectedWikiReader({session,read});const off=reader.subscribe(()=>{});
 return {reader,off,change:patch=>{state={...state,...patch};for(const cb of listeners)cb();}};
}
test('protected route allowlist never widens public bridge or accepts arbitrary authority',()=>{
 for(const p of ['/api/wiki/categories','/api/wiki/graph?semantics=1&articles=1','/api/wiki/materials/lesson-1','/api/wiki/articles/materials/lesson-1','/api/wiki/articles/concepts/topic','/api/wiki/concepts?q=%D1%82%D0%B5%D1%81%D1%82'])assert.ok(protectedWikiPath(p));
 for(const p of ['/api/access/zoom','/api/wiki/graph?issuer=production','/api/wiki/graph?articles=1&articles=1','/api/wiki/materials/../graph','/api/wiki/materials/a#secret','/api/wiki/graph#secret','https://backend.test/api/wiki/graph','/api/wiki/concepts?q='+ 'a'.repeat(301)])assert.equal(protectedWikiPath(p),null);
 assert.equal(publicWikiPath('/api/wiki/graph?articles=1'),null);assert.equal(publicWikiPath('/api/wiki/articles/materials/lesson-1'),null);
});
test('background/tab/credential transition rejects delayed success and clears link capabilities',async()=>{
 for(const event of ['background','tab','account','renew','signout']){
 const d=defer();const h=harness(async()=>d.promise);const epoch=h.reader.getState().epoch;const request=h.reader.request('/materials/lesson');
 if(event==='background')h.reader.setForeground(false);if(event==='tab')h.reader.setVisible(false);if(event==='account')h.change({account:{id:'two'}});if(event==='renew')h.change({});if(event==='signout')h.change({hasSession:false,status:'signed-out',account:null});
 d.resolve({links:[{url:'https://youtu.be/synthetic00'}]});await assert.rejects(request,e=>e.kind==='interrupted');assert.equal(h.reader.current(epoch),false);await assert.rejects(h.reader.source('https://youtu.be/synthetic00'));h.off();
 }
});
test('failure clears reader, recovery re-reads, optional article404 preserves summary access',async()=>{
 let fail=false,calls=0;const h=harness(async path=>{calls++;if(path.includes('articles'))throw Error('404');if(fail)throw new CabinetError('temporarily_unavailable');return {id:'lesson'};});
 await h.reader.request('/materials/lesson');await assert.rejects(h.reader.request('/articles/materials/lesson'),/404/);assert.equal(h.reader.getState().phase,'ready');
 fail=true;await assert.rejects(h.reader.request('/graph'));assert.equal(h.reader.getState().phase,'unavailable');const before=calls;await assert.rejects(h.reader.request('/graph'));assert.equal(calls,before);
 fail=false;h.change({status:'active'});assert.equal((await h.reader.request('/materials/lesson')).id,'lesson');h.off();
});
test('only a current exact revalidated source opens; no Zoom, arbitrary URL or removed recording',async()=>{
 const url='https://drive.google.com/file/d/synthetic/view';let present=true,calls=0;
 const h=harness(async()=>{calls++;return {links:present?[{url}]:[]};});
 await assert.rejects(h.reader.source(url));await h.reader.request('/materials/lesson');assert.equal(await h.reader.source(url),url);assert.equal(calls,2);
 present=false;await assert.rejects(h.reader.source(url));await assert.rejects(h.reader.source('https://evil.test'));
 for(const candidate of ['https://zoom.us/j/123','https://us02web.zoom.us/j/123','https://ZOOM.COM./join'])assert.equal(meetingSource(candidate),true);
 assert.equal(meetingSource('https://zoom.us.attacker.invalid/j/123'),false);h.off();
});
test('bounded navigation survives background/retry but clears on logout or account change',()=>{
 const h=harness();const saved={hash:'#view=catalog&q=abc',scroll:510,history:['#view=home','#view=catalog&q=abc'],camera:{x:0,y:1,ratio:2,angle:0}};
 h.reader.checkpoint(saved);h.reader.setForeground(false);assert.deepEqual(JSON.parse(JSON.stringify(h.reader.getState().location)),saved);
 h.reader.setForeground(true);h.change({status:'checking'});h.change({status:'active'});assert.equal(h.reader.getState().location.scroll,510);
 h.change({account:{id:'two'}});assert.equal(h.reader.getState().location,null);h.reader.checkpoint(saved);h.change({status:'signed-out',hasSession:false,account:null});assert.equal(h.reader.getState().location,null);h.off();
 for(const x of [null,{...saved,hash:'https://evil.test'},{...saved,scroll:Infinity},{...saved,history:['javascript:alert(1)']}])assert.equal(readerLocation(x),null);
});


test('evidence timestamps open only after exact current source/time revalidation',async()=>{
 let seconds=10;const h=harness(async()=>({evidence:[{resource_id:'abcdefghijk',start_seconds:seconds}]}));
 const url='https://www.youtube.com/watch?v=abcdefghijk&t=10s';
 await h.reader.request('/articles/materials/lesson');assert.equal(await h.reader.source(url),url);
 seconds=20;await assert.rejects(h.reader.source(url));h.off();
});
