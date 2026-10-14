import test from 'node:test';
import assert from 'node:assert/strict';
import {paragraphText, articleBody, articleContents, relatedArticles, articleConceptBody, sourceTimes} from './src/articles.js';

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const href=values=>'#'+new URLSearchParams(values);
const paragraph={id:'p',text:'🪷 Это понятие <script>alert(1)</script>',evidence_ids:['e'],mentions:[{start:6,end:13,link_id:'l'}]};
const link={id:'l',concept_id:'concept-id',concept_title:'Понятие',concept_kind:'term',resource_id:'abcdefghijk',material_id:'material',title:'Источник',relation:'explains',rationale:'Разбирается в уроке.',evidence_ids:['e']};
const evidence={id:'e',resource_id:'abcdefghijk',text:'Фраза "из источника" <b>',start_seconds:70,end_seconds:80};
const article={introduction:[paragraph],sections:[{id:'meaning',heading:'Смысл <раздела>',paragraphs:[paragraph]}],links:[link],evidence:[evidence],related:[{material_id:'target',title:'Следующая статья',reason:'Общий контекст <понятия>'}]};

test('inline concept slices Unicode code points and escapes every run',()=>{
  const result=paragraphText(paragraph,new Map([['l',link]]),esc,href);
  assert.match(result,/🪷 Это <a[^>]+href="#view=concept&id=concept-id">понятие<\/a>/);
  assert.match(result,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(result,/<script>/);
  assert.equal(paragraphText(paragraph,new Map(),esc,href),esc(paragraph.text));
});

test('body, contents, related and backlinks have direct readable destinations',()=>{
  assert.match(articleBody(article,esc,href),/id="article-section-meaning"/);
  assert.match(articleContents(article,esc),/data-anchor="article-section-meaning"/);
  assert.match(articleBody(article,esc,href),/Смысл &lt;раздела&gt;/);
  assert.match(articleBody(article,esc,href),/title="Фраза &quot;из источника&quot; &lt;b&gt;"/);
  assert.match(relatedArticles(article,esc,href),/href="#view=article&id=target"/);
  assert.doesNotMatch(relatedArticles(article,esc,href),/view=graph/);
const concept={kind:'term',aliases:[],claims:[paragraph],links:[link],evidence:[evidence]};
  assert.match(articleConceptBody(concept,esc,href),/href="#view=article&id=material"/);
  assert.match(articleConceptBody(concept,esc,href),/t=70s/);
});

test('public source timestamps do not reconstruct a protected recording URL',()=>{
  const safe = structuredClone(article); delete safe.evidence[0].resource_id;
  assert.doesNotMatch(articleBody(safe,esc,href),/youtube|watch\?v=|undefined/);
  assert.match(articleBody(safe,esc,href),/01:10 · Запись доступна после проверки доступа/);
});

test('archive source opens canonical Drive without inventing YouTube seeking',()=>{
  const e={...evidence,resource_id:'drive:fixtureRecording01',source_url:'https://drive.google.com/file/d/fixtureRecording01/view'};
  const result=sourceTimes(['e'],new Map([['e',e]]),esc);
  assert.match(result,/href="https:\/\/drive.google.com\/file\/d\/fixtureRecording01\/view"/);
  assert.match(result,/01:10 · Drive/);
  assert.doesNotMatch(result,/youtube|&amp;t=|#t=/);
  for(const unsafe of ['javascript:alert(1)','https://drive.google.com/file/d/anotherRecordingID/view']) {
    assert.doesNotMatch(sourceTimes(['e'],new Map([['e',{...e,source_url:unsafe}]]),esc),/<a /);
  }
});

test('archive articles and concepts disclose text-only scope and escape caveats',()=>{
  const draft={...article,status:'text_reviewed_asr_draft',coverage_note:'Ограничено <фрагментами>.'};
  const rendered=articleBody(draft,esc,href);
  assert.doesNotMatch(rendered,/Аудио не прослушано/);
  assert.match(rendered,/Ограничено &lt;фрагментами&gt;/);
  assert.equal(articleContents(draft,esc),articleContents(article,esc));
  assert.match(articleConceptBody({kind:'topic',aliases:[],claims:[paragraph],links:[link],evidence:[evidence],status:'text_reviewed_asr_draft'},esc,href),/По машинным текстам · Аудио не прослушано · Черновик/);
  assert.doesNotMatch(articleBody(article,esc,href),/Аудио не прослушано/);
});
