import Graph from "graphology";
import Sigma from "sigma";
import { forceSimulation, forceLink, forceManyBody, forceX, forceY, forceCollide } from "d3-force";

const $ = (s) => document.querySelector(s);
const norm = (s) => (s || "").toLowerCase().replace(/ё/g, "е");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const TOKEN_KEY = "daychee-web-token";
const store = {
  get() { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set(v) { try { v ? localStorage.setItem(TOKEN_KEY, v) : localStorage.removeItem(TOKEN_KEY); } catch { /* приватный режим */ } },
};
let token = store.get();

// CSP запрещает style="" в разметке: цвета выставляем через CSSOM после вставки
function paint(root) { root.querySelectorAll("[data-color]").forEach((el) => { el.style.background = el.dataset.color; }); }

// ---- Вход по коду приглашения (тот же доступ, что в приложении) ----
const REJECT = { used: "Этот код уже использован. Попросите новое приглашение.", expired: "Срок приглашения истёк. Попросите новое.",
  revoked: "Приглашение отозвано.", invalid: "Код не подошёл. Проверьте 12 букв и цифр." };
function showView(name) {
  ["login", "loading", "error", "app"].forEach((v) => { $("#view-" + v).hidden = v !== name; });
  $("#logout").hidden = !token;
}
function showLogin(message) {
  showView("login");
  $("#login-error").textContent = message || "";
  $("#code").focus();
}
$("#login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const raw = $("#code").value.trim();
  const code = raw.includes("#") ? raw.slice(raw.lastIndexOf("#") + 1) : raw;
  const button = $("#login button");
  button.disabled = true; $("#login-error").textContent = "";
  try {
    const r = await fetch("/api/access/redeem-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    const body = await r.json().catch(() => ({}));
    if (r.ok) { token = body.token; store.set(token); boot(); return; }
    $("#login-error").textContent = r.status === 429 ? "Слишком много попыток. Повторите через 10 минут."
      : r.status === 422 ? "Проверьте код приглашения: 12 букв и цифр." : REJECT[body.detail?.code] || REJECT.invalid;
  } catch { $("#login-error").textContent = "Нет связи с сервером. Проверьте интернет."; }
  finally { button.disabled = false; }
});
$("#logout").addEventListener("click", async () => {
  try { await fetch("/api/access/logout", { method: "POST", headers: { Authorization: "Bearer " + token } }); } catch { /* выходим локально */ }
  token = null; store.set(null); location.hash = ""; location.reload();
});
$("#retry").addEventListener("click", () => boot());

async function api(path) {
  const r = await fetch(path, { headers: { Authorization: "Bearer " + token } });
  if (r.status === 401) { token = null; store.set(null); throw Object.assign(new Error("auth"), { auth: true }); }
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

async function boot() {
  if (!token) return showLogin();
  showView("loading");
  try { start(await api("/api/wiki/graph")); }
  catch (e) { e.auth ? showLogin("Доступ закончился или был отозван. Введите новый код.") : showView("error"); }
}

// ---- Граф ----
let started = false;
function start(DATA) {
  showView("app");
  if (started) return;
  started = true;

  const SEC_COLORS = ["#c67139", "#7a8a5e", "#b5895a", "#8c6f9e", "#5f8a8b", "#c2a14a", "#a25a5a",
    "#6b7fa8", "#9a6b4f", "#4f7a5a", "#b97a95", "#7d7466", "#d08f6a"];
  const SEC = Object.fromEntries(DATA.sections.map((s, i) => [s.id, { ...s, color: SEC_COLORS[i % SEC_COLORS.length] }]));
  const C = { dim: "#e2d8c8", dimEdge: "#ece3d4", text: "#201e1d", other: "#82796a", structure: "#cbbfab", series: "#8fa073" };
  const TYPE_LABEL = { section: "Раздел", subtopic: "Подтема", material: "Материал" };
  const EDGE_LABEL = { structure: "структура", series: "серия" };
  const narrow = matchMedia("(max-width: 760px)").matches;

  const byId = new Map(DATA.nodes.map((n) => [n.id, n]));
  const adj = new Map(DATA.nodes.map((n) => [n.id, []]));
  DATA.edges.forEach((e) => { adj.get(e.s).push([e.t, e.k]); adj.get(e.t).push([e.s, e.k]); });
  const colorOf = (n) => (n.sec && SEC[n.sec] ? SEC[n.sec].color : C.other);
  const sizeOf = (n) => n.type === "section" ? 13 : n.type === "subtopic" ? 3 + Math.sqrt(n.count || 1) * 0.9 : 3;

  // Состояние живёт в адресе, как в таблице переходов дизайна
  const state = { structure: true, series: true, orphans: true, sections: new Set(DATA.sections.map((s) => s.id)),
    mode: "global", depth: 1, selected: null, hovered: null };
  const p = new URLSearchParams(location.hash.slice(1));
  ["structure", "series", "orphans"].forEach((k) => { if (p.has(k)) state[k] = p.get(k) === "1"; });
  if (p.get("sec")) state.sections = new Set(p.get("sec").split(",").filter((s) => SEC[s]));
  if (p.get("sel") && byId.has(p.get("sel"))) state.selected = p.get("sel");
  if (p.get("mode") === "local" && state.selected) state.mode = "local";
  state.depth = p.get("depth") === "2" ? 2 : 1;
  function writeHash() {
    const q = new URLSearchParams();
    ["structure", "series", "orphans"].forEach((k) => q.set(k, state[k] ? "1" : "0"));
    if (state.sections.size !== DATA.sections.length) q.set("sec", [...state.sections].join(","));
    if (state.selected) q.set("sel", state.selected);
    if (state.mode === "local") { q.set("mode", "local"); q.set("depth", state.depth); }
    history.replaceState(null, "", "#" + q.toString());
  }

  const edgeOn = (k) => state[k];
  function visibleSet() {
    if (state.mode === "local" && state.selected) {
      const seen = new Map([[state.selected, 0]]), queue = [state.selected];
      while (queue.length) {
        const id = queue.shift(), d = seen.get(id);
        if (d >= state.depth) continue;
        for (const [nb, k] of adj.get(id)) if (edgeOn(k) && !seen.has(nb)) { seen.set(nb, d + 1); queue.push(nb); }
      }
      const all = [...seen.keys()];
      return { ids: all.slice(0, 60), total: all.length };
    }
    const ids = DATA.nodes.filter((n) => (!n.sec || state.sections.has(n.sec))
      && (state.structure || n.type === "material")).map((n) => n.id);
    const idSet = new Set(ids), connected = new Set();
    DATA.edges.forEach((e) => { if (edgeOn(e.k) && idSet.has(e.s) && idSet.has(e.t)) { connected.add(e.s); connected.add(e.t); } });
    const out = state.orphans ? ids : ids.filter((id) => connected.has(id));
    return { ids: out, total: out.length };
  }

  const graph = new Graph({ type: "undirected", multi: true });
  const pos = new Map(); // раскладка общего графа сохраняется между перестроениями
  const secIndex = Object.fromEntries(DATA.sections.map((s, i) => [s.id, i]));
  function seed(n) {
    const i = n.sec ? secIndex[n.sec] : 0, a = (i / DATA.sections.length) * Math.PI * 2;
    const r = n.type === "section" ? 380 : 420 + Math.random() * 160;
    return { x: Math.cos(a) * r + (Math.random() - 0.5) * 120, y: Math.sin(a) * r + (Math.random() - 0.5) * 120 };
  }

  let sim = null, simNodes = [], dragged = null, dragMoved = false, visibleInfo = { ids: [], total: 0 }, matches = null;
  function rebuild({ refit = true } = {}) {
    if (sim) sim.stop();
    visibleInfo = visibleSet();
    const ids = new Set(visibleInfo.ids), local = state.mode === "local";
    graph.clear();
    simNodes = [];
    const origin = state.selected && pos.get(state.selected);
    for (const id of ids) {
      const n = byId.get(id), g = pos.get(id) || seed(n);
      const at = local && origin ? { x: (g.x - origin.x) * 0.3, y: (g.y - origin.y) * 0.3 } : g;
      simNodes.push({ id, x: at.x, y: at.y });
      graph.addNode(id, { x: at.x, y: at.y, size: sizeOf(n), color: colorOf(n), label: n.label,
        forceLabel: n.type === "section" && !narrow, zIndex: n.type === "material" ? 0 : 1 });
    }
    const links = [];
    for (const e of DATA.edges) {
      if (!edgeOn(e.k) || !ids.has(e.s) || !ids.has(e.t)) continue;
      graph.addEdge(e.s, e.t, { kind: e.k, color: C[e.k], size: e.k === "structure" ? 0.5 : 1.2 });
      links.push({ source: e.s, target: e.t, k: e.k });
    }
    sim = forceSimulation(simNodes)
      .force("link", forceLink(links).id((d) => d.id)
        .distance((l) => l.k === "structure" ? (byId.get(l.source.id ?? l.source).type === "subtopic" ? 70 : 22) : 14)
        .strength((l) => l.k === "structure" ? 0.5 : 0.9))
      .force("charge", forceManyBody().strength(local ? -220 : -26).theta(0.9).distanceMax(local ? 600 : 260))
      .force("x", forceX(0).strength(local ? 0.08 : 0.035))
      .force("y", forceY(0).strength(local ? 0.08 : 0.035))
      .force("collide", forceCollide((d) => sizeOf(byId.get(d.id)) + 1.5).iterations(1))
      .alphaDecay(0.025)
      .on("tick", syncPositions)
      .on("end", () => { if (refit && !dragged) fitCamera(); });
    const fresh = simNodes.filter((sn) => !pos.has(sn.id)).length;
    if (fresh > 50 || local) { sim.stop(); sim.tick(140); sim.alpha(0.35).restart(); } // «прогрев» без мельтешения
    else sim.alpha(0.4).restart();
    syncPositions();
    if (refit) { fitCamera(); setTimeout(() => sim.alpha() > 0.05 && fitCamera(), 900); }
    renderCounter();
    writeHash();
  }
  function syncPositions() {
    if (state.mode !== "local") for (const sn of simNodes) pos.set(sn.id, { x: sn.x, y: sn.y });
    const cur = new Map(simNodes.map((sn) => [sn.id, sn]));
    graph.updateEachNodeAttributes((id, a) => { const q = cur.get(id); a.x = q.x; a.y = q.y; return a; }, { attributes: ["x", "y"] });
  }

  const container = $("#graph");
  const renderer = new Sigma(graph, container, {
    labelFont: "Figtree, system-ui, sans-serif", labelSize: 13, labelWeight: "600", labelColor: { color: C.text },
    labelRenderedSizeThreshold: narrow ? 10 : 7, labelDensity: narrow ? 0.35 : 0.6, labelGridCellSize: narrow ? 140 : 110,
    defaultEdgeType: "line", zIndex: true, minCameraRatio: 0.05, maxCameraRatio: 6, nodeReducer, edgeReducer,
  });
  function fitCamera() {
    // фиксированная рамка вместо авто-масштаба: иначе живая физика «раскачивает» камеру
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    graph.forEachNode((_, a) => { x0 = Math.min(x0, a.x); x1 = Math.max(x1, a.x); y0 = Math.min(y0, a.y); y1 = Math.max(y1, a.y); });
    if (!isFinite(x0)) return;
    const pad = Math.max(x1 - x0, y1 - y0, 200) * 0.08;
    renderer.setCustomBBox({ x: [x0 - pad, x1 + pad * 3.5], y: [y0 - pad, y1 + pad] }); // справа место под подписи
    renderer.getCamera().animatedReset({ duration: 400 });
  }

  // Наведение или выбор приглушает всё, кроме соседей — как в Obsidian
  function focusSet() {
    const f = state.hovered || state.selected;
    return f && graph.hasNode(f) ? new Set([f, ...graph.neighbors(f)]) : null;
  }
  function nodeReducer(id, a) {
    const res = { ...a }, focus = focusSet();
    if (focus && !focus.has(id)) { res.color = C.dim; res.label = null; res.zIndex = -1; }
    else if (focus) { res.forceLabel = true; res.zIndex = 2; }
    if (matches && !focus) {
      if (matches.has(id)) { res.forceLabel = true; res.highlighted = true; res.zIndex = 2; }
      else { res.color = C.dim; res.label = null; }
    }
    if (id === state.selected) { res.highlighted = true; res.size = a.size * 1.5; }
    return res;
  }
  function edgeReducer(id, a) {
    const res = { ...a }, f = state.hovered || state.selected;
    if (f && graph.hasNode(f)) {
      const [s, t] = graph.extremities(id);
      if (s !== f && t !== f) res.hidden = true; else res.size = a.size + 1;
    } else if (matches) res.color = C.dimEdge;
    return res;
  }

  renderer.on("enterNode", ({ node }) => { state.hovered = node; container.classList.add("pointer"); renderer.refresh({ skipIndexation: true }); });
  renderer.on("leaveNode", () => { state.hovered = null; container.classList.remove("pointer"); renderer.refresh({ skipIndexation: true }); });
  renderer.on("clickNode", ({ node }) => { if (!dragMoved) select(node === state.selected ? null : node); });
  renderer.on("clickStage", () => { if (!dragMoved) select(null); });
  renderer.on("downNode", ({ node }) => {
    dragged = simNodes.find((s) => s.id === node); dragMoved = false;
    if (dragged) { dragged.fx = dragged.x; dragged.fy = dragged.y; sim.alphaTarget(0.25).restart(); }
  });
  renderer.getMouseCaptor().on("mousemovebody", (e) => {
    if (!dragged) return;
    const q = renderer.viewportToGraph(e);
    dragged.fx = q.x; dragged.fy = q.y; dragMoved = true;
    e.preventSigmaDefault(); e.original.preventDefault(); e.original.stopPropagation();
  });
  const release = () => { if (!dragged) return; dragged.fx = null; dragged.fy = null; dragged = null; sim.alphaTarget(0); };
  renderer.getMouseCaptor().on("mouseup", release);

  function select(id) {
    state.selected = id;
    if (!id && state.mode === "local") { state.mode = "global"; rebuild(); }
    renderPanel(); renderer.refresh({ skipIndexation: true }); writeHash(); renderModes();
    if (id && graph.hasNode(id)) {
      const d = renderer.getNodeDisplayData(id);
      renderer.getCamera().animate({ x: d.x, y: d.y, ratio: Math.min(renderer.getCamera().ratio, 0.6) }, { duration: 450 });
    }
  }
  function reveal(id) { if (!graph.hasNode(id)) { state.selected = id; rebuild(); } select(id); }

  // ---- Панель узла ----
  let detailRequest = 0;
  function renderPanel() {
    const el = $("#panel"), n = state.selected && byId.get(state.selected);
    if (!n) {
      el.innerHTML = `<p class="hint-title">Выберите узел</p>
        <p class="muted">Наведение подсвечивает соседей. Узлы можно перетаскивать — граф «оживёт». Подписи материалов появляются при приближении.</p>
        <dl class="legend">
          <dt><i class="dot big" data-color="#8c491a"></i></dt><dd>Раздел или подтема — цвет раздела</dd>
          <dt><i class="dot" data-color="#c67139"></i></dt><dd>Материал</dd>
          <dt><i class="line" data-color="${C.structure}"></i></dt><dd>Структура каталога</dd>
          <dt><i class="line" data-color="${C.series}"></i></dt><dd>Серия: соседние номера в названии</dd>
        </dl>`;
      paint(el);
      return;
    }
    const nbs = adj.get(n.id).filter(([, k]) => edgeOn(k)).map(([id, k]) => ({ n: byId.get(id), k }));
    const sec = n.sec && SEC[n.sec];
    el.innerHTML = `
      <div class="tags"><span class="tag"><i class="dot" data-color="${colorOf(n)}"></i>${TYPE_LABEL[n.type]}</span>
        ${sec && n.type !== "section" ? `<span class="tag soft">${esc(sec.name)}</span>` : ""}
        ${n.type === "material" && n.sub ? `<span class="tag soft">${esc(n.sub)}</span>` : ""}</div>
      <h2>${esc(n.label)}</h2>
      ${n.date ? `<p class="muted">${esc(n.date)}</p>` : ""}
      ${n.count ? `<p class="muted">${n.count} материалов в каталоге</p>` : ""}
      <div id="detail"></div>
      <div class="row"><button class="btn" id="to-local">${state.mode === "local" ? "К общему графу" : "Локальный граф"}</button></div>
      <p class="muted small">Связи: ${nbs.length}</p>
      <div class="nbs">${nbs.slice(0, 40).map(({ n: m, k }) =>
        `<button class="chip" data-id="${esc(m.id)}" title="${EDGE_LABEL[k]}"><i class="dot" data-color="${colorOf(m)}"></i>${esc(m.label.length > 42 ? m.label.slice(0, 41) + "…" : m.label)}</button>`).join("")}
        ${nbs.length > 40 ? `<span class="muted small">… и ещё ${nbs.length - 40}</span>` : ""}</div>`;
    paint(el);
    el.querySelectorAll(".chip").forEach((b) => b.addEventListener("click", () => reveal(b.dataset.id)));
    $("#to-local").addEventListener("click", () => { state.mode = state.mode === "local" ? "global" : "local"; rebuild(); renderPanel(); renderModes(); });
    if (n.type === "material") loadDetail(n.id);
  }
  async function loadDetail(id) {
    const ticket = ++detailRequest, box = $("#detail");
    box.innerHTML = `<p class="muted small">Загружаем описание…</p>`;
    try {
      const d = await api("/api/wiki/materials/" + encodeURIComponent(id));
      if (ticket !== detailRequest) return;
      const text = d.description && d.description !== d.title ? d.description : "";
      const links = (d.links || []).filter((l) => l.type !== "zoom");
      box.innerHTML = (text ? `<p class="desc">${esc(text.length > 700 ? text.slice(0, 699) + "…" : text)}</p>` : "")
        + links.map((l) => `<a class="open" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">Открыть: ${esc(l.label || l.type)}</a>`).join("");
    } catch (e) {
      if (ticket !== detailRequest) return;
      if (e.auth) return showLogin("Доступ закончился или был отозван. Введите новый код.");
      box.innerHTML = `<p class="muted small">Описание не загрузилось.</p>`;
    }
  }

  // ---- Панель управления ----
  function renderCounter() {
    const extra = state.mode === "local" && visibleInfo.total > graph.order ? ` — ближайшие ${graph.order} из ${visibleInfo.total}` : "";
    $("#counter").textContent = `Показано ${graph.order} из ${DATA.nodes.length} узлов · ${graph.size} связей${extra}`;
  }
  function renderModes() {
    document.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === state.mode)));
    $("#depth").hidden = state.mode !== "local";
    document.querySelectorAll("[data-depth]").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.depth === state.depth)));
    $('[data-mode="local"]').disabled = !state.selected;
  }
  ["structure", "series", "orphans"].forEach((k) => {
    const cb = $(`#t-${k}`); cb.checked = state[k];
    cb.addEventListener("change", () => { state[k] = cb.checked; rebuild({ refit: k !== "series" }); renderPanel(); });
  });
  const secs = $("#sections");
  function renderSections() {
    secs.innerHTML = DATA.sections.map((s) => `<button class="sec" data-sec="${esc(s.id)}" aria-pressed="${state.sections.has(s.id)}">
      <i class="dot" data-color="${SEC[s.id].color}"></i>${esc(s.name)} <span>${s.count}</span></button>`).join("")
      + `<button class="sec all" id="sec-all">Все</button>`;
    paint(secs);
    secs.querySelectorAll("[data-sec]").forEach((b) => b.addEventListener("click", (ev) => {
      const id = b.dataset.sec;
      if (ev.altKey || ev.metaKey) state.sections = new Set([id]);
      else if (state.sections.has(id)) state.sections.delete(id); else state.sections.add(id);
      secs.querySelectorAll("[data-sec]").forEach((x) => x.setAttribute("aria-pressed", String(state.sections.has(x.dataset.sec))));
      rebuild();
    }));
    $("#sec-all").addEventListener("click", () => { state.sections = new Set(DATA.sections.map((s) => s.id)); renderSections(); rebuild(); });
  }
  renderSections();
  document.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => { state.mode = b.dataset.mode; rebuild(); renderPanel(); renderModes(); }));
  document.querySelectorAll("[data-depth]").forEach((b) => b.addEventListener("click", () => { state.depth = +b.dataset.depth; rebuild(); renderModes(); }));

  const q = $("#q"), list = $("#results");
  const rank = { section: 0, material: 1, subtopic: 2 };
  function search() {
    const s = norm(q.value.trim());
    if (s.length < 2) { matches = null; list.innerHTML = ""; renderer.refresh({ skipIndexation: true }); return; }
    const found = DATA.nodes.filter((n) => norm(n.label).includes(s)).sort((a, b) => rank[a.type] - rank[b.type] || (b.ts || 0) - (a.ts || 0));
    matches = new Set(found.map((n) => n.id));
    list.innerHTML = found.slice(0, 8).map((n) => `<li><button data-id="${esc(n.id)}"><i class="dot" data-color="${colorOf(n)}"></i><span>${esc(n.label)}</span><small>${TYPE_LABEL[n.type]}${n.sec && n.type !== "section" ? " · " + esc(SEC[n.sec].name) : ""}</small></button></li>`).join("")
      + (found.length > 8 ? `<li class="muted small">Найдено ${found.length}, показаны первые 8 — остальные подсвечены на графе</li>` : "")
      + (!found.length ? `<li class="muted small">Ничего не найдено</li>` : "");
    paint(list);
    list.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { list.innerHTML = ""; matches = null; reveal(b.dataset.id); }));
    renderer.refresh({ skipIndexation: true });
  }
  q.addEventListener("input", search);
  q.addEventListener("keydown", (e) => {
    if (e.key === "Enter") list.querySelector("button")?.click();
    if (e.key === "Escape") { q.value = ""; search(); }
  });

  const cam = renderer.getCamera();
  $("#zin").addEventListener("click", () => cam.animatedZoom({ duration: 250 }));
  $("#zout").addEventListener("click", () => cam.animatedUnzoom({ duration: 250 }));
  $("#zfit").addEventListener("click", () => fitCamera());
  container.tabIndex = 0;
  container.addEventListener("keydown", (e) => {
    if (e.key === "+" || e.key === "=") cam.animatedZoom({ duration: 200 });
    else if (e.key === "-") cam.animatedUnzoom({ duration: 200 });
    else if (e.key === "0") fitCamera();
    else if (e.key === "Escape") select(null);
  });

  rebuild();
  renderPanel();
  renderModes();
}

boot();
