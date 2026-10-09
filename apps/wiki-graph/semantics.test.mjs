import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const source=readFileSync(new URL('./src/semantics.js',import.meta.url));
const {conceptBody,materialConcepts}=await import('data:text/javascript;base64,'+source.toString('base64'));
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const href=p=>'#'+new URLSearchParams(p).toString();
const link={material_id:'material-1',resource_id:'abcdefghijk',title:'<script>source</script>',
  relation:'explains',rationale:'<img src=x onerror=alert(1)>',points:[{text:'<b>Точная цитата</b>',start_seconds:65,end_seconds:80}]};
test('each semantic relation displays escaped proof and a fixed timecode URL',()=>{
  const html=materialConcepts([{...link,id:'topic-1',kind:'topic',title:'<script>Тема</script>'}],esc,href);
  assert.ok(!html.includes('<script>')&&!html.includes('<img')&&!html.includes('<b>'));
  assert.ok(html.includes('watch?v=abcdefghijk&amp;t=65s'));
  assert.ok(html.includes('view=concept')&&html.includes('Черновик'));
});
test('claim references do not replace the wiki route hash; each source links back to its material',()=>{
  const html=conceptBody({kind:'term',aliases:['<script>alias</script>'],claims:[{text:'Описание из источника',evidence_indexes:[0]}],links:[link]},esc,href);
  assert.ok(html.includes('data-anchor="evidence-1"')&&html.includes('<button'));
  assert.ok(!html.includes('href="#evidence-1"')&&!html.includes('<script>'));
  assert.ok(html.includes('view=article')&&html.includes('Материалы и подтверждения'));
});
