import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { acceptApprovedSession } from './session';

const KEY = 'daychee.access.request.v1';
const endpoint = process.env.EXPO_PUBLIC_DAYCHEE_API_URL ?? '';
export type Profile = { first_name: string; last_name: string; telegram: string };
type Status = 'draft' | 'pending' | 'approved' | 'active' | 'rejected' | 'revoked' | 'signed_out';
type Record = { profile: Profile; secret?: string; session?: string; submitted?: boolean; status: Status };
type Snapshot = { record: Record; ready: boolean; busy: boolean; error: string; checked?: number };
let state: Snapshot = { record: { profile: { first_name: '', last_name: '', telegram: '' }, status: 'draft' }, ready: false, busy: false, error: '' };
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const publish = (patch: Partial<Snapshot>) => { state = { ...state, ...patch }; listeners.forEach(fn => fn()); };
let load: Promise<void> | undefined;
let writes = Promise.resolve();
export const useAccessRequest = () => useSyncExternalStore(subscribe, () => state, () => state);
function save(record: Record) {
  const raw = JSON.stringify(record);
  const next = writes.then(() => SecureStore.setItemAsync(KEY, raw, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY })).catch(() => {
    throw new Error('Не удалось сохранить заявку на телефоне. Повторите попытку.');
  });
  writes = next.catch(() => { publish({ error: 'Не удалось сохранить заявку на телефоне. Повторите попытку.' }); });
  return next;
}
export function loadAccessRequest() {
  if (load) return load;
  load = (async () => {
    if (Platform.OS === 'web') { publish({ ready: true, error: 'Заявка доступна в приложении на телефоне.' }); return; }
    try {
      const raw = await SecureStore.getItemAsync(KEY);
      if (raw) {
        const value = JSON.parse(raw) as Record;
        if (!value.profile || !['first_name', 'last_name', 'telegram'].every(key => typeof value.profile[key as keyof Profile] === 'string') ||
            !['draft','pending','approved','active','rejected','revoked','signed_out'].includes(value.status) ||
            (value.submitted && (!/^[\w-]{43,128}$/.test(value.secret ?? '') || !/^[\w-]{43,128}$/.test(value.session ?? '')))) throw new Error();
        publish({ record: value });
      }
      publish({ ready: true, error: '' });
    } catch { load = undefined; publish({ error: 'Не удалось прочитать сохранённую заявку. Повторите проверку.' }); }
  })();
  return load;
}
export function changeApplicant(key: keyof Profile, value: string) {
  if (!state.ready || state.busy || state.record.submitted) return;
  const record = { ...state.record, profile: { ...state.record.profile, [key]: value } };
  publish({ record, error: '' });
  void save(record).catch(() => {});
}
async function api(secret: string, path = '', body?: unknown) {
  if (!endpoint.startsWith('https://')) throw new Error('Сервис доступа пока не подключён.');
  const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 15000);
  try {
    const response = await fetch(endpoint.replace(/\/$/, '') + '/api/access/request' + path, {
      method: body === undefined ? 'GET' : 'POST', cache: 'no-store', signal: abort.signal,
      headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }).catch(() => {
      // Native Expo fetch can reject with an ordinary Error, not only TypeError.
      throw new Error('Нет ответа сервера. Заявка сохранена на телефоне — повторите попытку.');
    });
    const value = await response.json().catch(() => null);
    if (!response.ok) throw new Error(response.status === 404 ? 'Сервис пока не подтвердил заявку. Повторите отправку.' : typeof value?.detail === 'string' ? value.detail : 'Не удалось проверить заявку.');
    if (!['pending','approved','active','rejected','revoked','signed_out'].includes(value?.status)) throw new Error('Не удалось проверить ответ сервера.');
    return value.status as Status;
  } finally { clearTimeout(timer); }
}
async function operation(action: () => Promise<void>) {
  if (state.busy || !state.ready || Platform.OS === 'web') return;
  publish({ busy: true, error: '' });
  try { await action(); }
  catch (error) { publish({ error: error instanceof Error ? error.message : 'Не удалось проверить заявку.' }); }
  finally { publish({ busy: false }); }
}
async function applyStatus(status: Status) {
  let record = { ...state.record, status };
  if (status === 'approved' || (status === 'active' && state.record.status !== 'active')) {
    status = await api(record.secret!, '/claim', { session_token: record.session });
    record = { ...record, status };
    if (status === 'active') await acceptApprovedSession(record.session!);
  }
  await save(record);
  publish({ record, checked: Date.now() });
}
export async function submitAccessRequest() {
  await operation(async () => {
    let record = state.record;
    if (!record.submitted) {
      const profile = { first_name: record.profile.first_name.trim(), last_name: record.profile.last_name.trim(), telegram: record.profile.telegram.trim().replace(/^@/, '') };
      if (!profile.first_name || !profile.last_name) throw new Error('Укажите имя и фамилию.');
      if (profile.telegram && !/^[a-zA-Z][a-zA-Z0-9_]{3,31}$/.test(profile.telegram)) throw new Error('Введите Telegram в формате @имя или оставьте поле пустым.');
      const random = async () => Array.from(await Crypto.getRandomBytesAsync(32), byte => byte.toString(16).padStart(2, '0')).join('');
      record = { profile, status: 'draft', submitted: true, secret: await random(), session: await random() };
    }
    // This write MUST succeed before the server can see the request.
    await save(record); publish({ record });
    await applyStatus(await api(record.secret!, '', record.profile));
  });
}
export async function checkAccessRequest() {
  await loadAccessRequest();
  if (!state.record.submitted) return;
  await operation(async () => { await applyStatus(await api(state.record.secret!)); });
}
export async function newAccessRequest() {
  await operation(async () => {
    if (!['rejected','revoked','signed_out'].includes(state.record.status)) return;
    const record: Record = { profile: state.record.profile, status: 'draft' };
    await save(record); publish({ record, checked: undefined });
  });
}
