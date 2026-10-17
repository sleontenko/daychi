// The catalog and graph use the same authorized node identities. No second corpus.
import { renderSummary, renderFragments } from './content.js';
import { publications, relationReason, rememberOpened, BOOKMARKS_KEY, OPENED_KEY, readIds } from './ui-model.js';
import { mountSemanticViews } from './semantics.js';
import { articleBody, articleContents, relatedArticles, mountArticleConcepts } from './articles.js';
export function mountLibrary({ DATA, api, esc, showLogin, onGraph, host, beforeRoute = null, initialScroll = 0 }) {
  const lifecycle = new AbortController(); let disposed = false;
  const listen = (target, event, callback) => target.addEventListener(event, callback, { signal: lifecycle.signal });
  const root = document.querySelector('#library');
  const workspace = document.querySelector('#graph-workspace');
  const nodes = new Map(DATA.nodes.map(n => [n.id, n]));
  const concepts = DATA.nodes.filter(n => n.type === 'term' || n.type === 'topic');
  const conceptsEnabled = DATA.semantic_enabled || DATA.articles_enabled;
  const articleCache = new Map();
  const materials = DATA.nodes.filter(n => n.type === 'material').sort((a,b) => b.ts - a.ts);
  const sections = new Map(DATA.sections.map(s => [s.id, s]));
  const normalize = s => (s || '').toLowerCase().replace(/ё/g, 'е');
  const scroll = new Map();
  const inputState = new Map();
  function rememberInput() {
    const el = root.querySelector("#catalog-search");
    if (el) inputState.set(current,{value:el.value,start:el.selectionStart,end:el.selectionEnd});
  }
  let current = location.hash, graphHash = '#view=graph', catalogHash = '#view=catalog', libraryHash = '#view=home', recentHash = '#view=recent', ticket = 0;
  scroll.set(current, initialScroll);
  let articleTab = 'home';
  const tabRoutes = new Map(), readerOrigins = new Map();
  const tabFor = route => ['home','catalog','concepts','concept'].includes(route) ? 'home' : route;
  let webStorage; try { webStorage = localStorage; } catch {};
  let view, timer;
  const saved = new Set(host?.bookmarks || readIds(BOOKMARKS_KEY,webStorage));
  let opened = host?.opened || readIds(OPENED_KEY,webStorage);
  const recent = publications([...materials, ...(conceptsEnabled ? concepts : [])]);
  const icon = `<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg>`;
  const shell = (active, body) => `<main class="library-main">${body}</main>`;
  const search = query => `<div class="library-search">${icon}<label class="sr" for="catalog-search">Поиск по материалам</label><input id="catalog-search" type="search" maxlength="300" placeholder="${conceptsEnabled?'Найти занятие или понятие':'Найти занятие'}" value="${esc(query)}" autocomplete="off"></div>`;
  const params = () => new URLSearchParams(location.hash.slice(1));
  const href = (values) => '#' + new URLSearchParams(values).toString();
  const semantic = mountSemanticViews({root,api,esc,shell,href,ticket:()=>ticket,onAuth:()=>showLogin('Доступ закончился или был отозван.'),restoreScroll});
  const structured = mountArticleConcepts({root,api,esc,shell,href,concepts,ticket:()=>ticket,onAuth:()=>showLogin('Доступ закончился или был отозван.'),restoreScroll});
  const archiveLabel = n => n.sec === 'archive:archive-neidan' ? 'Архивный Нэйдань' : '';
  const articleLink = (n, updated = false, reason = '') => {
    if (n.concept_id) return conceptCard(n);
    const changed = Number(n.updated_ts) > 0;
    const date = updated && (changed || Number(n.ts) > 0)
      ? new Intl.DateTimeFormat('ru-RU', {day:'numeric',month:'short',timeZone:'Asia/Jerusalem'}).format(new Date(changed ? Number(n.updated_ts) : Number(n.ts)))
      : n.date;
    const caption = [archiveLabel(n), updated ? (changed ? 'Материал обновлён' : 'Дата исходной публикации')
      : reason || (n.sub || sections.get(n.sec)?.name || '') + (date && !reason ? ' · '+date : '')].filter(Boolean).join(' · ');
    return `<a class="material-card ${updated?'publication-card':''}" data-route href="${href({view:'article',id:n.id})}"><span><span class="material-title"><strong>${esc(n.label)}</strong>${updated?`<time class="publication-date ${changed?'changed':''}">${esc(date||'')}</time>`:''}</span><small>${esc(caption)}</small></span></a>`;
  };
  function conceptCard(n) {
    const date = 'Обновлено '+new Intl.DateTimeFormat('ru-RU', {day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Jerusalem'}).format(new Date(n.updated_ts));
    return `<a class="material-card" data-route href="${href({view:'concept',id:n.concept_id})}"><span><strong>${esc(n.label)}</strong><small>${esc(date)}</small></span></a>`;
  }
  function go(hash, replace = false, targetTab) {
    if (disposed) return;
    tabRoutes.set(view==='article'?articleTab:tabFor(view),current);
    rememberInput();
    scroll.set(current, window.scrollY);
    if (view === 'graph') graphHash = location.hash || '#view=graph';
    if (view === 'catalog') catalogHash = location.hash || '#view=catalog';
    if (['home','catalog','concepts','concept'].includes(view)) libraryHash = current || '#view=home';
    if (view === 'recent') recentHash = current || '#view=recent';
    if (targetTab) articleTab=targetTab; else if (view !== 'article') articleTab = tabFor(view);
    if (view === 'graph') onGraph({hash:current}, false, 'leave');
    const from = targetTab && readerOrigins.has(hash) ? readerOrigins.get(hash) : replace ? history.state?.from : (current || '#view=home');
    if(new URLSearchParams(hash.slice(1)).get('view')==='article' && !targetTab) readerOrigins.set(hash,from);
    host?.history.record(hash,replace);
    history[replace ? 'replaceState' : 'pushState']({wiki:true,from}, '', hash);
    route();
  }
  function restoreScroll() { requestAnimationFrame(() => { if (!disposed) window.scrollTo(0, scroll.get(location.hash) || 0); }); }
  async function route() {
    if (disposed) return;
    clearTimeout(timer); const own = ++ticket;
    if (host?.protectedReader) articleCache.clear();
    if (beforeRoute) {
      root.hidden = true; workspace.hidden = true;
      try { await beforeRoute(); } catch { return; }
      if (disposed || own !== ticket) return;
    }
    const p = params();
    view = p.get('view') || (host || location.pathname === '/wiki' ? 'home' : 'graph');
    if (!['home','recent','catalog','article','concepts','concept','graph','saved'].includes(view)) view = 'home';
    current = location.hash;
    host?.route({view, id:p.get('id'), canBack:host?.history.canBack});
    root.hidden = view === 'graph'; workspace.hidden = view !== 'graph';
    document.body.classList.toggle('library-open', view !== 'graph');
    document.body.dataset.wikiView = view;
    const activeTab = view === 'article' ? articleTab : tabFor(view);
    for (const [id,key] of [['nav-home','home'],['nav-recent','recent'],['nav-graph','graph'],['nav-saved','saved']]) {
      const el = document.getElementById(id);
      if(activeTab===key) el.setAttribute('aria-current','page'); else el.removeAttribute('aria-current');
    }
    document.querySelector('#nav-catalog').setAttribute('aria-pressed', String(view === 'catalog' || view === 'article'));
    document.querySelector('#nav-home').setAttribute('aria-pressed', String(activeTab === 'home'));
    document.querySelector('#nav-recent').setAttribute('aria-pressed', String(activeTab === 'recent'));
    document.querySelector('#nav-graph').setAttribute('aria-pressed', String(activeTab === 'graph'));
    if (view === 'graph') { onGraph(p, graphHash === location.hash); graphHash = location.hash; }
    else if (view === 'article') renderArticle(p.get('id'));
    else if (view === 'concepts' && conceptsEnabled) (DATA.articles_enabled ? structured : semantic).listing(p.get('q')||'');
    else if (view === 'concept' && conceptsEnabled) (nodes.get('g:'+p.get('id'))?.article_concept ? structured : semantic).page(p.get('id'));
    else { if(view==='catalog') catalogHash = location.hash || '#view=catalog'; renderCatalog(p); }
    restoreScroll();
  }
  function renderCatalog(p, { resultsOnly = false } = {}) {
    if (disposed) return;
    const category = sections.has(p.get('category')) ? p.get('category') : '';
    const prior = !resultsOnly && inputState.get(current);
    const query = prior ? prior.value : p.get('q') || '';
    // A navigation can happen before the debounce fires. Restore that draft too.
    if (prior && query !== (p.get('q') || '')) {
      const previous = current;
      query ? p.set('q', query) : p.delete('q');
      history.replaceState(history.state, '', '#'+p.toString());
      current = location.hash;
      inputState.set(current, prior);
      scroll.set(current, scroll.get(previous) || 0);
    }
    const page = Math.max(1, Math.min(100, Number(p.get('page')) || 1));
    const currentView = view === 'recent' ? 'recent' : view === 'home' ? 'home' : view === 'saved' ? 'saved' : 'catalog';
    const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
    const found = (currentView === 'recent' ? recent : currentView === 'saved' ? materials.filter(n=>saved.has(n.id)) : materials).filter(n => (!category || n.sec === category) && terms.every(t => normalize(n.label+' '+n.sub).includes(t)));
    if (!resultsOnly) {
      const home = currentView === 'home';
      const title = home ? 'Библиотека' : currentView === 'recent' ? 'Недавние публикации' : currentView === 'saved' ? 'Закладки' : category ? sections.get(category).name : 'Все материалы';
      root.innerHTML = shell(currentView, `<div class="library-heading ${home?'home-heading':''}"><h1>${esc(title)}</h1><p class="library-intro">${home?(conceptsEnabled?'Статьи и конспекты занятий, связанные с ними понятия.':'Конспекты занятий и материалы по разделам.'):currentView==='recent'?'Новые и обновлённые статьи и конспекты — по дате последнего изменения.':'Записи занятий и материалы по разделам.'}</p>${search(query)}</div>
        ${currentView!=='saved'?`<div class="catalog-filters" aria-label="Разделы">${[{id:'',name:'Все',count:materials.length},...DATA.sections].map(s => `<button data-category="${esc(s.id)}" aria-pressed="${category===s.id}">${esc(s.name)}</button>`).join('')}</div>`:''}<div id="catalog-content"></div>`);
    }
    const content = root.querySelector('#catalog-content');
    if (!found.length) content.innerHTML = currentView==='saved' && !query ? '<div class="library-empty"><h2>Нет сохранённых материалов</h2><p class="muted">Откройте материал и сохраните его для повторения.</p><a class="btn" data-route href="#view=catalog">Открыть каталог</a></div>' : !materials.length ? '<div class="library-empty"><h2>В вики пока нет материалов</h2><p class="muted">Опубликованные материалы появятся здесь.</p></div>' : `<div class="library-empty"><h2>Ничего не найдено</h2><p class="muted">Попробуйте другое слово или откройте все материалы.</p><button class="btn" data-reset>Сбросить поиск</button></div>`;
    else {
      const historyNodes = currentView === 'home' && !query ? opened.map(id=>nodes.get(id)).filter(n=>n?.type==='material').slice(0,3) : [];
      const historySection = historyNodes.length ? `<section class="opened-section"><div class="section-heading"><h2>Недавно открытые</h2><span>на этом устройстве</span></div><div class="material-grid opened-list">${historyNodes.map(n=>articleLink(n)).join('')}</div></section>` : '';
      content.innerHTML = historySection + `<section class="catalog-section"><div class="section-heading"><h2>${query?'Результаты поиска':currentView==='recent'?'Новые и обновлённые':currentView==='saved'?'Сохранённые страницы':'Все материалы'}</h2><span role="status">${found.length}</span></div><div class="material-grid">${found.slice(0,page*36).map(n=>articleLink(n,currentView==='recent')).join('')}</div>${found.length>page*36 ? '<button class="btn load-more" data-more>Показать ещё</button>' : ''}</section>`;
    }
    if(currentView==='saved') {
      const missing=[...saved].filter(id=>!nodes.has(id));
      if(missing.length) content.insertAdjacentHTML('beforeend',missing.map(id=>`<div class="library-empty"><p class="muted">Сохранённый материал больше не доступен.</p><button class="btn" data-bookmark="${esc(id)}">Убрать сохранение</button></div>`).join(''));
    }
    function filters(values, replace = false) { go(href({view:currentView,...(category?{category}:{}),...(query?{q:query}:{}),...values}), replace); }
    // Preserve the actual input element, selection and IME composition while filtering.
    if (!resultsOnly) {
      const input = root.querySelector('#catalog-search');
      if (prior?.value === input.value) input.setSelectionRange(prior.start,prior.end);
      let composing = false;
      const updateSearch = () => {
        clearTimeout(timer);
        if (composing) return;
        timer = setTimeout(() => {
          if (!['home','catalog','recent','saved'].includes(view)) return;
          const next = params();
          next.set('view', currentView);
          next.delete('page');
          input.value ? next.set('q', input.value) : next.delete('q');
          scroll.set(current, window.scrollY);
          history.replaceState({...history.state,wiki:true}, '', '#' + next.toString());
          current = location.hash; if(currentView==='catalog') catalogHash = current;
          if(['home','catalog'].includes(currentView)) libraryHash=current;
          if(currentView==='recent') recentHash=current;
          host?.history.record(current,true);
          renderCatalog(next, {resultsOnly:true});
        }, 220);
      };
      input.addEventListener('input', updateSearch);
      input.addEventListener('compositionstart', () => { composing = true; clearTimeout(timer); });
      input.addEventListener('compositionend', () => { composing = false; updateSearch(); });
    }
    // These controls stay mounted; their handlers use the latest query parameters.
    root.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=> {
      const next = params(); const draft=root.querySelector('#catalog-search')?.value; if(draft) next.set('q',draft); else next.delete('q'); next.set('view',currentView==='recent'?'recent':currentView==='saved'?'saved':'catalog'); next.delete('page');
      b.dataset.category ? next.set('category',b.dataset.category) : next.delete('category');
      go('#'+next.toString());
    });
    root.querySelector('[data-reset]')?.addEventListener('click',()=>go('#view='+currentView));
    root.querySelector('[data-more]')?.addEventListener('click',()=>{ const y=window.scrollY; filters({page:page+1},true); scroll.set(current,y); restoreScroll(); });
  }
  async function renderArticle(id) {
    if (disposed) return;
    const n = nodes.get(id), request = ticket;
    if(n?.type==='material') {
      opened=rememberOpened(opened,id);
      if(host) host.openedMaterial(id).catch(()=>{}); else try { webStorage?.setItem(OPENED_KEY,JSON.stringify(opened)); } catch {}
    }
    const back = `<button class="link-inline library-back" data-back>← Назад</button>`;
    if (!n || n.type !== 'material') { root.innerHTML=shell('catalog',back+'<h1>Материал не найден</h1><a href="#view=catalog" data-route>Вернуться в каталог</a>'); return; }
    root.innerHTML = shell('article', `<div class="reader-toolbar">${back}<button class="reader-bookmark" data-bookmark="${esc(id)}" aria-pressed="${saved.has(id)}">${saved.has(id)?'Сохранено':'Сохранить'}</button></div>
      <div class="reader-layout"><article><header class="reader-header"><span class="reader-kicker">${esc(archiveLabel(n)||'Занятие')}</span><h1 tabindex="-1">${esc(n.label)}</h1><p class="muted reader-date">${esc(n.date)}${n.sub?' · '+esc(n.sub):''}</p><p class="muted small" id="article-status" hidden></p><div id="article-links"></div></header>
      <details class="reader-toc" ${window.matchMedia('(min-width:1000px)').matches?'open':''}><summary>Содержание</summary><nav aria-label="Содержание"><button data-anchor="article-summary">Конспект</button><button data-anchor="article-connections">Связанные материалы</button></nav></details>
      <div id="article-summary" role="status">Загружаем описание…</div><section id="article-about" hidden><h2><span class="section-number" aria-hidden="true">01</span>Фрагменты записи</h2><div id="article-detail"></div></section>
      <section id="article-online" hidden></section><section id="article-semantic" hidden></section><section id="article-connections"><h2><span class="section-number" aria-hidden="true">02</span>Связанные материалы</h2><div id="article-related"></div><div class="reader-actions"><a class="btn" data-route href="${href({view:'graph',sel:id,mode:'local',depth:'1'})}">Показать на графе</a></div></section></article></div>`);
    const related = DATA.edges.filter(e=>e.k!=='semantic' && (e.s===id || e.t===id)).map(e=>({node:nodes.get(e.s===id?e.t:e.s),kind:e.k})).filter(({node})=>node);
    root.querySelector('#article-related').innerHTML = related.length ? `<div class="material-grid related-grid">${related.map(({node:m,kind})=>m.type==='material'?articleLink(m,false,relationReason(kind)):`<a class="material-card" data-route href="${href({view:'catalog',category:m.sec})}"><span><strong>${esc(m.label)}</strong><small>${m.type==='section'?'Раздел':'Подтема'} · ${relationReason(kind)}</small></span></a>`).join('')}</div>` : '<p class="muted">У этой записи пока нет опубликованных связей.</p>';
    let userMoved = false, tracking = false;
    const movement = new AbortController();
    const noteMovement = () => { if(tracking) userMoved = true; };
    for (const event of ['wheel','touchstart','keydown','click']) document.addEventListener(event,noteMovement,{signal:movement.signal,passive:true});
    requestAnimationFrame(()=> { tracking = true; });
    try {
      const bodyRequest = DATA.articles_enabled
        ? api('/api/wiki/articles/materials/'+encodeURIComponent(id)).then(body=>({body}),error=>({error}))
        : Promise.resolve({});
      const d=await api('/api/wiki/materials/'+encodeURIComponent(id));
      const result=await bodyRequest;
      if (request!==ticket) return;
      if(result.error?.auth) return showLogin('Доступ закончился или был отозван. Введите новый код.');
      if(result.body) articleCache.set(id,result.body);
      if(result.error?.message==='404') articleCache.delete(id);
      const body=result.body || (result.error && result.error.message!=='404' ? articleCache.get(id) : null);
      const failed=result.error && result.error.message!=='404';
      if(body) {
        root.querySelector('#article-summary').innerHTML=articleBody(body,esc,href);
        root.querySelector('.reader-toc nav').innerHTML=articleContents(body,esc);
        root.querySelector('#article-related').innerHTML=relatedArticles(body,esc,href);
        root.querySelector('#article-connections .section-number').textContent=String(body.sections.length+1).padStart(2,'0');
        const status=root.querySelector('#article-status');status.hidden=false;status.textContent=body.status==='text_reviewed_asr_draft'?'Статья по машинным текстам · аудио не прослушано · черновик':'Статья по расшифровке · черновик';
      } else if(!failed) {
        if (DATA.semantic_enabled) semantic.article(id);
        root.querySelector('#article-summary').innerHTML=d.annotation ? renderSummary(d.annotation, esc) : `<p class="source-description">${esc(d.description && d.description!==d.title ? d.description : 'В исходном каталоге отдельного описания нет.')}</p>`;
      }
      if(failed) {
        const message='<p class="muted" role="alert">Статья не загрузилась. Проверьте интернет. <button class="btn" data-article-retry>Повторить</button></p>';
        root.querySelector('#article-summary').innerHTML=(body?root.querySelector('#article-summary').innerHTML:'')+message;
        root.querySelector('[data-article-retry]').onclick=()=>renderArticle(id);
      }
      if(d.annotation && !body && !failed) {
        const status=root.querySelector('#article-status'); status.hidden=false; status.textContent='Конспект по расшифровке · черновик';
        if(d.annotation.points.length) {root.querySelector('#article-about').hidden=false;root.querySelector('#article-detail').innerHTML=renderFragments(d.annotation,esc);}
      }
      if(!body && !d.annotation?.points.length)root.querySelector('#article-connections .section-number').textContent='01';
      if(host && (d.restricted_links || host.protectedReader)) {
        const online=root.querySelector('#article-online'); online.hidden=false;
        online.innerHTML='<h2>Онлайн-занятие</h2><p class="muted">'+(host.protectedReader?'Для подключения к занятию нужен отдельный доступ школы.':'Ссылка доступна участникам закрытой группы.')+'</p><button class="btn" data-online>Проверить доступ</button>';
        online.querySelector('[data-online]').onclick=()=>host.online(id);
      }
      const links=(d.links||[]).filter(l=>l.type!=='zoom' && /^https?:\/\//i.test(l.url));
      root.querySelector('#article-links').innerHTML=links.length?`<ul class="source-links reader-sources">${links.map(l=>`<li><a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label||l.type)} ↗</a></li>`).join('')}</ul>`:'<p class="muted">Для этой записи нет ссылки на материал.</p>';
      if (!userMoved) restoreScroll();
    } catch(e) {
      if(request!==ticket) return;
      if(e.auth) return showLogin('Доступ закончился или был отозван. Введите новый код.');
      root.querySelector('#article-summary').innerHTML='<p class="muted">Описание не загрузилось. Проверьте интернет.</p><button class="btn" data-retry>Повторить</button>';
      root.querySelector('[data-retry]').onclick=()=>renderArticle(id);
    } finally { movement.abort(); }
  }
  document.querySelector('#nav-home').onclick=()=>go(tabRoutes.get('home')||libraryHash,false,'home');
  document.querySelector('#nav-recent').onclick=()=>go(tabRoutes.get('recent')||recentHash,false,'recent');
  document.querySelector('#nav-catalog').onclick=()=>go(catalogHash);
  document.querySelector('#nav-graph').onclick=()=>go(tabRoutes.get('graph')||graphHash,false,'graph');
  document.querySelector('#nav-saved').onclick=()=>go(tabRoutes.get('saved')||'#view=saved',false,'saved');
  listen(document, 'click',e=>{
    const a=e.target.closest('a[data-route],a[data-article]');
    if(a && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button===0) { e.preventDefault(); go(a.getAttribute('href')); }
    const bookmark=e.target.closest('[data-bookmark]');
    if(bookmark) { bookmark.disabled=true;
      (host ? host.bookmark(bookmark.dataset.bookmark) : Promise.resolve().then(()=>{const id=bookmark.dataset.bookmark;const next=saved.has(id)?[...saved].filter(x=>x!==id):[...saved,id]; if(webStorage) webStorage.setItem(BOOKMARKS_KEY,JSON.stringify(next)); return next;})).then(ids=>{if(disposed)return;saved.clear();ids.forEach(id=>saved.add(id));bookmark.textContent=saved.has(bookmark.dataset.bookmark)?'Сохранено':'Сохранить';bookmark.setAttribute('aria-pressed',String(saved.has(bookmark.dataset.bookmark)));if(view==='saved')renderCatalog(params());})
      .catch(()=>{bookmark.textContent='Не удалось сохранить · Повторить';}).finally(()=>{bookmark.disabled=false;});
    }
    const back=e.target.closest('[data-back]');
    if(back) { if(host) host.back(); else if(history.state?.wiki && history.state?.from) history.back(); else go('#view=catalog'); }
    const anchor=e.target.closest('[data-anchor]');
    if(anchor) document.getElementById(anchor.dataset.anchor)?.scrollIntoView({behavior:'smooth',block:'start'});
  });
  if(host) {
    host.back=()=>{
      rememberInput();scroll.set(current,window.scrollY);
      const previous=host.history.canBack?host.history.previous():null;
      const next=view==='article' && readerOrigins.has(current)?readerOrigins.get(current):previous || (view==='article'?'#view=catalog':'#view=home');
      host.history.record(next,true);
      history.replaceState({wiki:true},'',next);route();
    };
    document.querySelector('#native-back').onclick=()=>host.back();
  }
  listen(window, 'wiki-graph-navigation',()=>{ graphHash=location.hash; current=location.hash; host?.route({view:'graph',canBack:host?.history.canBack}); });
  listen(window, 'popstate',()=>{ rememberInput(); scroll.set(current,window.scrollY); if(view==='graph') onGraph({hash:current},false,'leave'); route(); });
  listen(window, 'hashchange',()=>{ if(current!==location.hash) route(); });
  route();
  return { dispose() { disposed = true; ++ticket; clearTimeout(timer); lifecycle.abort();
    for (const key of ['home','recent','catalog','graph','saved']) document.querySelector('#nav-'+key).onclick = null;
    articleCache.clear(); nodes.clear(); sections.clear(); scroll.clear(); inputState.clear(); root.innerHTML = "";
  } };
}
