// Plain editorial text with code-point spans. Every rendered run is escaped.
import { conceptKind, RELATIONS } from './semantics.js';

export function paragraphText(paragraph, links, esc, href) {
  const chars = Array.from(paragraph.text), runs = []; let position = 0;
  for (const mention of paragraph.mentions || []) {
    const link = links.get(mention.link_id);
    runs.push(esc(chars.slice(position, mention.start).join('')));
    const text = esc(chars.slice(mention.start, mention.end).join(''));
    runs.push(link ? `<a class="concept-inline" data-route href="${href({view:'concept',id:link.concept_id})}">${text}</a>` : text);
    position = mention.end;
  }
  runs.push(esc(chars.slice(position).join('')));
  return runs.join('');
}

function timeLabel(seconds) {
  const n = Math.floor(seconds);
  return `${Math.floor(n/3600) ? Math.floor(n/3600)+':' : ''}${String(Math.floor(n/60)%60).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
}

export function sourceTimes(ids, evidence, esc) {
  return `<span class="article-evidence">${ids.map(id => {
    const e = evidence.get(id);
    if (!e) return '';
    if (typeof e.resource_id !== 'string' || !/^[A-Za-z0-9_-]{11}$/.test(e.resource_id))
      return `<span title="${esc(e.text)}">${timeLabel(e.start_seconds)} · Запись доступна после проверки доступа</span>`;
    return `<a href="https://www.youtube.com/watch?v=${encodeURIComponent(e.resource_id)}&amp;t=${Math.floor(e.start_seconds)}s" target="_blank" rel="noopener noreferrer" title="${esc(e.text)}" aria-label="Источник: ${timeLabel(e.start_seconds)}">${timeLabel(e.start_seconds)} ↗</a>`;
  }).join(' ')}</span>`;
}

export function articleBody(article, esc, href) {
  const links = new Map(article.links.map(l=>[l.id,l])), evidence = new Map(article.evidence.map(e=>[e.id,e]));
  const paragraph = (p,lead=false) => `<p class="source-description${lead?' reader-lead':''}">${paragraphText(p,links,esc,href)} ${sourceTimes(p.evidence_ids,evidence,esc)}</p>`;
  return article.introduction.map(p=>paragraph(p,true)).join('') + article.sections.map((s,i)=>
    `<section id="article-section-${esc(s.id)}"><h2><span class="section-number" aria-hidden="true">${String(i+1).padStart(2,'0')}</span>${esc(s.heading)}</h2>${s.paragraphs.map(p=>paragraph(p)).join('')}</section>`).join('');
}

export function articleContents(article, esc) {
  return `<button data-anchor="article-summary">Введение</button>${article.sections.map(s=>`<button data-anchor="article-section-${esc(s.id)}">${esc(s.heading)}</button>`).join('')}<button data-anchor="article-connections">Связанные материалы</button>`;
}

export function relatedArticles(article, esc, href) {
  return article.related.length ? `<div class="material-grid related-grid">${article.related.map(r=>
    `<a class="material-card" data-route href="${href({view:'article',id:r.material_id})}"><span><strong>${esc(r.title)}</strong><small>${esc(r.reason)}</small></span></a>`).join('')}</div>` : '<p class="muted">Проверенных смысловых связей с другими статьями пока нет.</p>';
}

export function articleConceptBody(page, esc, href) {
  const evidence = new Map(page.evidence.map(e=>[e.id,e]));
  return `<p class="muted small">${conceptKind(page.kind)} · По проверенным расшифровкам · Черновик</p>
    ${page.aliases.length?`<p class="muted">Также: ${page.aliases.map(esc).join(', ')}</p>`:''}
    ${page.claims.map(c=>`<p class="source-description">${esc(c.text)} ${sourceTimes(c.evidence_ids,evidence,esc)}</p>`).join('')}
    <section><h2>Материалы и подтверждения</h2>${page.links.map(link=>`<div class="semantic-relation"><h3><a data-route href="${href({view:'article',id:link.material_id})}">${esc(link.title)}</a></h3><p class="muted small">${RELATIONS[link.relation]}</p><p>${esc(link.rationale)}</p>${sourceTimes(link.evidence_ids,evidence,esc)}</div>`).join('')}</section>`;
}

export function mountArticleConcepts({root,api,esc,shell,href,ticket,onAuth,restoreScroll,concepts}) {
  function listing(query='') {
    const folded = query.toLocaleLowerCase('ru');
    const selected = concepts.filter(n=>[n.label,...(n.aliases||[])].join(' ').toLocaleLowerCase('ru').includes(folded));
    root.innerHTML=shell('concepts',`<div class="library-heading"><h1>Темы и словарь</h1><p class="library-intro">Понятия из проверенных текстов. У каждого описания есть источники.</p></div><div class="material-grid">${selected.map(n=>`<a class="material-card" data-route href="${href({view:'concept',id:n.concept_id})}"><span><strong>${esc(n.label)}</strong><small>${conceptKind(n.type)}</small></span></a>`).join('')}</div>`);
    restoreScroll();
  }
  async function page(id) {
    const request=ticket();
    root.innerHTML=shell('concepts',`<button class="library-back btn" data-back>← Назад</button><article class="semantic-reader"><h1 id="concept-title">Страница понятия</h1><div id="semantic-content"><p class="muted" role="status">Загружаем описание…</p></div></article>`);
    try {
      const data=await api('/api/wiki/articles/concepts/'+encodeURIComponent(id));
      if(request!==ticket())return;
      root.querySelector('#concept-title').textContent=data.title;
      root.querySelector('#semantic-content').innerHTML=articleConceptBody(data,esc,href)+`<div class="reader-actions"><a class="btn" data-route href="${href({view:'graph',mode:'local',sel:'g:'+data.id,depth:'1'})}">Локальный граф</a></div>`;
      restoreScroll();
    }catch(e){
      if(request!==ticket())return;if(e.auth)return onAuth();
      root.querySelector('#semantic-content').innerHTML=e.message==='404'?'<p class="muted">Страница отсутствует или требует повторной проверки источников.</p>':'<p class="muted">Описание не загрузилось. <button class="btn" data-concept-retry>Повторить</button></p>';
      const retry=root.querySelector('[data-concept-retry]');if(retry)retry.onclick=()=>page(id);
    }
  }
  return {listing,page};
}
