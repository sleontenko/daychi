// Public wire authority: Workshop 4aec5f8, provider definitions: Cabinet 868a4ed.
// https://github.com/dveyarangi/xuanxue-workshop/blob/4aec5f84130c2dd8df6875c30fd94c3cf2a5ec74/docs/contracts/public-lessons.md
// This pilot owns only its in-memory result. It never writes ordinary schedule,
// selection, credential or reminder state, or applies school/Telegram corrections.
import { dayKey } from './model.ts';
import { schoolInstant } from './source.ts';

export type PublicLesson = {
  id: string; classId: string; startsAt: string; durationMin: number;
  classTitle: string; groupLabel: string; format: 'online' | 'offline' | 'both';
  location?: string; topic: string; status: 'scheduled' | 'cancelled'; tags: string[];
};
export type CabinetWindow = { from: string; to: string };
export type CabinetResult = CabinetWindow & { lessons: PublicLesson[]; fetchedAt: number };
export type CabinetFailure = 'configuration' | 'network' | 'http' | 'invalid-response';
export type CabinetPilotState = {
  result: CabinetResult | null; loading: boolean; error: CabinetFailure | null;
};

const fields = ['id', 'classId', 'startsAt', 'durationMin', 'classTitle',
  'groupLabel', 'format', 'topic', 'status', 'tags'];
const malformed = () => new Error('Некорректный ответ сервиса расписания');

function utcDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) return false;
  const stamp = Date.parse(value);
  // Date.parse normalizes invalid dates such as February 30; do not accept them.
  return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 19) === value.slice(0, 19);
}

export function cabinetWindow(now = Date.now()): CabinetWindow {
  const today = dayKey(now);
  const end = new Date(Date.parse(`${today}T12:00:00Z`) + 14 * 86400000).toISOString().slice(0, 10);
  const midnight = (day: string) => {
    const offset = (Date.parse(`${day}T00:00:00Z`) - Date.parse(schoolInstant(day, '00:00'))) / 60000;
    const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
    const minutes = String(Math.abs(offset) % 60).padStart(2, '0');
    return `${day}T00:00:00${offset < 0 ? '-' : '+'}${hours}:${minutes}`;
  };
  return { from: midnight(today), to: midnight(end) };
}

export function decodePublicLessons(value: unknown, window?: CabinetWindow): PublicLesson[] {
  if (!Array.isArray(value)) throw malformed();
  const ids = new Set<string>();
  let previousStart = -Infinity;
  return value.map(raw => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw malformed();
    const keys = Object.keys(raw);
    if (fields.some(key => !Object.hasOwn(raw, key)) ||
        keys.some(key => !fields.includes(key) && key !== 'location')) throw malformed();
    if (typeof raw.id !== 'string' || !raw.id || ids.has(raw.id) ||
        typeof raw.classId !== 'string' || !raw.classId || !utcDate(raw.startsAt) ||
        typeof raw.durationMin !== 'number' || !Number.isFinite(raw.durationMin) ||
        !['classTitle', 'groupLabel', 'topic'].every(key => typeof raw[key] === 'string') ||
        !['online', 'offline', 'both'].includes(raw.format) ||
        !['scheduled', 'cancelled'].includes(raw.status) ||
        !Array.isArray(raw.tags) || raw.tags.some((tag: unknown) => typeof tag !== 'string') ||
        (Object.hasOwn(raw, 'location') && typeof raw.location !== 'string')) throw malformed();
    const start = Date.parse(raw.startsAt);
    if (start < previousStart || (window &&
        (start < Date.parse(window.from) || start >= Date.parse(window.to)))) throw malformed();
    previousStart = start;
    ids.add(raw.id);
    // Return a detached public projection, preserving IDs and legitimate empty values.
    return { ...raw, tags: [...raw.tags] } as PublicLesson;
  });
}

export function cabinetLessonsURL(origin: string, window: CabinetWindow): string {
  const base = new URL(origin);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password ||
      base.search || base.hash || base.pathname !== '/') throw new Error('Cabinet origin must exclude /api');
  const url = new URL('/api/public/lessons', base);
  url.searchParams.set('from', window.from);
  url.searchParams.set('to', window.to);
  return url.toString();
}

export function createCabinetPilot({ origin, fetch: read = (url, options) => globalThis.fetch(url, options),
  now = Date.now, timeoutMs = 12000 }: {
  origin: string; fetch?: typeof globalThis.fetch; now?: () => number; timeoutMs?: number;
}) {
  let state: CabinetPilotState = { result: null, loading: false, error: null };
  let pending: Promise<CabinetPilotState> | null = null;
  function refresh(): Promise<CabinetPilotState> {
    if (pending) return pending;
    state = { ...state, loading: true, error: null };
    pending = (async () => {
      let failure: CabinetFailure = 'configuration';
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const window = cabinetWindow(now());
        const url = cabinetLessonsURL(origin, window);
        failure = 'network';
        timer = setTimeout(() => controller.abort(), timeoutMs);
        const response = await read(url, { signal: controller.signal,
          credentials: 'omit', cache: 'no-store' });
        failure = 'http';
        if (response.status !== 200) throw new Error('Cabinet request failed');
        failure = 'invalid-response';
        if (response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json')
          throw malformed();
        const lessons = decodePublicLessons(await response.json(), window);
        state = { result: { ...window, lessons, fetchedAt: now() }, loading: false, error: null };
      } catch {
        state = { ...state, loading: false, error: failure };
      } finally {
        clearTimeout(timer);
      }
      return state;
    })().finally(() => { pending = null; });
    return pending;
  }
  return { getState: () => state, refresh };
}
