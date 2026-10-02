// The catalog and graph use the same authorized node identities. No second corpus.
import { renderAnnotation } from './content.js';
export function mountLibrary({ DATA, api, esc, showLogin, onGraph }) {
  const root = document.querySelector('#library');
  const workspace = document.querySelector('#graph-workspace');
  const nodes = new Map(DATA.nodes.map(n => [n.id, n]));
  const materials = DATA.nodes.filter(n => n.type === 'material').sort((a,b) => b.ts - a.ts);
  const sections = new Map(DATA.sections.map(s => [s.id, s]));
  const normalize = s => (s || '').toLowerCase().replace(/ё/g, 'е');
  const scroll = new Map();
  const inputState = new Map();
  function rememberInput() {
    const el = root.querySelector("#catalog-search");
    if (el) inputState.set(current,{value:el.value,start:el.selectionStart,end:el.selectionEnd});
  }
  let current = location.hash, graphHash = '#view=graph', catalogHash = '#view=catalog', ticket = 0;
  let view, timer;
  const recent = materials.filter(n => Number(n.ts) > 0);
  const icon = `<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg>`;
  const rail = active => `<aside class="library-sidebar" aria-label="Навигация библиотеки"><nav>${[['home','Главная'],['catalog','Все материалы'],['recent','Недавние публикации'],['graph','Граф связей']].map(([v,label])=>`<a data-route href="${v==='graph'?graphHash:'#view='+v}" ${active===v?'aria-current="page"':''}>${label}</a>`).join('')}</nav><details class="library-sections" ${matchMedia("(min-width: 761px)").matches?"open":""}><summary>Разделы</summary>${DATA.sections.map(s=>`<a data-route href="${href({view:'catalog',category:s.id})}"><span>${esc(s.name)}</span><small>${s.count}</small></a>`).join('')}</details></aside>`;
  const shell = (active, body) => `${rail(active)}<main class="library-main">${body}</main>`;
  const search = query => `<div class="library-search">${icon}<label class="sr" for="catalog-search">Поиск по материалам</label><input id="catalog-search" type="search" maxlength="300" placeholder="Найти материал или тему" value="${esc(query)}" autocomplete="off"></div>`;
  const params = () => new URLSearchParams(location.hash.slice(1));
  const href = (values) => '#' + new URLSearchParams(values).toString();
  const articleLink = n => `<a class="material-card" data-route href="${href({view:'article',id:n.id})}"><span class="material-dot"></span><span><strong>${esc(n.label)}</strong><small>${esc(n.sub || sections.get(n.sec)?.name)}${n.date ? ' · '+esc(n.date) : ''}</small></span></a>`;
  function go(hash, replace = false) {
    rememberInput();
    scroll.set(current, window.scrollY);
    if (view === 'graph') graphHash = location.hash || '#view=graph';
    if (view === 'catalog') catalogHash = location.hash || '#view=catalog';
    history[replace ? 'replaceState' : 'pushState']({wiki:true,from:replace?history.state?.from:(location.hash || '#view=home')}, '', hash);
    route();
  }
  function restoreScroll() { requestAnimationFrame(() => window.scrollTo(0, scroll.get(location.hash) || 0)); }
  function route() {
    clearTimeout(timer); ++ticket;
    const p = params();
    view = p.get('view') || (location.pathname === '/wiki' ? 'home' : 'graph');
    if (!['home','recent','catalog','article','graph'].includes(view)) view = 'home';
    current = location.hash;
    root.hidden = view === 'graph'; workspace.hidden = view !== 'graph';
    document.body.classList.toggle('library-open', view !== 'graph');
    document.querySelector('#nav-catalog').setAttribute('aria-pressed', String(view === 'catalog' || view === 'article'));
    document.querySelector('#nav-home').setAttribute('aria-pressed', String(view === 'home'));
    document.querySelector('#nav-recent').setAttribute('aria-pressed', String(view === 'recent'));
    document.querySelector('#nav-graph').setAttribute('aria-pressed', String(view === 'graph'));
    if (view === 'graph') { onGraph(p, graphHash === location.hash); graphHash = location.hash; }
    else if (view === 'article') renderArticle(p.get('id'));
    else { if(view==='catalog') catalogHash = location.hash || '#view=catalog'; renderCatalog(p); }
    restoreScroll();
  }
  function renderCatalog(p, { resultsOnly = false } = {}) {
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
    const currentView = view === 'recent' ? 'recent' : view === 'home' ? 'home' : 'catalog';
    const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
    const found = (currentView === 'recent' ? recent : materials).filter(n => (!category || n.sec === category) && terms.every(t => normalize(n.label+' '+n.sub).includes(t)));
    if (!resultsOnly) {
      const home = currentView === 'home';
      const title = home ? 'Библиотека школы' : currentView === 'recent' ? 'Недавние публикации' : category ? sections.get(category).name : 'Все материалы';
      root.innerHTML = shell(currentView, `<div class="library-heading ${home?'home-heading':''}"><h1>${esc(title)}</h1><p class="library-intro">${home?'Материалы для практики и изучения. Найдите знакомую тему или откройте что-то новое.':currentView==='recent'?'Последние записи по дате публикации в источнике.':'Записи занятий и материалы по разделам.'}</p>${search(query)}</div>
        ${!home?`<div class="catalog-filters" aria-label="Разделы">${[{id:'',name:'Все',count:materials.length},...DATA.sections].map(s => `<button data-category="${esc(s.id)}" aria-pressed="${category===s.id}">${esc(s.name)}</button>`).join('')}</div>`:''}<div id="catalog-content"></div>`);
    }
    const content = root.querySelector('#catalog-content');
    if (!found.length) content.innerHTML = `<div class="library-empty"><h2>Ничего не найдено</h2><p class="muted">Попробуйте другое слово или откройте все материалы.</p><button class="btn" data-reset>Сбросить поиск</button></div>`;
    else if (currentView === 'home' && !query) content.innerHTML = `<section class="home-recent"><div class="section-heading"><h2>Недавние публикации</h2><a data-route href="#view=recent">Посмотреть все →</a></div><p class="muted small">По дате публикации в источнике</p><div class="material-grid">${recent.slice(0,5).map(articleLink).join('')}</div></section><section class="home-sections"><div class="section-heading"><h2>Разделы библиотеки</h2><a data-route href="#view=catalog">Все материалы →</a></div><div class="section-list">${DATA.sections.map(s=>`<a data-route href="${href({view:'catalog',category:s.id})}"><strong>${esc(s.name)}</strong><span>${s.count} материалов</span></a>`).join('')}</div></section>`;
    else content.innerHTML = `<p class="muted result-count" role="status">${query?'Найдено: ':''}${found.length} ${query?'':'материалов'}</p><div class="material-grid">${found.slice(0,page*36).map(articleLink).join('')}</div>${found.length>page*36 ? '<button class="btn load-more" data-more>Показать ещё</button>' : ''}`;
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
          if (!['home','catalog','recent'].includes(view)) return;
          const next = params();
          next.set('view', currentView);
          next.delete('page');
          input.value ? next.set('q', input.value) : next.delete('q');
          scroll.set(current, window.scrollY);
          history.replaceState({...history.state,wiki:true}, '', '#' + next.toString());
          current = location.hash; if(currentView==='catalog') catalogHash = current;
          renderCatalog(next, {resultsOnly:true});
        }, 220);
      };
      input.addEventListener('input', updateSearch);
      input.addEventListener('compositionstart', () => { composing = true; clearTimeout(timer); });
      input.addEventListener('compositionend', () => { composing = false; updateSearch(); });
    }
    // These controls stay mounted; their handlers use the latest query parameters.
    root.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=> {
      const next = params(); next.set('view',currentView==='recent'?'recent':'catalog'); next.delete('page');
      b.dataset.category ? next.set('category',b.dataset.category) : next.delete('category');
      go('#'+next.toString());
    });
    root.querySelector('[data-reset]')?.addEventListener('click',()=>go('#view='+currentView));
    root.querySelector('[data-more]')?.addEventListener('click',()=>{ const y=window.scrollY; filters({page:page+1},true); scroll.set(current,y); restoreScroll(); });
  }
  async function renderArticle(id) {
    const n = nodes.get(id), request = ticket;
    const back = `<button class="link-inline library-back" data-back>← Назад</button>`;
    if (!n || n.type !== 'material') { root.innerHTML=shell('catalog',back+'<h1>Материал не найден</h1><a href="#view=catalog" data-route>Вернуться в каталог</a>'); return; }
    const categoryHref=href({view:'catalog',category:n.sec});
    root.innerHTML = shell('article', `${back}<nav class="breadcrumbs" aria-label="Путь"><a href="#view=catalog" data-route>Каталог</a><span>/</span><a href="${categoryHref}" data-route>${esc(sections.get(n.sec)?.name)}</a></nav>
      <div class="reader-layout"><aside class="reader-toc"><strong>Содержание</strong><button data-anchor="article-about">О материале</button><button data-anchor="article-sources">Источники</button><button data-anchor="article-connections">Связи</button></aside>
      <article><h1 tabindex="-1">${esc(n.label)}</h1><p class="muted">${esc(n.date)}${n.sub?' · '+esc(n.sub):''}</p>
      <section id="article-about"><h2>О материале</h2><div id="article-detail" role="status">Загружаем описание…</div></section>
      <section id="article-sources"><h2>Источники</h2><div id="article-links"></div></section>
      <section id="article-connections"><h2>Связи</h2><div id="article-related"></div><div class="reader-actions"><a class="btn" data-route href="${href({view:'graph',sel:id,mode:'local',depth:'1'})}">Локальный граф</a><a class="open" data-route href="${href({view:'graph',sel:id})}">В общем графе →</a></div><p class="muted small">Связи из структуры каталога и соседних номеров серии. Смысловые ссылки появятся после редакторской проверки.</p></section></article></div>`);
    const related = DATA.edges.filter(e=>e.s===id || e.t===id).map(e=>({node:nodes.get(e.s===id?e.t:e.s),kind:e.k}));
    root.querySelector('#article-related').innerHTML = related.length ? `<div class="material-grid related-grid">${related.map(({node:m,kind})=>m.type==='material'?articleLink(m):`<a class="material-card" data-route href="${href({view:'graph',sel:m.id,mode:'local'})}"><span><strong>${esc(m.label)}</strong><small>${m.type==='section'?'Раздел':'Подтема'} · структура каталога</small></span></a>`).join('')}</div>` : '<p class="muted">У этой записи пока нет связей.</p>';
    let userMoved = false, initialY = window.scrollY;
    const movement = new AbortController();
    const noteMovement = () => { userMoved = true; };
    for (const event of ['wheel','touchstart','keydown','click']) document.addEventListener(event,noteMovement,{signal:movement.signal,passive:true});
    requestAnimationFrame(()=>requestAnimationFrame(()=> { initialY = window.scrollY; }));
    try {
      const d=await api('/api/wiki/materials/'+encodeURIComponent(id));
      if (request!==ticket) return;
      root.querySelector('#article-detail').innerHTML=d.annotation ? renderAnnotation(d.annotation, esc) : `<p class="source-description">${esc(d.description && d.description!==d.title ? d.description : 'В исходном каталоге отдельного описания нет.')}</p>`;
      const links=(d.links||[]).filter(l=>l.type!=='zoom' && /^https?:\/\//i.test(l.url));
      root.querySelector('#article-links').innerHTML=links.length?`<ul class="source-links">${links.map(l=>`<li><a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label||l.type)} ↗</a></li>`).join('')}</ul>`:'<p class="muted">Для этой записи нет ссылки на материал.</p>';
      if (!userMoved && window.scrollY === initialY) restoreScroll();
    } catch(e) {
      if(request!==ticket) return;
      if(e.auth) return showLogin('Доступ закончился или был отозван. Введите новый код.');
      root.querySelector('#article-detail').innerHTML='<p class="muted">Описание не загрузилось. Проверьте интернет.</p><button class="btn" data-retry>Повторить</button>';
      root.querySelector('[data-retry]').onclick=()=>renderArticle(id);
    } finally { movement.abort(); }
  }
  document.querySelector('#nav-home').onclick=()=>go('#view=home');
  document.querySelector('#nav-recent').onclick=()=>go('#view=recent');
  document.querySelector('#nav-catalog').onclick=()=>go(catalogHash);
  document.querySelector('#nav-graph').onclick=()=>go(graphHash);
  document.addEventListener('click',e=>{
    const a=e.target.closest('a[data-route],a[data-article]');
    if(a && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button===0) { e.preventDefault(); go(a.getAttribute('href')); }
    const back=e.target.closest('[data-back]');
    if(back) { if(history.state?.from) history.back(); else go('#view=catalog'); }
    const anchor=e.target.closest('[data-anchor]');
    if(anchor) document.getElementById(anchor.dataset.anchor)?.scrollIntoView({behavior:'smooth',block:'start'});
  });
  window.addEventListener('wiki-graph-navigation',()=>{ graphHash=location.hash; current=location.hash; });
  window.addEventListener('popstate',()=>{ rememberInput(); scroll.set(current,window.scrollY); route(); });
  window.addEventListener('hashchange',()=>{ if(current!==location.hash) route(); });
  route();
}
