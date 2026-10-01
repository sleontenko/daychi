import { AccessError, invitationErrors } from './access-errors';
import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { isInvitationCode } from './invitation-code';

const KEY = 'daychee.access.session.v1';
const endpoint = process.env.EXPO_PUBLIC_DAYCHEE_API_URL ?? '';
type Access = 'loading' | 'locked' | 'active' | 'offline';
let status: Access = 'loading';
let token: string | null = null;
let generation = 0;
let authIntent = 0;
let storageWrites = Promise.resolve();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
function publish(value: Access) { status = value; listeners.forEach(listener => listener()); }
export function useAccess() { return useSyncExternalStore(subscribe, () => status, () => 'locked' as Access); }

function persistSession(value: string | null, intent: number, expectedToken?: string) {
  const write = storageWrites.then(async () => {
    if (intent !== authIntent || (expectedToken !== undefined && token !== expectedToken)) return;
    if (value) await SecureStore.setItemAsync(KEY, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    else await SecureStore.deleteItemAsync(KEY);
    if (intent === authIntent) { generation++; token = value; publish(value ? 'active' : 'locked'); }
  });
  storageWrites = write.catch(() => {});
  return write;
}

async function request<T>(path: string, body?: unknown, credential?: string): Promise<T> {
  if (!/^https:\/\//.test(endpoint)) throw new Error('Доступ ещё не подключён. Попросите организатора сообщить о готовности новой версии.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const result = await fetch(`${endpoint.replace(/\/$/, '')}${path}`, {
      method: body === undefined ? 'GET' : 'POST', signal: controller.signal, cache: 'no-store',
      headers: { 'Content-Type': 'application/json', ...(credential ? { Authorization: `Bearer ${credential}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }).catch((error: unknown) => {
      if (controller.signal.aborted) throw new Error('Сервер не ответил вовремя. Попробуйте ещё раз.');
      if (/TLS|SSL|secure connection|certificate/i.test(String(error))) {
        throw new Error('Не удалось установить защищённое соединение с сервером. Попробуйте другую сеть или сообщите организатору.');
      }
      throw new Error('Не удалось связаться с сервером. Проверьте интернет и попробуйте ещё раз.');
    });
    if (result.status === 401) {
      if (credential && credential === token) { generation++; publish('locked'); await persistSession(null, authIntent, credential); }
      if (path.startsWith('/api/access/redeem')) {
        const payload = await result.json().catch(() => ({}));
        const code = payload?.detail?.code;
        if (typeof code === 'string' && Object.hasOwn(invitationErrors, code)) throw new AccessError(code, invitationErrors[code].message);
      }
      throw new Error('Приглашение недействительно, использовано или доступ отозван. Попросите новое приглашение.');
    }
    if (!result.ok) throw new Error(result.status === 429 ? 'Слишком много попыток. Повторите позже.' : 'Сервис временно недоступен. Попробуйте ещё раз.');
    return await result.json();
  } finally { clearTimeout(timer); }
}
export async function restoreAccess() {
  const id = ++generation;
  if (Platform.OS === 'web') { publish('locked'); return; }
  publish('loading');
  try {
    await storageWrites;
    const saved = await SecureStore.getItemAsync(KEY);
    if (id !== generation) return;
    token = saved;
    if (!saved) { publish('locked'); return; }
    await request('/api/access/session', undefined, saved);
    if (id === generation) publish('active');
  } catch { if (id === generation) publish(token ? 'offline' : 'locked'); }
}
export function suspendAccess() { generation++; publish(token ? 'offline' : 'locked'); }
export async function acceptApprovedSession(approvedToken: string) {
  if (Platform.OS === 'web' || !/^[\w-]{43,128}$/.test(approvedToken)) throw new Error('Не удалось сохранить доступ.');
  // A pending request must not replace a newer personal invitation login.
  if (token && token !== approvedToken && (status === 'active' || status === 'offline')) return;
  const id = generation, intent = authIntent;
  // Keep a claim retryable until both server verification and Keychain succeed.
  await request('/api/access/session', undefined, approvedToken);
  if (id !== generation || intent !== authIntent) throw new Error('Доступ изменился. Повторите проверку заявки.');
  await persistSession(approvedToken, intent);
}
export async function redeemInvitation(invitation: string) {
  if (Platform.OS === 'web') throw new Error('Откройте приглашение в приложении на телефоне.');
  const intent = ++authIntent;
  const code = isInvitationCode(invitation);
  const result = await request<{ token: string }>(code ? '/api/access/redeem-code' : '/api/access/redeem', code ? { code: invitation } : { token: invitation });
  if (!/^[\w-]{32,128}$/.test(result.token)) throw new Error('Не удалось подтвердить доступ.');
  if (intent !== authIntent) throw new Error('Доступ изменился. Проверьте состояние входа.');
  await persistSession(result.token, intent);
}
export async function logoutAccess() {
  const intent = ++authIntent;
  if (token) await request('/api/access/logout', {}, token);
  await persistSession(null, intent);
}
export async function privateRequest<T>(path: string): Promise<T> {
  if (!token || status !== 'active') throw new Error('Для закрытых материалов нужен доступ по приглашению и интернет.');
  const id = generation;
  const result = await request<T>(path, undefined, token);
  if (id !== generation || status !== 'active') throw new Error('Доступ изменился. Откройте материал заново.');
  return result;
}

// Recheck without hiding an already open material on each successful heartbeat.
export async function verifyAccess() {
  if (!token || status !== 'active') return;
  const id = generation;
  try { await request('/api/access/session', undefined, token); }
  catch { if (id === generation) { generation++; publish(token ? 'offline' : 'locked'); } }
}
