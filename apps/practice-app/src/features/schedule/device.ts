import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';

const KEY = 'quietpractice.device.v1';
export const scheduleEndpoint = process.env.EXPO_PUBLIC_SCHEDULE_API_URL ||
  'https://mac-mini-server.tail07600a.ts.net';

async function request(path: string, method: string, body?: unknown, credential?: string) {
  if (!scheduleEndpoint.startsWith('https://')) throw new Error('Для подключения нужен HTTPS.');
  const token = credential ?? await SecureStore.getItemAsync(KEY);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${scheduleEndpoint}/api/v1/device${path}`, {
      method, signal: controller.signal, headers: { 'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) throw new Error(response.status === 401
      ? 'Код истёк или устройство не авторизовано.' : 'Сервер не сохранил изменения. Повторите подключение.');
    return await response.json();
  } finally { clearTimeout(timeout); }
}

export async function isPaired() {
  return Platform.OS === 'ios' && !!await SecureStore.getItemAsync(KEY);
}

export async function pairDevice(code: string) {
  const result = await request('/pair', 'POST', { code: code.trim() }, '');
  if (typeof result.token !== 'string' || result.token.length < 32) throw new Error('Неверный ответ сервера.');
  await SecureStore.setItemAsync(KEY, result.token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function syncChoices(choices: Record<string, boolean>) {
  await request('/choices', 'PUT', { choices: Object.keys(choices).filter(id => choices[id]).map(id => ({
    occurrence_id: id, minutes_before: 30, reminders_enabled: true,
  })) });
}

export async function enablePush(choices: Record<string, boolean>) {
  if (Platform.OS !== 'ios') throw new Error('Push доступны в iOS-сборке.');
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) throw new Error('Разрешите уведомления в настройках iPhone.');
  await syncChoices(choices);
  const token = await Notifications.getDevicePushTokenAsync();
  if (token.type !== 'ios' || typeof token.data !== 'string') throw new Error('Не удалось зарегистрировать iPhone.');
  await request('/push', 'PUT', { token: token.data, enabled: true });
}

export async function disablePush() {
  await request('/push', 'PUT', { enabled: false });
}

export async function retireServerReminders() {
  if (!await isPaired()) return;
  await disablePush();
  await SecureStore.deleteItemAsync(KEY);
}
