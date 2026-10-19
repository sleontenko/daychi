import type { ReminderContext } from '../cabinet-account/session-core';
import { CabinetError } from '../cabinet-account/protocol';
import { ReminderRequestError } from '../cabinet-account/reminders-client';
import { decodePublicLessons, type CabinetResult } from '../schedule/cabinet-pilot';
import { acceptReminderSnapshot, compareReminderRevisions, decodeReminderSnapshot,
  encodeReminderChanges, type ReminderChange, type ReminderSnapshot } from './protocol';

export type ReminderScope = { issuer: string; accountId: string };
export type ReminderState = {
  scope: ReminderScope | null; confirmed: ReminderSnapshot | null; calendar: CabinetResult | null;
  phase: 'loading' | 'ready' | 'offline' | 'saving' | 'uncertain' | 'refused';
  online: boolean; loading: boolean; retryAt: number; error: string;
};
export const reminderCacheKey = (scope: ReminderScope) =>
  `daychi.cabinet.reminders.v1.${encodeURIComponent(scope.issuer)}.${encodeURIComponent(scope.accountId)}`;

export function createReminderController(port: {
  context(): ReminderContext;
  request(changes?: ReminderChange[]): Promise<unknown>;
  calendar(issuer: string): Promise<CabinetResult>;
  get(key: string): Promise<string | null>; set(key: string, value: string): Promise<void>;
  reconcile(state: ReminderState, current: () => boolean): Promise<void>;
  now?: () => number;
}) {
  const now = port.now ?? Date.now;
  let state: ReminderState = { scope: null, confirmed: null, calendar: null, phase: 'loading',
    online: false, loading: false, retryAt: 0, error: '' };
  let context = port.context(), generation = 0, attaching: Promise<void> | null = null;
  let activeRead: Promise<void> | null = null, writes = Promise.resolve(), effects = Promise.resolve();
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<ReminderState>) => { state = { ...state, ...patch }; listeners.forEach(f => f()); };
  const binding = () => `daychi.cabinet.reminders.binding.v1.${encodeURIComponent(context.issuer)}`;
  const ticket = () => ({ local: generation, issuer: context.issuer, epoch: context.generation,
    grant: context.grantId, account: state.scope?.accountId });
  const current = (t: ReturnType<typeof ticket>) => {
    const c = port.context();
    return generation === t.local && c.issuer === t.issuer && c.generation === t.epoch &&
      c.grantId === t.grant && c.logoutVersion === context.logoutVersion &&
      (!t.account || !c.accountId || c.accountId === t.account);
  };
  function reconcile() {
    const t = ticket(), next = state;
    effects = effects.catch(() => {}).then(async () => {
      if (current(t)) await port.reconcile(next, () => current(t));
    }).catch(() => { if (current(t)) publish({ error: 'Выбор сохранён. Не удалось обновить напоминания на устройстве.' }); });
    return effects;
  }
  function persist() {
    if (!state.scope || !state.confirmed) return Promise.resolve();
    const t = ticket(), key = reminderCacheKey(state.scope);
    const value = JSON.stringify({ version: 1, confirmed: state.confirmed, calendar: state.calendar });
    const bindingKey = binding(), bindingValue = JSON.stringify({ grantId: context.grantId, accountId: state.scope.accountId });
    writes = writes.catch(() => {}).then(async () => {
      if (!current(t)) return;
      await port.set(key, value);
      if (current(t)) await port.set(bindingKey, bindingValue);
    }).catch(() => { if (current(t)) publish({ error: 'Подтверждено Кабинетом, но не сохранено для просмотра без сети.' }); });
    return writes;
  }
  async function attach() {
    const next = port.context();
    const previous = context;
    const changed = next.issuer !== context.issuer || next.generation !== context.generation ||
      next.grantId !== context.grantId || next.logoutVersion !== context.logoutVersion ||
      (!!next.accountId && next.accountId !== state.scope?.accountId);
    const logout = next.logoutVersion !== context.logoutVersion;
    if (changed) { generation++; activeRead = null; attaching = null; }
    context = next;
    if (logout) {
      publish({ scope: null, confirmed: null, calendar: null, phase: 'loading', loading: false, error: '', retryAt: 0 });
      await reconcile(); return;
    }
    if (!next.grantId) {
      // Invalid credentials retain confirmed cache in read-only mode. Only an
      // explicit logout above switches ownership back to the guest.
      if (state.scope) publish({ phase: 'refused', loading: false });
      return;
    }
    if (attaching && !changed) return attaching;
    if (state.scope?.issuer === next.issuer && (next.accountId === state.scope.accountId ||
        (!next.accountId && next.grantId === previous.grantId))) {
      if (changed || next.status === 'unavailable' || next.status === 'storage-error' || next.signIn !== 'idle') {
        publish({ phase: state.phase === 'saving' || state.phase === 'uncertain' ? 'uncertain' : 'offline', loading: false });
      }
      if (next.status === 'blocked') publish({ phase: 'refused', loading: false });
      return;
    }
    if (attaching) return attaching;
    const t = ticket(), previousScope = state.scope;
    // Clear the former account immediately, before any asynchronous cache read.
    publish({ scope: null, confirmed: null, calendar: null, phase: 'loading', loading: true, error: '', retryAt: 0 });
    if (previousScope) void reconcile();
    attaching = (async () => {
      let accountId = next.accountId;
      if (!accountId) {
        try {
          const raw = JSON.parse(await port.get(binding()) ?? 'null');
          if (raw?.grantId === next.grantId && typeof raw.accountId === 'string') accountId = raw.accountId;
        } catch { /* No trusted binding; wait for the credential owner's profile. */ }
      }
      if (!current(t) || !accountId) { if (current(t)) publish({ loading: false }); return; }
      const scope = { issuer: next.issuer, accountId };
      publish({ scope, loading: false });
      void reconcile();
      const own = ticket();
      try {
        const cache = JSON.parse(await port.get(reminderCacheKey(scope)) ?? 'null');
        if (!current(own) || !cache) return;
        if (cache.version !== 1) throw Error();
        const confirmed = decodeReminderSnapshot(cache.confirmed, accountId);
        const raw = cache.calendar;
        const calendar = raw && typeof raw.from === 'string' && typeof raw.to === 'string' &&
          Number.isFinite(Date.parse(raw.from)) && Date.parse(raw.to) > Date.parse(raw.from) && Number.isFinite(raw.fetchedAt)
          ? { from: raw.from, to: raw.to, fetchedAt: raw.fetchedAt, lessons: decodePublicLessons(raw.lessons, raw) } : null;
        publish({ confirmed, calendar, phase: 'offline' });
        await reconcile();
      } catch { if (current(own)) publish({ error: 'Не удалось прочитать сохранённый выбор. Обновите данные Кабинета.' }); }
    })().finally(() => { attaching = null; });
    return attaching;
  }
  function setOnline(online: boolean) {
    if (online === state.online) return;
    if (!online) { generation++; activeRead = null; }
    publish({ online, ...(!online ? { phase: state.phase === 'saving' || state.phase === 'uncertain' ? 'uncertain' as const : 'offline' as const, loading: false } : {}) });
  }
  function canEdit() {
    const c = port.context();
    return !!state.scope && !!state.confirmed && state.online && state.phase === 'ready' &&
      !state.loading && now() >= state.retryAt && c.status === 'active' && c.signIn === 'idle' &&
      c.issuer === state.scope.issuer && c.accountId === state.scope.accountId;
  }
  async function refresh() {
    await attach();
    if (!state.scope || !state.online || state.phase === 'saving' || now() < state.retryAt) return;
    const owner = port.context();
    if (owner.status !== 'active' || owner.signIn !== 'idle') {
      const refused = owner.status === 'blocked' || !owner.grantId;
      publish({ phase: refused ? 'refused' : 'offline', loading: false,
        error: refused ? 'Проверьте вход в Кабинет. Сохранённый выбор доступен для просмотра.' :
          'Не удалось подтвердить аккаунт. Сохранённые занятия и напоминания остаются.' });
      return;
    }
    if (activeRead) return activeRead;
    const t = ticket(), scope = state.scope;
    publish({ loading: true, error: '' });
    const promise = (async () => {
      const [settings, calendar] = await Promise.allSettled([port.request(), port.calendar(scope.issuer)]);
      if (!current(t)) return;
      let phase: ReminderState['phase'] = 'ready', error = '', changed = false;
      if (settings.status === 'fulfilled') {
        try {
          const confirmed = acceptReminderSnapshot(state.confirmed, settings.value, scope.accountId);
          // A lower response is not proof of current state or uncertain-save recovery.
          if (state.confirmed && compareReminderRevisions(decodeReminderSnapshot(settings.value, scope.accountId).revision, state.confirmed.revision) < 0) throw Error();
          publish({ confirmed }); changed = true;
        } catch { phase = 'uncertain'; error = 'Кабинет вернул некорректные данные. Обновите выбор ещё раз.'; }
      } else {
        phase = settings.reason instanceof CabinetError && ['invalid_token', 'account_blocked'].includes(settings.reason.kind) ? 'refused' : 'offline';
        const delay = settings.reason instanceof ReminderRequestError ? settings.reason.retrySeconds : 0;
        if (delay) publish({ retryAt: now() + delay * 1000 });
        error = phase === 'refused' ? 'Проверьте вход в Кабинет. Сохранённый выбор доступен для просмотра.' : 'Не удалось обновить выбор. Сохранённые напоминания остаются.';
      }
      if (calendar.status === 'fulfilled') { publish({ calendar: calendar.value }); changed = true; }
      else error ||= 'Не удалось обновить расписание. Показаны сохранённые занятия.';
      publish({ phase, loading: false, error });
      if (changed) { await persist(); await reconcile(); }
    })().finally(() => { if (activeRead === promise) activeRead = null; });
    activeRead = promise;
    return promise;
  }
  async function save(changes: ReminderChange[]) {
    if (!canEdit()) return false;
    try { encodeReminderChanges(changes); } // Reject an invalid batch before any IO.
    catch { publish({ error: 'Некорректный выбор занятия. Обновите данные Кабинета.' }); return false; }
    const t = ticket(), accountId = state.scope!.accountId;
    publish({ phase: 'saving', error: '' });
    try {
      const value = await port.request(changes);
      if (!current(t)) return false;
      const next = decodeReminderSnapshot(value, accountId);
      if (state.confirmed && compareReminderRevisions(next.revision, state.confirmed.revision) < 0) throw Error();
      publish({ confirmed: next, phase: 'ready', error: '' });
      await persist(); await reconcile(); return true;
    } catch (error) {
      if (!current(t)) return false;
      const rejected = error instanceof ReminderRequestError && [400, 409, 413, 415].includes(error.status);
      const refused = error instanceof CabinetError && ['invalid_token', 'account_blocked'].includes(error.kind);
      const delay = error instanceof ReminderRequestError ? error.retrySeconds : 0;
      publish({ phase: rejected ? 'ready' : refused ? 'refused' : 'uncertain',
        retryAt: delay ? now() + delay * 1000 : state.retryAt,
        error: rejected ? 'Изменение не сохранено. Проверьте выбор и попробуйте снова.' : refused ?
          'Проверьте вход в Кабинет. Последний подтверждённый выбор сохранён.' :
          'Проверяем, сохранилось ли изменение. Обновите данные перед следующим выбором.' });
      return false;
    }
  }
  return { getState: () => state, subscribe(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; },
    attach, refresh, save, canEdit, setOnline, reconcile, settled: () => Promise.all([writes, effects]) };
}
