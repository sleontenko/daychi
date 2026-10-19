import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import { cabinetAccountEnabled, cabinetSession, signOutCabinet, useCabinetAccount } from '../cabinet-account/session';
import { createCabinetPilot } from '../schedule/cabinet-pilot';
import { notificationPermission } from '../schedule/local-reminders';
import { createReminderController, reminderCacheKey, type ReminderState } from './controller';
import { updateAccountReminders } from './device';
import type { ReminderChange } from './protocol';

export const cabinetRemindersEnabled = Platform.OS !== 'web' && cabinetAccountEnabled &&
  process.env.EXPO_PUBLIC_CABINET_REMINDERS_ENABLED === '1';
const empty: ReminderState = { scope: null, confirmed: null, calendar: null,
  phase: 'loading', online: false, loading: false, retryAt: 0, error: '' };
const initialDevice = { enabled: false, allowed: false, scheduled: 0, eligible: 0, through: null as number | null };
let device = initialDevice;
const deviceListeners = new Set<() => void>();
let instance: ReturnType<typeof createReminderController> | null = null;
export function cabinetReminders() {
  if (!instance) instance = createReminderController({
    context: () => cabinetSession().reminderContext(), request: changes => cabinetSession().reminders(changes),
    calendar: async origin => {
      const result = await createCabinetPilot({ origin }).refresh();
      if (result.error || !result.result) throw new Error('Calendar read failed');
      return result.result;
    },
    get: key => AsyncStorage.getItem(key), set: (key, value) => AsyncStorage.setItem(key, value),
    reconcile: async (state, current) => {
      const enabled = !!state.scope && await AsyncStorage.getItem(reminderCacheKey(state.scope) + '.delivery') === '1';
      if (!current()) return;
      const result = await updateAccountReminders(state, enabled, current, !!cabinetSession().reminderContext().grantId);
      const allowed = await notificationPermission();
      if (!current()) return;
      device = { enabled, allowed, ...result }; deviceListeners.forEach(f => f());
    },
  });
  return instance;
}
const networkOnline = (state: Network.NetworkState) => state.isConnected === true && state.isInternetReachable !== false;
const noopSubscribe = () => () => {};

export function useCabinetReminders() {
  const account = useCabinetAccount();
  const [booting, setBooting] = useState(cabinetRemindersEnabled);
  const [now, setNow] = useState(Date.now);
  const preflight = useRef(false);
  const [checkingSave, setCheckingSave] = useState(false);
  const state = useSyncExternalStore(cabinetRemindersEnabled ? cabinetReminders().subscribe : noopSubscribe,
    () => cabinetRemindersEnabled ? cabinetReminders().getState() : empty, () => empty);
  const local = useSyncExternalStore(f => { deviceListeners.add(f); return () => { deviceListeners.delete(f); }; }, () => device, () => initialDevice);
  useEffect(() => {
    if (!cabinetRemindersEnabled) return;
    const controller = cabinetReminders();
    let alive = true, signature = '';
    const ownerChanged = () => {
      const c = cabinetSession().reminderContext();
      const next = [c.generation, c.grantId, c.accountId, c.status, c.signIn].join(':');
      const refresh = c.status === 'active' && c.signIn === 'idle' && signature !== next;
      signature = next;
      void controller.attach().then(() => { if (alive && refresh) void controller.refresh(); });
    };
    const unsubscribe = cabinetSession().subscribe(ownerChanged);
    const refresh = async () => {
      if (Date.now() < controller.getState().retryAt) return;
      await cabinetSession().restore();
      if (!alive) return;
      try { controller.setOnline(networkOnline(await Network.getNetworkStateAsync())); }
      catch { controller.setOnline(false); }
      await controller.refresh();
    };
    void refresh().finally(() => { if (alive) setBooting(false); });
    const network = Network.addNetworkStateListener(value => {
      controller.setOnline(networkOnline(value));
      if (networkOnline(value) && AppState.currentState === 'active') void controller.refresh();
    });
    const subscription = AppState.addEventListener('change', status => { if (status === 'active') void refresh(); });
    const timer = setInterval(() => { if (AppState.currentState === 'active') void refresh(); }, 300000);
    const clock = setInterval(() => setNow(Date.now()), 30000);
    return () => { alive = false; unsubscribe(); network.remove(); subscription.remove(); clearInterval(timer); clearInterval(clock); };
  }, []);
  const refresh = async () => {
    if (!cabinetRemindersEnabled) return;
    if (Date.now() < cabinetReminders().getState().retryAt) return;
    await cabinetSession().restore();
    try { cabinetReminders().setOnline(networkOnline(await Network.getNetworkStateAsync())); }
    catch { cabinetReminders().setOnline(false); }
    await cabinetReminders().refresh();
  };
  const save = async (changes: ReminderChange[]) => {
    if (preflight.current || !cabinetReminders().canEdit()) return false;
    preflight.current = true; setCheckingSave(true);
    const expected = cabinetSession().reminderContext();
    try {
      // Recheck native connectivity immediately before a deliberate mutation.
      try { cabinetReminders().setOnline(networkOnline(await Network.getNetworkStateAsync())); }
      catch { cabinetReminders().setOnline(false); }
      const current = cabinetSession().reminderContext();
      if (current.issuer !== expected.issuer || current.generation !== expected.generation ||
          current.accountId !== expected.accountId || current.grantId !== expected.grantId ||
          current.logoutVersion !== expected.logoutVersion) return false;
      return await cabinetReminders().save(changes);
    } finally { preflight.current = false; setCheckingSave(false); }
  };
  const setEnabled = async (value: boolean) => {
    const scope = state.scope, grant = cabinetSession().reminderContext().grantId;
    if (!scope) return;
    const allowed = value ? await notificationPermission(true) : await notificationPermission();
    const key = reminderCacheKey(scope);
    if (cabinetReminders().getState().scope?.accountId !== scope.accountId ||
        cabinetReminders().getState().scope?.issuer !== scope.issuer ||
        cabinetSession().reminderContext().grantId !== grant) return;
    await AsyncStorage.setItem(key + '.delivery', value && allowed ? '1' : '0');
    await cabinetReminders().reconcile();
  };
  return { ...state, device: local, now, refresh, save, setEnabled, signOut: signOutCabinet,
    accountMode: cabinetRemindersEnabled && (booting || account.hasSession || !!state.scope),
    // Derive render state from reactive snapshots. React Compiler may memoize a
    // zero-argument singleton getter and retain its initial disabled value.
    canEdit: cabinetRemindersEnabled && !checkingSave && !!state.scope && !!state.confirmed && state.online &&
      state.phase === 'ready' && !state.loading && now >= state.retryAt &&
      account.status === 'active' && account.signIn === 'idle' && account.account?.id === state.scope.accountId };
}
export type SharedReminderModel = ReturnType<typeof useCabinetReminders>;
