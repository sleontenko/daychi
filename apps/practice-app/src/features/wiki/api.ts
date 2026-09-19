import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY = 'quietpractice.wiki.session.v1';
const endpoint = (process.env.EXPO_PUBLIC_WIKI_API_URL ?? '').replace(/\/$/, '');
let webToken: string | null = null;
export const readSession = () => Platform.OS === 'web' ? Promise.resolve(webToken) : SecureStore.getItemAsync(KEY);
export async function writeSession(token: string | null) {
  if (Platform.OS === 'web') { webToken = token; return; }
  if (token) await SecureStore.setItemAsync(KEY, token, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  else await SecureStore.deleteItemAsync(KEY);
}
export class WikiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function wikiRequest<T>(path: string, token?: string | null, body?: unknown): Promise<T> {
  if (!endpoint) throw new WikiError(503, 'Вики пока не подключена. Попробуйте позже.');
  if (!endpoint.startsWith('https://') && !(__DEV__ && /^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(endpoint))) {
    throw new WikiError(503, 'Не удалось безопасно подключиться к вики.');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${endpoint}/api/wiki${path}`, { method: body === undefined ? 'GET' : 'POST',
      signal: controller.signal, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body) });
    if (!response.ok) throw new WikiError(response.status, response.status === 401 ? 'Неверный логин или пароль. Войдите снова.'
      : response.status === 429 ? 'Много попыток входа. Попробуйте через 10 минут.'
      : response.status === 404 ? 'Материал больше не доступен.' : 'Вики временно недоступна. Попробуйте ещё раз.');
    return await response.json() as T;
  } catch (error) {
    if (error instanceof WikiError) throw error;
    throw new WikiError(0, 'Не удалось подключиться. Проверьте интернет и повторите.');
  } finally { clearTimeout(timeout); }
}
export type Summary = { id: string; title: string; date: string; category_name: string; subtopic: string };
export type Material = Summary & { description: string; links: { url: string; label: string; type: string }[]; zoom_password: string | null };
export type Category = { id: string; name: string; count: number; subtopics: { id: string; name: string; count: number }[] };
export type Results = { total: number; items: Summary[]; missing_ids?: string[] };
