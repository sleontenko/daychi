import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const source=readFileSync(new URL('./src/content.js',import.meta.url));
const {renderAnnotation}=await import('data:text/javascript;base64,'+source.toString('base64'));
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
test('source text is escaped; timecode URL is fixed to YouTube; draft status visible',()=>{
  const html=renderAnnotation({summary:'<script>alert(1)</script>',resource_id:'abcdefghijk',points:[{text:'<img src=x onerror=alert(1)>',start_seconds:390}]},esc);
  assert.ok(!html.includes('<script>')&&!html.includes('<img'));
  assert.ok(html.includes('06:30')&&html.includes('&amp;t=390s'));
  assert.ok(html.includes('черновик')&&html.includes('noopener noreferrer'));
});
