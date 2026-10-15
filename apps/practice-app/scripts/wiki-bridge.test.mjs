import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync(new URL('../src/features/wiki/bridge.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const exports={};vm.runInNewContext(code,{exports,URL});
const {publicWikiPath,replyScript,externalSource,protectedSource,publicSource}=exports;
test('native bridge permits only public graph and a single material, never access or arbitrary URL',()=>{
  assert.equal(publicWikiPath('/api/wiki/graph'),'/graph');
  assert.equal(publicWikiPath('/api/wiki/materials/material_123'),'/materials/material_123');
  for(const path of ['/api/access/session','/api/wiki/materials/../graph','/api/wiki/materials/%2e%2e','/api/wiki/materials/a?token=x','https://attacker.invalid/api/wiki/graph',null,{}]) assert.equal(publicWikiPath(path),null);
});
test('API text cannot break injected reply or become executable code',()=>{
  const value={text:'</script><script>alert(1)</script>\u2028\u2029 & >'};
  const script=replyScript('12',value);
  assert.equal(script.includes('</script>'),false);assert.equal(script.includes('\u2028'),false);
  let received;vm.runInNewContext(script,{window:{__daycheeReply:data=>received=data}});
  assert.deepEqual(JSON.parse(JSON.stringify(received)),{id:'12',value});
});
test('external sources require HTTPS and prohibit embedded credentials',()=>{
  assert.equal(externalSource('https://www.youtube.com/watch?v=example&t=60'),true);
  for(const link of ['javascript:alert(1)','file:///etc/passwd','http://example.com','https://token:secret@example.com',null]) assert.equal(externalSource(link),false);
});
test('public source messages cannot open recordings or Zoom; protected sources need the native authorized path',()=>{
  for(const host of ['youtu.be','YouTube.com.','m.youtube.com','www.youtube-nocookie.com','us02web.zoom.us','zoom.com']) {
    const url='https://'+host+'/recording';
    assert.equal(protectedSource(url),true);assert.equal(publicSource(url),false);
    assert.equal(externalSource(url),true);
  }
  assert.equal(publicSource('https://example.org/article'),true);
  assert.equal(protectedSource('https://youtube.com.example.org/article'),false);
});
test('bundled UI has no remote script, network permissions, or corpus snapshot',()=>{
  const source=readFileSync(new URL('../src/features/wiki/native-html.ts',import.meta.url),'utf8');
  const html=JSON.parse(source.slice(source.indexOf(' = ')+3).trim().slice(0,-1));
  assert.match(html,/connect-src 'none'/);assert.match(html,/script-src 'nonce-daychee-local-ui'/);
  assert.doesNotMatch(html,/<script[^>]+src=/);assert.doesNotMatch(html,/<link[^>]+href=/);
  assert.doesNotMatch(source,/EXPO_PUBLIC_DAYCHEE_API_URL|BEGIN PRIVATE KEY|catalog\.json/);
});
test('generated inline JavaScript parses after HTML interpolation',()=>{
  const source=readFileSync(new URL('../src/features/wiki/native-html.ts',import.meta.url),'utf8');
  const html=JSON.parse(source.slice(source.indexOf(' = ')+3).trim().slice(0,-1));
  const scripts=[...html.matchAll(/<script nonce="daychee-local-ui">([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length,1);
  assert.doesNotThrow(()=>new vm.Script(scripts[0][1]));
});
