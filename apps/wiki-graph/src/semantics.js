// Editorial text is escaped. Every semantic relation shows its source evidence.
export const RELATIONS = {discusses:'Обсуждается', explains:'Объясняется', practices:'Разбирается в практике'};
export const conceptKind = kind => kind === 'term' ? 'Термин' : 'Тема';
export function quoteEvidence(link, esc) {
  return `<ul class="source-links">${link.points.map(p => {
    const n=Math.floor(p.start_seconds), label=`${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;
    return `<li><a href="https://www.youtube.com/watch?v=${encodeURIComponent(link.resource_id)}&amp;t=${n}s" target="_blank" rel="noopener noreferrer">${label} ↗</a> — «${esc(p.text)}»</li>`;
  }).join('')}</ul>`;
}
export function materialConcepts(items, esc, href) {
  return items.map(item => `<div class="semantic-relation"><h3><a data-route href="${href({view:'concept',id:item.id})}">${esc(item.title)}</a></h3>
    <p class="muted small">${conceptKind(item.kind)} · ${RELATIONS[item.relation]} · Черновик</p>
    <p>${esc(item.rationale)}</p>${quoteEvidence(item,esc)}</div>`).join('');
}
export function conceptBody(page, esc, href) {
  return `<p class="muted small">${conceptKind(page.kind)} · По проверенным расшифровкам · Черновик</p>
    ${page.aliases.length?`<p class="muted">Также: ${page.aliases.map(esc).join(', ')}</p>`:''}
    ${page.claims.map(c=>`<p class="source-description">${esc(c.text)} <span class="small">${c.evidence_indexes.map(i=>`<button class="link-inline" data-anchor="evidence-${i+1}" aria-label="Источник ${i+1}">[${i+1}]</button>`).join(' ')}</span></p>`).join('')}
    <section><h2>Материалы и подтверждения</h2>${page.links.map((link,i)=>`<div id="evidence-${i+1}" class="semantic-relation"><h3>${i+1}. <a data-route href="${href({view:'article',id:link.material_id})}">${esc(link.title)}</a></h3>
      <p class="muted small">${RELATIONS[link.relation]}</p><p>${esc(link.rationale)}</p>${quoteEvidence(link,esc)}</div>`).join('')}</section>
    <p class="muted small">Описание относится к указанным занятиям. Проверка по тексту не означает одобрения преподавателем.</p>`;
}
export function mountSemanticViews({root,api,esc,shell,href,ticket,onAuth,restoreScroll}) {
  async function listing(query='') {
    const request=ticket();
    root.innerHTML=shell('concepts',`<div class="library-heading"><h1>Темы и словарь</h1><p class="library-intro">Понятия из проверенных текстов. У каждого описания есть источники.</p></div><div id="semantic-content"><p class="muted" role="status">Загружаем страницы…</p></div>`);
    try {
      const data=await api('/api/wiki/concepts'+(query?'?q='+encodeURIComponent(query):''));
      if(request!==ticket())return;
      root.querySelector('#semantic-content').innerHTML=data.items.length?`<div class="material-grid">${data.items.map(p=>`<a class="material-card" data-route href="${href({view:'concept',id:p.id})}"><span><strong>${esc(p.title)}</strong><small>${conceptKind(p.kind)} · Материалов: ${p.materials} · Черновик</small></span></a>`).join('')}</div>`:'<div class="library-empty"><h2>Пока нет проверенных страниц</h2><p class="muted">Они появятся после проверки текстов и цитат.</p></div>';
      restoreScroll();
    }catch(e){if(request!==ticket())return;if(e.auth)return onAuth();root.querySelector('#semantic-content').innerHTML='<p class="muted">Страницы не загрузились. <button class="btn" data-semantic-retry>Повторить</button></p>';root.querySelector('[data-semantic-retry]').onclick=()=>listing(query);}
  }
  async function page(id) {
    const request=ticket();
    root.innerHTML=shell('concepts',`<button class="library-back btn" data-back>← Назад</button><article class="semantic-reader"><h1 id="concept-title">Страница словаря</h1><div id="semantic-content"><p class="muted" role="status">Загружаем описание…</p></div></article>`);
    try {
      const data=await api('/api/wiki/concepts/'+encodeURIComponent(id));
      if(request!==ticket())return;
      root.querySelector('#concept-title').textContent=data.title;
      root.querySelector('#semantic-content').innerHTML=conceptBody(data,esc,href)+`<div class="reader-actions"><a class="btn" data-route href="${href({view:'graph',mode:'local',sel:'g:'+data.id,depth:'1'})}">Локальный граф</a></div>`;
      restoreScroll();
    }catch(e){if(request!==ticket())return;if(e.auth)return onAuth();root.querySelector('#semantic-content').innerHTML=(e.message==='404'?'<p class="muted">Страница отсутствует или требует повторной проверки источников.</p>':'<p class="muted">Описание не загрузилось. <button class="btn" data-semantic-retry>Повторить</button></p>')+`<a data-route href="#view=concepts">К темам и словарю</a>`;const retry=root.querySelector('[data-semantic-retry]');if(retry)retry.onclick=()=>page(id);}
  }
  async function article(id) {
    const request=ticket(), box=root.querySelector('#article-semantic');
    try {
      const data=await api('/api/wiki/materials/'+encodeURIComponent(id)+'/concepts');
      if(request!==ticket()||!box.isConnected)return;
      box.innerHTML=data.items.length?`<h2>Темы и понятия</h2>${materialConcepts(data.items,esc,href)}`:'';
      box.hidden=!data.items.length;
    }catch(e){if(request!==ticket()||!box.isConnected)return;if(e.auth)return onAuth();box.hidden=false;box.innerHTML='<h2>Темы и понятия</h2><p class="muted">Связи не загрузились. <button class="btn" data-semantic-retry>Повторить</button></p>';box.querySelector('[data-semantic-retry]').onclick=()=>article(id);}
  }
  return {listing,page,article};
}
