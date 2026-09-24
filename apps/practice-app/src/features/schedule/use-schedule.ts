import { telegramSchedule } from './zoom';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { decodeChoices, decodeSchedule, type Schedule, type Occurrence } from './model';
import { loadSchedule } from './load';
import { notificationPermission, updateReminders } from './local-reminders';
import type { Preferences } from './reminder-plan';
import { cancelWeekly, chooseWeekly, decodeSubscriptions, isChosen, toggleDate } from './attendance';

const CACHE = 'quiet-practice.schedule.v1', PREFS = 'quiet-practice.preferences.v2';
const initial: Preferences = { choices: {}, enabled: false, lead: 30 };

export function useSchedule() {
  const [data, setData] = useState<Schedule | null>(null);
  const [prefs, setPrefs] = useState(initial);
  const [ready, setReady] = useState(false), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false), [error, setError] = useState('');
  const [allowed, setAllowed] = useState(false), [scheduled, setScheduled] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const state = useRef<{ data: Schedule | null; prefs: Preferences }>({ data: null, prefs: initial });
  const fetchBusy = useRef(false), writeBusy = useRef(false), alive = useRef(true);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const serial = useCallback((action: () => Promise<void>) => {
    const next = queue.current.then(action, action);
    queue.current = next.catch(() => {});
    return next;
  }, []);
  const reconcile = useCallback(async () => {
    const permission = await notificationPermission();
    const count = await updateReminders(state.current.data?.occurrences ?? [], state.current.prefs);
    if (alive.current) { setAllowed(permission); setScheduled(count); }
  }, []);

  const refresh = useCallback(async () => {
    if (fetchBusy.current) return;
    fetchBusy.current = true;
    if (alive.current) setLoading(true);
    try {
      const next = await loadSchedule();
      await serial(async () => {
        state.current.data = next;
        if (alive.current) { setData(next); setOffline(false); setNow(Date.now()); }
        try { await AsyncStorage.setItem(CACHE, JSON.stringify(next)); }
        catch { if (alive.current) setError('Не удалось сохранить расписание без сети.'); }
        try { await reconcile(); }
        catch { if (alive.current) setError('Напоминания не обновились. Нажми «Повторить».'); }
      });
    } catch {
      if (alive.current) setOffline(true);
    } finally { fetchBusy.current = false; if (alive.current) setLoading(false); }
  }, [serial, reconcile]);

  useEffect(() => {
    alive.current = true;
    void (async () => {
      try {
        const saved = await AsyncStorage.getItem(PREFS);
        const old = await AsyncStorage.getItem('quiet-practice.attendance.v1');
        const raw = saved ? JSON.parse(saved) : null;
        const restored: Preferences = { choices: decodeChoices(raw?.choices ?? (old ? JSON.parse(old) : {})),
          subscriptions: decodeSubscriptions(raw?.subscriptions), skipped: decodeChoices(raw?.skipped),
          enabled: raw?.enabled === true, lead: [0, 15, 30, 60].includes(raw?.lead) ? raw.lead : 30 };
        state.current.prefs = restored;
        if (alive.current) setPrefs(restored);
        const cached = await AsyncStorage.getItem(CACHE);
        if (cached) {
          try { state.current.data = telegramSchedule(decodeSchedule(JSON.parse(cached))); } catch { /* Reject invalid cache. */ }
        }
        if (alive.current) { setData(state.current.data); setOffline(!!state.current.data); }
        await serial(reconcile);
      } catch { if (alive.current) setError('Не удалось восстановить настройки. Попробуй ещё раз.'); }
      if (alive.current) { setReady(true); void refresh(); }
    })();
    return () => { alive.current = false; };
  }, [refresh, serial, reconcile]);

  useEffect(() => {
    if (!ready) return;
    const subscription = AppState.addEventListener('change', status => {
      if (status === 'active') { setNow(Date.now()); void serial(reconcile).catch(() => setError('Проверь настройки напоминаний.')); void refresh(); }
    });
    const timer = setInterval(() => { if (AppState.currentState === 'active') void refresh(); }, 300000);
    const clock = setInterval(() => setNow(Date.now()), 30000);
    return () => { subscription.remove(); clearInterval(timer); clearInterval(clock); };
  }, [ready, refresh, reconcile, serial]);

  const change = async (edit: (current: Preferences) => Preferences, askPermission = false) => {
    if (!ready || writeBusy.current) return;
    writeBusy.current = true; setBusy(true); setError('');
    try {
      const permission = askPermission ? await notificationPermission(true) : await notificationPermission();
      await serial(async () => {
        let next = edit(state.current.prefs);
        if (askPermission) next = { ...next, enabled: permission };
        await AsyncStorage.setItem(PREFS, JSON.stringify(next));
        state.current.prefs = next; setPrefs(next); setAllowed(permission);
        try { await reconcile(); }
        catch { setError('Выбор сохранён, но напоминания не обновились. Нажми «Повторить».'); }
        if (askPermission && !permission && Platform.OS !== 'web')
          setError('Занятие сохранено. Чтобы получать напоминания, разреши уведомления в настройках телефона.');
      });
    } catch { setError('Не удалось сохранить изменения. Попробуй ещё раз.'); }
    finally { writeBusy.current = false; setBusy(false); }
  };
  const toggle = (id: string) => change(current => {
    const event = state.current.data?.occurrences.find(e => e.id === id);
    if (event) return toggleDate(current, event);
    const choices = { ...current.choices };
    if (choices[id]) delete choices[id]; else choices[id] = true;
    return { ...current, choices };
  });

  const choose = (event: Occurrence, weekly: boolean) => change(current => {
    if (event.status !== 'scheduled' || Date.parse(event.starts_at) <= Date.now()) return current;
    return weekly ? chooseWeekly(current, event) : isChosen(event, current) ? current : toggleDate(current, event);
  }, !state.current.prefs.enabled && !Object.keys(state.current.prefs.choices).length &&
    !Object.keys(state.current.prefs.subscriptions ?? {}).length);

  return { data, prefs, now, ready, loading, busy, offline, error, allowed, scheduled, refresh, toggle, choose,
    cancelSubscription: (id: string) => change(current => cancelWeekly(current, id)),
    setEnabled: (enabled: boolean) => change(current => ({ ...current, enabled }), enabled),
    setLead: (lead: number) => change(current => ({ ...current, lead })),
    retry: () => change(current => current), setError };
}
