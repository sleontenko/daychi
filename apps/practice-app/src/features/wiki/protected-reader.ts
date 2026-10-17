import { CabinetError } from '../cabinet-account/protocol';
import type { AccountState } from '../cabinet-account/session-core';
import { externalSource } from './bridge';

export type ReaderLocation = { hash: string; scroll: number; history: string[]; camera?: { x: number; y: number; ratio: number; angle: number } };
const hash = (value: unknown): value is string => typeof value === 'string' && value.startsWith('#') && value.length <= 2048;
export function readerLocation(value: unknown): ReaderLocation | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as ReaderLocation;
  if (!hash(v.hash) || !Number.isFinite(v.scroll) || v.scroll < 0 || v.scroll > 1e7 ||
      !Array.isArray(v.history) || !v.history.length || v.history.length > 100 || !v.history.every(hash)) return null;
  const camera = v.camera && ['x', 'y', 'ratio', 'angle'].every(key => Number.isFinite(v.camera![key as keyof typeof v.camera]))
    && v.camera.ratio > 0 ? { ...v.camera } : undefined;
  return { hash: v.hash, scroll: v.scroll, history: [...v.history], ...(camera ? { camera } : {}) };
}
export function meetingSource(value: unknown): boolean {
  if (!externalSource(value)) return false;
  const host = new URL(value).hostname.toLowerCase().replace(/\.$/, '');
  return ['zoom.us', 'zoom.com'].some(domain => host === domain || host.endsWith('.' + domain));
}
// A separate allowlist for the explicitly protected host. Never widen publicWikiPath.
export function protectedWikiPath(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  const [path, query = '', extra] = value.split('?');
  if (extra !== undefined || !/^\/api\/wiki\/(?:graph|categories|materials|concepts|materials\/[A-Za-z0-9_-]{1,160}(?:\/concepts)?|concepts\/[A-Za-z0-9_-]{1,160}|articles\/(?:materials|concepts)\/[A-Za-z0-9_-]{1,160})$/.test(path)) return null;
  const params = new URLSearchParams(query);
  const allowed = path.endsWith('/graph') ? ['semantics', 'articles'] : path.endsWith('/concepts') ? ['q'] : [];
  for (const key of params.keys()) {
    if (!allowed.includes(key) || params.getAll(key).length !== 1 ||
        (key === 'q' ? params.get(key)!.length > 300 : params.get(key) !== '1')) return null;
  }
  return path.slice('/api/wiki'.length) + (query ? '?' + params.toString() : '');
}
function sourceLinks(value: unknown, output = new Set<string>(), budget = { remaining: 50000 }): Set<string> {
  if (--budget.remaining < 0) return output;
  if (externalSource(value) && !meetingSource(value)) output.add(value);
  else if (Array.isArray(value)) for (const item of value) sourceLinks(item, output, budget);
  else if (value && typeof value === 'object') {
    const evidence = value as { resource_id?: unknown; start_seconds?: unknown };
    // Match the shared reader's exact evidence link, including its authorized time.
    if (typeof evidence.resource_id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(evidence.resource_id) &&
        typeof evidence.start_seconds === 'number' && Number.isFinite(evidence.start_seconds) && evidence.start_seconds >= 0) {
      output.add('https://www.youtube.com/watch?v=' + evidence.resource_id + '&t=' + Math.floor(evidence.start_seconds) + 's');
    }
    for (const item of Object.values(value)) sourceLinks(item, output, budget);
  }
  return output;
}
type Session = { getState(): AccountState; subscribe(listener: () => void): () => void };
type Phase = 'locked' | 'checking' | 'ready' | 'blocked' | 'unavailable' | 'paused';
export function createProtectedWikiReader({ session, read, foreground = true }: {
  session: Session; read: <T>(path: string) => Promise<T>; foreground?: boolean;
}) {
  let visible = true, disposed = false, epoch = 0, account: string | null = null;
  let location: ReaderLocation | null = null;
  let failure: AccountState['error'] = null;
  const sources = new Map<string, string>(), listeners = new Set<() => void>();
  function snapshot() {
    const s = session.getState();
    if (!s.hasSession || (account && s.account && account !== s.account.id)) location = null;
    if (s.account) account = s.account.id;
    const phase: Phase = !foreground || !visible ? 'paused' : s.signIn !== 'idle' || s.status === 'checking' ? 'checking'
      : s.status === 'blocked' ? 'blocked' : !s.hasSession ? 'locked' : s.status !== 'active' || failure ? 'unavailable' : 'ready';
    return { epoch, phase, retryAt: s.retryAt, error: failure || s.error, location };
  }
  let state = snapshot(), stop: (() => void) | null = null;
  const invalidate = () => { epoch++; sources.clear(); state = snapshot(); for (const listener of listeners) listener(); };
  const current = (own: number) => !disposed && state.phase === 'ready' && own === epoch;
  const changed = () => { failure = null; invalidate(); };
  async function request<T>(path: string): Promise<T> {
    const own = epoch;
    if (!current(own)) throw new CabinetError('interrupted');
    try {
      const value = await read<T>(path);
      if (!current(own)) throw new CabinetError('interrupted');
      for (const url of sourceLinks(value)) sources.set(url, path);
      return value;
    } catch (error) {
      if (current(own) && !(error instanceof Error && error.message === '404')) {
        failure = error instanceof CabinetError ? error.kind : 'temporarily_unavailable'; invalidate();
      }
      throw error;
    }
  }
  return {
    getState: () => state,
    subscribe(listener: () => void) {
      disposed = false; listeners.add(listener);
      if (!stop) { stop = session.subscribe(changed); changed(); }
      return () => { listeners.delete(listener); if (!listeners.size) { stop?.(); stop = null; } };
    },
    request, current,
    checkpoint(value: unknown) { const next = readerLocation(value); if (next && state.phase === 'ready') location = next; },
    setForeground(value: boolean) { if (foreground !== value) { foreground = value; invalidate(); } },
    setVisible(value: boolean) { if (visible !== value) { visible = value; invalidate(); } },
    retry() { failure = null; invalidate(); },
    async source(url: unknown): Promise<string> {
      const own = epoch, path = typeof url === 'string' ? sources.get(url) : null;
      if (!path || !externalSource(url) || meetingSource(url)) throw new CabinetError('access_denied');
      const fresh = await request(path);
      if (!current(own) || !sourceLinks(fresh).has(url)) throw new CabinetError('access_denied');
      return url;
    },
    dispose() { disposed = true; epoch++; sources.clear(); location = null; stop?.(); stop = null; listeners.clear(); },
  };
}
