import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { createAccountClient } from './client';
import { createAccountSession } from './session-core';
import { CALLBACK, type Account } from './protocol';

// Explicit native Release opt-in; the local pilot remains available in development.
export const cabinetAccountEnabled = Platform.OS !== 'web' &&
  (process.env.EXPO_PUBLIC_CABINET_ACCOUNT_ENABLED === '1' ||
    (__DEV__ && process.env.EXPO_PUBLIC_CABINET_ACCOUNT_PILOT === '1'));
const origin = process.env.EXPO_PUBLIC_CABINET_ACCOUNT_ORIGIN ?? 'https://staging.xuanxue.su';
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const base64url = (value: string) => value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
// Async native CSPRNG avoids the synchronous debugger's Math.random fallback.
async function random() {
  const bytes = await Crypto.getRandomBytesAsync(32);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let result = '', bits = 0, accumulator = 0;
  for (const byte of bytes) {
    accumulator = (accumulator << 8) | byte; bits += 8;
    while (bits >= 6) { bits -= 6; result += alphabet[(accumulator >>> bits) & 63]; }
  }
  if (bits) result += alphabet[(accumulator << (6 - bits)) & 63];
  return result;
}
let instance: ReturnType<typeof createAccountSession> | null = null;
export function cabinetSession() {
  if (!instance) instance = createAccountSession({ origin, client: createAccountClient(origin),
    storage: { get: key => SecureStore.getItemAsync(key, options),
      set: (key, value) => SecureStore.setItemAsync(key, value, options), delete: key => SecureStore.deleteItemAsync(key, options) },
    random, challenge: async value => base64url(await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value, { encoding: Crypto.CryptoEncoding.BASE64 })),
  });
  return instance;
}
const unavailable = { status: 'signed-out' as const, account: null as Account | null, hasSession: false,
  signIn: 'idle' as const, error: 'configuration' as const, retryAt: 0 };
export function useCabinetAccount() {
  return useSyncExternalStore(listener => cabinetAccountEnabled ? cabinetSession().subscribe(listener) : () => {},
    () => cabinetAccountEnabled ? cabinetSession().getState() : unavailable, () => unavailable);
}
let browser: { state: string; timer: ReturnType<typeof setTimeout> } | null = null;
function dismiss() {
  try {
    if (Platform.OS === 'ios') WebBrowser.dismissAuthSession(); else WebBrowser.dismissBrowser();
  } catch { /* Already closed. */ }
}
export async function signInCabinet() {
  if (!cabinetAccountEnabled || browser) return;
  const session = cabinetSession(), attempt = await session.begin();
  if (!attempt) return;
  const ownBrowser = { state: attempt.state, timer: setTimeout(() => { void cancelCabinetSignIn(); }, session.attemptRemaining()) };
  browser = ownBrowser;
  try {
    const result = await WebBrowser.openAuthSessionAsync(attempt.url, CALLBACK, { preferEphemeralSession: false });
    if (result.type === 'success') await session.receive(result.url);
    else await session.cancel(attempt.state);
  } catch { await session.cancel(attempt.state); }
  finally { clearTimeout(ownBrowser.timer); if (browser === ownBrowser) browser = null; }
}
export async function cancelCabinetSignIn() {
  if (!cabinetAccountEnabled) return;
  if (browser) { clearTimeout(browser.timer); browser = null; }
  // Invalidate responses before dismissing the system UI.
  await cabinetSession().cancel(); dismiss();
}
export async function signOutCabinet() {
  if (!cabinetAccountEnabled) return;
  if (browser) { clearTimeout(browser.timer); browser = null; }
  const complete = cabinetSession().logout(); dismiss(); await complete;
}
// Router invokes this before invitation handling. Strip even malformed callback
// variants so secrets cannot enter navigation parameters or history.
export async function redirectCabinetCallback(path: string): Promise<string | null> {
  if (!/^su\.xuanxue\.daychi:/i.test(path)) return null;
  if (!cabinetAccountEnabled) return '/';
  await cabinetSession().receive(path);
  return '/cabinet-account';
}
