import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const source=readFileSync(new URL('./src/content.js',import.meta.url));
const {renderFragments}=await import('data:text/javascript;base64,'+source.toString('base64'));
const esc=value=>String(value).replaceAll('<','&lt;').replaceAll('>','&gt;');
const annotation={points:[{text:'<script>Цитата</script>',start_seconds:65,end_seconds:80}]};
test('public evidence keeps quotes and timecodes without a reconstructible recording URL',()=>{
  const html=renderFragments(annotation,esc);
  assert.match(html,/01:05/);assert.match(html,/&lt;script&gt;/);
  assert.doesNotMatch(html,/<a|href=|youtube|youtu\.be|undefined/);
  assert.match(html,/после проверки доступа/);
});
test('authorized recording evidence keeps timecode links only for a valid source identifier',()=>{
  assert.match(renderFragments({...annotation,resource_id:'abcdefghijk'},esc),/watch\?v=abcdefghijk&amp;t=65s/);
  for(const id of [undefined,'',null,'not-a-source','<script>']) {
    assert.doesNotMatch(renderFragments({...annotation,resource_id:id},esc),/href=|youtube/);
  }
});
