import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const transpile=path=>ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const bridge={};vm.runInNewContext(transpile('../src/features/wiki/bridge.ts'),{exports:bridge,URL});
test('an older public server cannot send recording URLs or source IDs into the native reader',async()=>{
  const exports={},calls=[];
  vm.runInNewContext(transpile('../src/features/wiki/api.ts'),{
    exports,require:()=>bridge,process:{env:{EXPO_PUBLIC_DAYCHEE_API_URL:'https://daychi.test'}},
    AbortController,setTimeout,clearTimeout,
    fetch:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({id:'material1',
      links:[{url:'https://youtu.be/abcdefghijk',type:'article'},{url:'https://example.org/article',type:'article'}],
      annotation:{resource_id:'abcdefghijk',summary:'Конспект',points:[]}})};},
  });
  const value=await exports.wikiRequest('/materials/material1');
  assert.equal(value.links.length,1);assert.equal(value.restricted_links,true);
  assert.equal(value.annotation.summary,'Конспект');
  assert.doesNotMatch(JSON.stringify(value),/abcdefghijk|resource_id|youtu/);
  assert.equal(calls[0].url,'https://daychi.test/api/public/wiki/materials/material1');
  assert.equal(calls[0].options.cache,'no-store');assert.equal(calls[0].options.headers,undefined);
});
