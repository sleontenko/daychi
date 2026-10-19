import http from 'node:http';
if (process.env.DAYCHI_SYNTHETIC_REMINDERS_QA !== '1') throw Error('Explicit synthetic opt-in required');
const id = n => n.toString(16).padStart(24, '0');
const account = { id: 'synthetic-reminder-account', name: 'Тестовый ученик', roles: [], status: 'active', telegramLinked: false,
  botChatActive: false, hasEmail: false, googleLinked: false, noTelegram: false, needsProfile: false,
  studentMode: false, canUseStudentMode: false, homeHiddenTiles: [] };
const defaults = () => ({ version: 1, accountId: account.id, revision: '1', classIds: [], lessonIds: [], leadMinutes: null, schoolMinutes: 45,
  classes: [{ id: id(100), title: 'Медитация онлайн', groupLabel: 'Практика', tz: 'Asia/Jerusalem', slots: [{ weekday: 1, time: '10:00', durationMin: 60 }] },
    { id: id(101), title: 'Тайцзи в парке', groupLabel: '', tz: 'Asia/Jerusalem', slots: [{ weekday: 2, time: '18:00', durationMin: 60 }] }] });
let snapshot = defaults(), mode = 'active', calendarMode = 'full';
const receipts = {};
const journal = [];
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:8116');
  let text = ''; for await (const chunk of req) text += chunk;
  const send = (status, body, headers = {}) => {
    if (!url.pathname.startsWith('/qa/')) journal.push({ method: req.method, path: url.pathname, status });
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers });
    res.end(body === undefined ? '' : JSON.stringify(body));
  };
  if (url.pathname === '/qa/journal') return send(200, journal);
  if (url.pathname === '/qa/receipt') { if (req.method === 'POST') { const value = JSON.parse(text); receipts[value.device] = value; } return send(200, receipts); }
  if (url.pathname === '/qa/state') {
    if (req.method === 'POST') {
      const value = JSON.parse(text || '{}');
      if (value.reset) snapshot = defaults();
      mode = value.mode ?? mode; calendarMode = value.calendar ?? calendarMode;
      if (value.choices === 'full') snapshot = { ...snapshot, revision: String(BigInt(snapshot.revision) + 1n), classIds: [id(100), id(999)], lessonIds: [id(2), id(998)] };
    }
    return send(200, { mode, calendarMode });
  }
  if (url.pathname === '/api/auth/native/me') {
    if (mode === 'invalid') return send(401, { error: 'invalid_token' });
    if (mode === 'blocked') return send(403, { error: 'account_blocked' });
    if (mode === 'offline') return send(503, { error: 'temporarily_unavailable' });
    return send(200, { account, session: { id: 'synthetic_grant_123456', expires_in: 7776000, renew_after: 604801 } });
  }
  if (url.pathname === '/api/auth/native/token') return send(200, { access_token: 'synthetic_token_123456789', token_type: 'Bearer', scope: 'account:read', session_id: 'synthetic_grant_123456', expires_in: 7776000, renew_after: 604801 });
  if (url.pathname === '/api/auth/native/revoke') return send(200);
  if (url.pathname === '/api/me/notifications/lessons/sync') {
    if (mode === 'offline') return send(503, { statusCode: 503, code: 'unavailable', message: 'Synthetic failure' });
    if (mode === 'limited') return send(429, { statusCode: 429, code: 'rate_limited', message: 'Synthetic limit' }, { 'Retry-After': '7' });
    if (mode === 'blocked' || mode === 'invalid') return send(mode === 'blocked' ? 403 : 401, { statusCode: mode === 'blocked' ? 403 : 401, code: 'forbidden', message: 'Synthetic refusal' });
    if (req.method === 'PATCH') {
      const { changes } = JSON.parse(text);
      for (const change of changes) {
        if (change.kind === 'lead') snapshot.leadMinutes = change.minutes;
        else { const key = change.kind === 'class' ? 'classIds' : 'lessonIds'; snapshot[key] = [...new Set([...snapshot[key].filter(v => v !== change.id), ...(change.selected ? [change.id] : [])])].sort(); }
      }
      snapshot.revision = String(BigInt(snapshot.revision) + 1n);
      if (mode === 'lost') { req.socket.destroy(); return; }
      if (mode === 'slow') await new Promise(resolve => setTimeout(resolve, 2500));
      if (mode === 'malformed') return send(200, { ...snapshot, schoolMinutes: 1 });
    }
    return send(200, snapshot);
  }
  if (url.pathname === '/api/public/lessons') {
    if (calendarMode === 'offline') return send(503, {});
    const start = Date.parse(url.searchParams.get('from'));
    const capacity = calendarMode.startsWith('capacity');
    const rows = Array.from({ length: calendarMode === 'empty' ? 0 : capacity ? 100 : 28 }, (_, n) => ({
      id: id(n + 1), classId: id(100 + n % 2), startsAt: new Date(start + Math.floor(n / 2) * 86400000 + (n % 2 ? 18 : 10) * 3600000 + (calendarMode === 'move' && n === 0 ? 3600000 : 0)).toISOString(),
      durationMin: 60, classTitle: n % 2 ? 'Тайцзи в парке' : 'Медитация онлайн', groupLabel: '', format: n % 2 ? 'offline' : 'online', location: n % 2 ? 'Парк школы' : '', topic: 'Синтетическое занятие', status: ['cancel', 'capacity-cancel'].includes(calendarMode) && n === 0 ? 'cancelled' : 'scheduled', tags: [],
      ...(capacity ? { classId: id(100), startsAt: new Date(start + (36 + n) * 3600000).toISOString() } : {}),
    }));
    return send(200, rows);
  }
  if (url.pathname === '/api/v1/schedule') {
    const start = new Date().toISOString().slice(0, 10);
    return send(200, { revision: 'synthetic-guest', fetched_at: new Date().toISOString(), valid_until: new Date(Date.now() + 15 * 86400000).toISOString(), source_url: 'https://www.telaviv-taiji.com/kogda', timezone: 'Asia/Jerusalem', kind: 'weekly_template', exceptions_verified: false,
      occurrences: [{ id: `guest:${start}`, title: 'Гостевое занятие', starts_at: `${start}T18:00:00Z`, ends_at: `${start}T19:00:00Z`, status: 'scheduled' }] });
  }
  return send(403, {});
});
server.listen(8116, '127.0.0.1', () => console.log('Synthetic reminder fixture on 127.0.0.1:8116; no external requests or credentials'));
