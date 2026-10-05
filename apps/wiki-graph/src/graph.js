import { mountLibrary } from "./library.js";
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
  $("#wiki-nav").hidden = name !== "app";
  document.body.classList.toggle("in-app", name === "app");
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
    if (r.ok) { token = body.token; store.set(token); $("#code").value = ""; boot(); return; }
    $("#login-error").textContent = r.status === 429 ? "Слишком много попыток. Повторите через 10 минут."
      : r.status === 422 ? "Проверьте код приглашения: 12 букв и цифр." : REJECT[body.detail?.code] || REJECT.invalid;
  } catch { $("#login-error").textContent = "Нет связи с сервером. Проверьте интернет."; }
  finally { button.disabled = false; }
});
$("#logout").addEventListener("click", async () => {
  try { await fetch("/api/access/logout", { method: "POST", headers: { Authorization: "Bearer " + token } }); } catch { /* выходим локально */ }
  token = null; store.set(null); location.replace(location.pathname);
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
  const C = { dim: "#e2d8c8", dimEdge: "#ece3d4", text: "#201e1d", other: "#82796a", structure: "#cbbfab", series: "#8fa073", semantic: "#c67139" };
  const TYPE_LABEL = { section: "Раздел", subtopic: "Подтема", material: "Материал", term: "Термин", topic: "Тема" };
  const EDGE_LABEL = { structure: "структура", series: "серия", semantic: "смысловая связь по цитате" };
  const ALL_SECTIONS = DATA.sections.map((s) => s.id);
  const narrowQuery = matchMedia("(max-width: 900px)");
  const touch = matchMedia("(hover: none)").matches; // на тач-экранах «наведения» нет — только выбор

  const byId = new Map(DATA.nodes.map((n) => [n.id, n]));
  const adj = new Map(DATA.nodes.map((n) => [n.id, []]));
  DATA.edges.forEach((e) => { adj.get(e.s).push([e.t, e.k]); adj.get(e.t).push([e.s, e.k]); });
  const colorOf = (n) => (n.sec && SEC[n.sec] ? SEC[n.sec].color : C.other);
  const semanticNode = n => n.type === "term" || n.type === "topic";
  const sizeOf = (n) => n.type === "section" ? 13 : n.type === "subtopic" ? 3 + Math.sqrt(n.count || 1) * 0.9 : 3;

  // ---- Состояние в адресе. Выбор и режим — новые записи истории (Back возвращает), фильтры — замена ----
  const state = { structure: true, series: true, semantic: true, orphans: true, sections: new Set(ALL_SECTIONS),
    mode: "global", depth: 1, selected: null, hovered: null };
  function readHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    ["structure", "series", "semantic", "orphans"].forEach((k) => { state[k] = p.has(k) ? p.get(k) === "1" : true; });
    const secs = p.get("sec") ? p.get("sec").split(",").filter((s) => SEC[s]) : [];
    state.sections = new Set(secs.length ? secs : ALL_SECTIONS);
    state.selected = p.get("sel") && byId.has(p.get("sel")) ? p.get("sel") : null;
    state.mode = p.get("mode") === "local" && state.selected ? "local" : "global";
    state.depth = p.get("depth") === "2" ? 2 : 1;
  }
  function hashNow() {
    const q = new URLSearchParams();
    if (location.pathname === "/wiki") q.set("view", "graph");
    ["structure", "series", "semantic", "orphans"].forEach((k) => { if (!state[k]) q.set(k, "0"); });
    if (state.sections.size !== ALL_SECTIONS.length) q.set("sec", [...state.sections].join(","));
    if (state.selected) q.set("sel", state.selected);
    if (state.mode === "local") { q.set("mode", "local"); q.set("depth", state.depth); }
    const s = q.toString();
    return s ? "#" + s : location.pathname;
  }
  function writeHash(push = false) {
    const next = hashNow();
    if (next === (location.hash || location.pathname)) return;
    push ? history.pushState(null, "", next) : history.replaceState(null, "", next);
    window.dispatchEvent(new Event("wiki-graph-navigation"));
  }

  const edgeOn = (k) => state[k];
  function visibleSet() {
    if (state.mode === "local" && state.selected) {
      if (semanticNode(byId.get(state.selected)) && !state.semantic) return { ids: [], total: 0 };
      const seen = new Map([[state.selected, 0]]), queue = [state.selected];
      while (queue.length) {
        const id = queue.shift(), d = seen.get(id);
        if (d >= state.depth) continue;
        for (const [nb, k] of adj.get(id)) if (edgeOn(k) && !seen.has(nb)) { seen.set(nb, d + 1); queue.push(nb); }
      }
      const all = [...seen.keys()];
      return { ids: all.slice(0, 60), total: all.length };
    }
    const ids = DATA.nodes.filter((n) => semanticNode(n)
      ? state.semantic && adj.get(n.id).some(([id])=>state.sections.has(byId.get(id).sec))
      : (!n.sec || state.sections.has(n.sec)) && (state.structure || n.type === "material")).map((n) => n.id);
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
  let focusOnSettle = null;
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
      const sn = { id, x: at.x, y: at.y };
      if (local && id === state.selected) { sn.x = sn.fx = 0; sn.y = sn.fy = 0; } // центр локального графа закреплён
      simNodes.push(sn);
      graph.addNode(id, { x: sn.x, y: sn.y, size: sizeOf(n), color: colorOf(n), label: n.label,
        forceLabel: n.type === "section" && !narrowQuery.matches, zIndex: n.type === "material" ? 0 : 1 });
    }
    const links = [];
    for (const e of DATA.edges) {
      if (!edgeOn(e.k) || !ids.has(e.s) || !ids.has(e.t)) continue;
      graph.addEdge(e.s, e.t, { kind: e.k, color: C[e.k], size: e.k === "structure" ? 0.5 : e.k === "semantic" ? 1.8 : 1.2 });
      links.push({ source: e.s, target: e.t, k: e.k });
    }
    // Чем меньше узлов, тем раньше появляются подписи материалов
    const order = graph.order, narrow = narrowQuery.matches;
    renderer.setSetting("labelRenderedSizeThreshold", order <= 150 ? 0 : order <= 500 ? 4 : narrow ? 10 : 7);
    sim = forceSimulation(simNodes)
      .force("link", forceLink(links).id((d) => d.id)
        // в локальном графе узлов мало — разносим их шире, чтобы подписи не налезали
        .distance((l) => (local ? 3 : 1) * (l.k === "structure" ? (byId.get(l.source.id ?? l.source).type === "subtopic" ? 70 : 22) : 14))
        .strength((l) => l.k === "structure" ? 0.5 : 0.9))
      .force("charge", forceManyBody().strength(local ? -220 : -26).theta(0.9).distanceMax(local ? 600 : 260))
      .force("x", forceX(0).strength(local ? 0.08 : 0.035))
      .force("y", forceY(0).strength(local ? 0.08 : 0.035))
      .force("collide", forceCollide((d) => sizeOf(byId.get(d.id)) + (local ? 18 : 1.5)).iterations(local ? 2 : 1))
      .alphaDecay(0.025)
      .on("tick", syncPositions)
      .on("end", () => {
        if (refit && !dragged) fitCamera();
        if (focusOnSettle && graph.hasNode(focusOnSettle)) { centerOn(focusOnSettle); focusOnSettle = null; }
      });
    const fresh = simNodes.filter((sn) => !pos.has(sn.id)).length;
    if (fresh > 50 || local) { sim.stop(); sim.tick(140); sim.alpha(0.35).restart(); } // «прогрев» без мельтешения
    else sim.alpha(0.4).restart();
    syncPositions();
    if (refit) { fitCamera(); setTimeout(() => sim.alpha() > 0.05 && fitCamera(), 900); }
    renderCounter();
  }
  function syncPositions() {
    if (state.mode !== "local") for (const sn of simNodes) pos.set(sn.id, { x: sn.x, y: sn.y });
    const cur = new Map(simNodes.map((sn) => [sn.id, sn]));
    graph.updateEachNodeAttributes((id, a) => { const q = cur.get(id); a.x = q.x; a.y = q.y; return a; }, { attributes: ["x", "y"] });
  }

  const container = $("#graph");
  const renderer = new Sigma(graph, container, {
    allowInvalidContainer: true,
    labelFont: "Figtree, system-ui, sans-serif", labelSize: 13, labelWeight: "600", labelColor: { color: C.text },
    labelRenderedSizeThreshold: 7, labelDensity: 0.6, labelGridCellSize: 110,
    defaultEdgeType: "line", zIndex: true, minCameraRatio: 0.05, maxCameraRatio: 6, nodeReducer, edgeReducer,
  });
  function fitCamera() {
    // фиксированная рамка вместо авто-масштаба: иначе живая физика «раскачивает» камеру
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    graph.forEachNode((_, a) => { x0 = Math.min(x0, a.x); x1 = Math.max(x1, a.x); y0 = Math.min(y0, a.y); y1 = Math.max(y1, a.y); });
    if (!isFinite(x0)) return;
    const pad = Math.max(x1 - x0, y1 - y0, 200) * 0.12;
    renderer.setCustomBBox({ x: [x0 - pad, x1 + pad * 3], y: [y0 - pad, y1 + pad] }); // справа место под подписи
    const cam = renderer.getCamera(), before = cam.getState();
    cam.setState({ x: 0.5, y: 0.5, ratio: 1, angle: 0 });
    const target = liftAboveSheet({ x: 0.5, y: 0.5, ratio: sheetHeight() ? 1.15 : 1 });
    cam.setState(before);
    cam.animate(target, { duration: 400 });
  }
  // Камера вписывает узел вместе с соседями: плотное кольцо соседей раскрывается и подписи не слипаются
  function centerOn(id) {
    const pts = [id, ...graph.neighbors(id)].map((x) => renderer.getNodeDisplayData(x)).filter(Boolean);
    if (!pts.length) return;
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
    const ratio = Math.min(1, Math.max(0.06, Math.max(w, h) * 1.8));
    const target = { x: (Math.max(...xs) + Math.min(...xs)) / 2, y: (Math.max(...ys) + Math.min(...ys)) / 2, ratio };
    renderer.getCamera().animate(liftAboveSheet(target), { duration: 450 });
  }
  // На узком экране нижнюю часть графа закрывает панель — сдвигаем фокус в видимую область над ней
  function sheetHeight() {
    const panel = $("#panel");
    return narrowQuery.matches && document.body.classList.contains("has-selection") ? panel.getBoundingClientRect().height : 0;
  }
  function liftAboveSheet(target) {
    const lift = sheetHeight() / 2;
    if (!lift) return target;
    const cam = renderer.getCamera(), before = cam.getState(), { height } = renderer.getDimensions();
    cam.setState(target);
    const a = renderer.viewportToFramedGraph({ x: 0, y: height / 2 }), b = renderer.viewportToFramedGraph({ x: 0, y: height / 2 + lift });
    cam.setState(before);
    return { ...target, x: target.x + (b.x - a.x), y: target.y + (b.y - a.y) };
  }

  // ---- Подсветка: наведение или выбор приглушает всё, кроме соседей (как в Obsidian).
  // В локальном графе весь граф — окружение выбранного, поэтому приглушает только наведение.
  function focusNode() {
    const f = state.hovered || (state.mode === "local" ? null : state.selected);
    return f && graph.hasNode(f) ? f : null;
  }
  let focusCache = { key: null, set: null, labels: null };
  function focusSets() {
    const f = focusNode();
    if (focusCache.key === f) return focusCache;
    if (!f) return (focusCache = { key: null, set: null, labels: null });
    const nbs = graph.neighbors(f);
    // Подписи соседей только когда их немного, иначе — разделы/подтемы; остальное видно в панели
    const labels = new Set([f, ...(nbs.length <= 12 ? nbs : nbs.filter((id) => byId.get(id).type !== "material"))]);
    return (focusCache = { key: f, set: new Set([f, ...nbs]), labels });
  }
  function nodeReducer(id, a) {
    const res = { ...a }, { set, labels } = focusSets();
    if (set && !set.has(id)) { res.color = C.dim; res.label = null; res.zIndex = -1; }
    else if (set) { res.forceLabel = labels.has(id); res.zIndex = 2; }
    if (matches && !set) {
      if (matches.has(id)) { res.forceLabel = matches.size <= 30; res.highlighted = true; res.zIndex = 2; }
      else { res.color = C.dim; res.label = null; }
    }
    if (state.mode === "local" && graph.order <= 20 && !(set && !set.has(id))) res.forceLabel = true; // маленький локальный граф подписан целиком
    if (id === state.selected) { res.highlighted = true; res.forceLabel = true; res.size = a.size * 1.5; res.zIndex = 3; }
    return res;
  }
  function edgeReducer(id, a) {
    const res = { ...a }, f = focusNode();
    if (f) {
      const [s, t] = graph.extremities(id);
      if (s !== f && t !== f) res.hidden = true; else res.size = a.size + 1;
    } else if (matches) res.color = C.dimEdge;
    return res;
  }
  const refresh = () => { focusCache.key = undefined; renderer.refresh({ skipIndexation: true }); };

  // ---- Мышь, касания, перетаскивание узла с «оживлением» физики ----
  renderer.on("enterNode", ({ node }) => { if (touch) return; state.hovered = node; container.classList.add("pointer"); refresh(); });
  renderer.on("leaveNode", () => { if (touch) return; state.hovered = null; container.classList.remove("pointer"); refresh(); });
  renderer.on("clickNode", ({ node }) => { if (!dragMoved) select(node === state.selected ? null : node); });
  renderer.on("clickStage", () => { if (!dragMoved) select(null); });
  renderer.on("downStage", () => { dragMoved = false; });
  renderer.on("downNode", ({ node, event }) => {
    dragMoved = false;
    if (touch || event?.original?.type?.startsWith("touch")) return; // на тач-экране палец двигает камеру
    dragged = simNodes.find((s) => s.id === node);
    if (dragged) { dragged.fx = dragged.x; dragged.fy = dragged.y; dragged.start = { x: event.x, y: event.y }; sim.alphaTarget(0.25).restart(); }
  });
  renderer.getMouseCaptor().on("mousemovebody", (e) => {
    if (!dragged) return;
    if (!dragMoved && Math.hypot(e.x - dragged.start.x, e.y - dragged.start.y) < 4) return; // дрожание руки — это клик
    const q = renderer.viewportToGraph(e);
    dragged.fx = q.x; dragged.fy = q.y; dragMoved = true;
    e.preventSigmaDefault(); e.original.preventDefault(); e.original.stopPropagation();
  });
  const release = () => {
    if (!dragged) return;
    const pinned = state.mode === "local" && dragged.id === state.selected;
    if (pinned) { dragged.fx = 0; dragged.fy = 0; } else { dragged.fx = null; dragged.fy = null; }
    dragged = null; sim.alphaTarget(0);
  };
  window.addEventListener("pointerup", release);
  window.addEventListener("pointercancel", release);
  window.addEventListener("blur", release);

  function select(id, { push = true } = {}) {
    const before = state.selected, wasLocal = state.mode === "local";
    state.selected = id;
    state.hovered = null;
    if (!id && wasLocal) state.mode = "global";
    if (wasLocal && before !== id) rebuild(); // локальный граф следует за выбранным узлом, как в Obsidian
    renderPanel(); refresh(); renderModes();
    writeHash(push && before !== id);
    if (id && graph.hasNode(id) && state.mode !== "local") centerOn(id);
  }
  // Показать узел, даже если его скрывают фильтры: включаем его раздел и структуру
  function reveal(id) {
    const n = byId.get(id);
    let changed = false;
    if (n.sec && !state.sections.has(n.sec)) { state.sections.add(n.sec); changed = true; }
    if (semanticNode(n) && !state.semantic) { state.semantic = true; changed = true; }
    if (["section","subtopic"].includes(n.type) && !state.structure) { state.structure = true; changed = true; }
    if (changed) { syncControls(); writeHash(); }
    if (changed || (state.mode !== "local" && !graph.hasNode(id))) { state.selected = null; rebuild(); focusOnSettle = id; }
    select(id);
  }

  // ---- Панель узла ----
  let detailRequest = 0;
  function renderPanel() {
    const el = $("#panel"), n = state.selected && byId.get(state.selected);
    document.body.classList.toggle("has-selection", !!n);
    if (!n) {
      el.innerHTML = `<p class="hint-title">Выберите узел</p>
        <p class="muted">${touch ? "Коснитесь узла, чтобы увидеть соседей и описание." : "Наведение подсвечивает соседей. Узлы можно перетаскивать — граф «оживёт»."} Подписи материалов появляются при приближении.</p>
        <dl class="legend">
          <dt><i class="dot big" data-color="#8c491a"></i></dt><dd>Раздел или подтема — цвет раздела</dd>
          <dt><i class="dot" data-color="#c67139"></i></dt><dd>Материал</dd>
          <dt><i class="line" data-color="${C.structure}"></i></dt><dd>Структура каталога</dd>
          <dt><i class="line" data-color="${C.series}"></i></dt><dd>Серия: соседние номера в названии</dd>
          ${DATA.semantic_enabled?`<dt><i class="line" data-color="${C.semantic}"></i></dt><dd>Смысловая связь: подтверждена цитатой</dd>`:""}
        </dl>`;
      paint(el);
      return;
    }
    const nbs = adj.get(n.id).filter(([, k]) => edgeOn(k)).map(([id, k]) => ({ n: byId.get(id), k }))
      .sort((a, b) => (a.n.type === "material") - (b.n.type === "material") || (b.n.ts || 0) - (a.n.ts || 0));
    const sec = n.sec && SEC[n.sec];
    el.innerHTML = `
      <button class="close" id="panel-close" aria-label="Закрыть">×</button>
      <div class="tags"><span class="tag"><i class="dot" data-color="${colorOf(n)}"></i>${TYPE_LABEL[n.type]}</span>
        ${sec && n.type !== "section" ? `<span class="tag soft">${esc(sec.name)}</span>` : ""}
        ${n.type === "material" && n.sub ? `<span class="tag soft">${esc(n.sub)}</span>` : ""}</div>
      <h2>${esc(n.label)}</h2>
      ${n.date ? `<p class="muted">${esc(n.date)}</p>` : ""}
      ${n.count ? `<p class="muted">${n.count} ${semanticNode(n)?"материалов с цитатами":"материалов в каталоге"}</p>` : ""}
      <div id="detail"></div>
      ${semanticNode(n)?`<a class="open" data-route href="#view=concept&id=${encodeURIComponent(n.concept_id)}">Читать ${n.type==='term'?'термин':'тему'} и цитаты →</a>`:""}
      ${n.type === "material" ? `<a class="open" href="#view=article&id=${encodeURIComponent(n.id)}" data-article="${esc(n.id)}">Читать материал →</a>` : ""}
      <div class="row"><button class="btn" id="to-local">${state.mode === "local" ? "К общему графу" : "Локальный граф"}</button></div>
      <p class="muted small">Связи: ${nbs.length}</p>
      <div class="nbs">${nbs.slice(0, 40).map(({ n: m, k }) =>
        `<button class="chip" data-id="${esc(m.id)}" title="${esc(m.label)} · ${EDGE_LABEL[k]}"><i class="dot" data-color="${colorOf(m)}"></i><span>${esc(m.label)}</span></button>`).join("")}
        ${nbs.length > 40 ? `<span class="muted small">… и ещё ${nbs.length - 40}</span>` : ""}</div>`;
    paint(el);
    el.scrollTop = 0;
    el.querySelectorAll(".chip").forEach((b) => b.addEventListener("click", () => reveal(b.dataset.id)));
    $("#panel-close").addEventListener("click", () => select(null));
    $("#to-local").addEventListener("click", () => setMode(state.mode === "local" ? "global" : "local"));
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
        + links.map((l) => `<a class="open" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">Открыть: ${esc(l.label || l.type)} ↗</a>`).join("");
    } catch (e) {
      if (ticket !== detailRequest) return;
      if (e.auth) return showLogin("Доступ закончился или был отозван. Введите новый код.");
      box.innerHTML = `<p class="muted small">Описание не загрузилось. <button class="link-inline" id="detail-retry">Повторить</button></p>`;
      $("#detail-retry").addEventListener("click", () => loadDetail(id));
    }
  }

  // ---- Панель управления ----
  function setMode(mode) {
    state.mode = mode;
    rebuild(); renderPanel(); renderModes(); writeHash(true);
  }
  function renderCounter() {
    const extra = state.mode === "local" && visibleInfo.total > graph.order ? ` — ближайшие ${graph.order} из ${visibleInfo.total}` : "";
    $("#counter").textContent = `Показано ${graph.order} из ${DATA.nodes.length} узлов · ${graph.size} связей${extra}`;
  }
  function renderModes() {
    document.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === state.mode)));
    $("#depth").hidden = state.mode !== "local";
    document.querySelectorAll("[data-depth]").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.depth === state.depth)));
    const local = $('[data-mode="local"]');
    local.disabled = !state.selected;
    local.title = state.selected ? "" : "Сначала выберите узел";
  }
  function syncControls() {
    ["structure", "series", "semantic", "orphans"].forEach((k) => { $(`#t-${k}`).checked = state[k]; });
    // Пока включена структура, у каждого узла есть связь — переключатель ничего бы не менял
    $("#t-semantic").closest("label").hidden = !DATA.semantic_enabled;
    $("#t-orphans").disabled = state.structure && !DATA.semantic_enabled;
    $("#t-orphans").closest("label").title = state.structure && !DATA.semantic_enabled ? "Все узлы связаны структурой — выключите «Разделы и подтемы»" : "";
    renderSections();
    renderFilterBadge();
  }
  ["structure", "series", "semantic", "orphans"].forEach((k) => {
    $(`#t-${k}`).addEventListener("change", (e) => {
      state[k] = e.target.checked;
      syncControls(); rebuild({ refit: k !== "series" }); renderPanel(); writeHash();
    });
  });
  const secs = $("#sections");
  function renderSections() {
    const all = state.sections.size === ALL_SECTIONS.length;
    secs.innerHTML = `<button class="sec all" data-all aria-pressed="${all}">Все разделы</button>` + DATA.sections.map((s) =>
      `<button class="sec" data-sec="${esc(s.id)}" aria-pressed="${!all && state.sections.has(s.id)}"><i class="dot" data-color="${SEC[s.id].color}"></i>${esc(s.name)} <span>${s.count}</span></button>`).join("");
    paint(secs);
  }
  secs.addEventListener("click", (ev) => {
    const b = ev.target.closest("button"); if (!b) return;
    const id = b.dataset.sec, all = state.sections.size === ALL_SECTIONS.length;
    if (b.hasAttribute("data-all")) state.sections = new Set(ALL_SECTIONS);
    else if (ev.shiftKey || ev.metaKey || ev.ctrlKey) { // добавить/убрать раздел к выбранным
      if (all) state.sections = new Set([id]);
      else if (state.sections.has(id) && state.sections.size > 1) state.sections.delete(id);
      else state.sections.add(id);
    } else state.sections = !all && state.sections.size === 1 && state.sections.has(id) ? new Set(ALL_SECTIONS) : new Set([id]);
    if (state.mode === "local") state.mode = "global";
    syncControls(); rebuild(); renderPanel(); renderModes(); writeHash();
  });
  function renderFilterBadge() {
    const n = (state.sections.size !== ALL_SECTIONS.length) + !state.structure + !state.series + !state.semantic;
    $("#filters-toggle").textContent = n ? `Фильтры · ${n}` : "Фильтры";
  }
  $("#filters-toggle").addEventListener("click", () => {
    const open = document.body.classList.toggle("filters-open");
    $("#filters-toggle").setAttribute("aria-expanded", String(open));
    requestAnimationFrame(() => renderer.resize());
  });
  document.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => { if (b.dataset.mode !== state.mode) setMode(b.dataset.mode); }));
  document.querySelectorAll("[data-depth]").forEach((b) => b.addEventListener("click", () => {
    state.depth = +b.dataset.depth; rebuild(); renderModes(); writeHash();
  }));

  // ---- Поиск ----
  const q = $("#q"), list = $("#results");
  const rank = { section: 0, material: 1, subtopic: 2 };
  function closeResults() { list.innerHTML = ""; q.setAttribute("aria-expanded", "false"); }
  function search() {
    const s = norm(q.value.trim());
    if (s.length < 2) { matches = null; closeResults(); refresh(); return; }
    const found = DATA.nodes.filter((n) => norm(n.label).includes(s)).sort((a, b) => rank[a.type] - rank[b.type] || (b.ts || 0) - (a.ts || 0));
    matches = new Set(found.map((n) => n.id));
    list.innerHTML = found.slice(0, 8).map((n) => `<li><button data-id="${esc(n.id)}"><i class="dot" data-color="${colorOf(n)}"></i><span>${esc(n.label)}</span><small>${TYPE_LABEL[n.type]}${n.sec && n.type !== "section" ? " · " + esc(SEC[n.sec].name) : ""}</small></button></li>`).join("")
      + (found.length > 8 ? `<li class="muted small">Найдено ${found.length}, показаны первые 8 — остальные подсвечены на графе</li>` : "")
      + (!found.length ? `<li class="muted small">Ничего не найдено</li>` : "");
    q.setAttribute("aria-expanded", "true");
    paint(list);
    refresh();
  }
  list.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-id]"); if (!b) return;
    closeResults(); matches = null; q.blur(); reveal(b.dataset.id);
  });
  q.addEventListener("input", search);
  q.addEventListener("focus", () => { if (q.value.trim().length >= 2) search(); });
  q.addEventListener("keydown", (e) => {
    if (e.key === "Enter") list.querySelector("button")?.click();
    if (e.key === "Escape") { q.value = ""; search(); q.blur(); }
  });
  document.addEventListener("pointerdown", (e) => { if (!e.target.closest(".search")) closeResults(); });

  // ---- Камера и клавиатура ----
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
  document.addEventListener("keydown", (e) => { if (!$("#graph-workspace").hidden && e.key === "Escape" && state.selected && document.activeElement !== q) select(null); });

  // Back/Forward is owned by the wiki router (catalog, reader, graph).
  narrowQuery.addEventListener("change", () => { renderer.resize(); rebuild(); });

  readHash();
  syncControls();
  rebuild();
  renderPanel();
  renderModes();
  if (state.selected && state.mode !== "local") focusOnSettle = state.selected;
  mountLibrary({ DATA, api, esc, showLogin, onGraph: (params, restored) => {
    renderer.resize();
    if (!restored) { readHash(); syncControls(); rebuild(); renderPanel(); renderModes();
      if (state.selected) focusOnSettle = state.selected; }
    else renderer.refresh();
  }});
  window.__graphTest = { renderer, graph, state, byId,
    pinned: () => simNodes.filter((sn) => sn.fx != null && !(state.mode === "local" && sn.id === state.selected)).length }; // для браузерных проверок; данных сверх видимых на странице нет
}

boot();
