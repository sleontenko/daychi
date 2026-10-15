import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

// Keep deletion capabilities even when content access is revoked or signed out.
// Each Keychain value stays under 2 KiB, including the index of 50 proofs.
const PREFIX = 'daychee.access.deletion.v1.';
const INDEX = PREFIX + 'index';
const OPERATION = PREFIX + 'operation';
const endpoint = process.env.EXPO_PUBLIC_DAYCHEE_API_URL ?? '';
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const valid = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{43,128}$/.test(value);
type Operation = { id: string; proofs: string[]; confirmed: boolean };
let writes = Promise.resolve();
let changes = Promise.resolve();
let flight: Promise<void> | undefined;
export function withAccessMutation<T>(action: () => Promise<T>): Promise<T> {
  const next = changes.then(async () => {
    if (await hasPendingDeletion()) throw new Error('Сначала завершите начатое удаление данных.');
    return action();
  });
  changes = next.then(() => {}, () => {});
  return next;
}
function exclusive<T>(action: () => Promise<T>): Promise<T> {
  const next = writes.then(action);
  writes = next.then(() => {}, () => {});
  return next;
}
async function index() {
  const raw = await SecureStore.getItemAsync(INDEX);
  const value: unknown = raw ? JSON.parse(raw) : [];
  if (!Array.isArray(value) || value.length > 50 || !value.every(id => typeof id === 'string' && /^[a-f0-9]{24}$/.test(id))) throw new Error('Не удалось прочитать ключи удаления. Повторите попытку.');
  return [...new Set(value)] as string[];
}
async function operation(): Promise<Operation | null> {
  const raw = await SecureStore.getItemAsync(OPERATION);
  if (!raw) return null;
  const value = JSON.parse(raw) as Operation;
  if (!valid(value.id) || !Array.isArray(value.proofs) || !value.proofs.length || value.proofs.length > 50 ||
      !value.proofs.every(id => /^[a-f0-9]{24}$/.test(id)) || typeof value.confirmed !== 'boolean') throw new Error('Не удалось прочитать запрос удаления. Повторите попытку.');
  return value;
}
export function rememberDeletionCredential(value: string) {
  return exclusive(async () => {
    if (!valid(value)) throw new Error('Не удалось сохранить ключ удаления.');
    const id = (await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value)).slice(0, 24);
    const ids = await index();
    const pending = await operation();
    if (pending && !pending.proofs.includes(id)) throw new Error('Сначала завершите начатое удаление данных.');
    if (ids.includes(id)) {
      if (await SecureStore.getItemAsync(PREFIX + id) !== value) throw new Error('Не удалось прочитать ключ удаления.');
      return;
    }
    if (ids.length === 50) throw new Error('Сначала удалите данные прежних заявок на этом телефоне.');
    // Never expose a grant/request to the server before both writes succeed.
    await SecureStore.setItemAsync(PREFIX + id, value, options);
    await SecureStore.setItemAsync(INDEX, JSON.stringify([...ids, id]), options);
  });
}
export async function hasPendingDeletion() { await writes; return (await operation()) !== null; }
export async function hasDeletionCredentials() { await writes; return (await index()).length !== 0; }

// cleanup removes only access secrets and the personal request draft. Its caller
// must serialize auth/request changes; it must preserve classes and bookmarks.
// This transport is prepared independently of the not-yet-approved screen.
export function deleteAccessData(cleanup: () => Promise<void>): Promise<void> {
  if (flight) return flight;
  flight = changes.then(() => exclusive(async () => {
    let pending = await operation();
    if (!pending) {
      const proofs = await index();
      if (!proofs.length) throw new Error('На этом телефоне нет сохранённых ключей удаления.');
      const id = Array.from(await Crypto.getRandomBytesAsync(32), byte => byte.toString(16).padStart(2, '0')).join('');
      pending = { id, proofs, confirmed: false };
      await SecureStore.setItemAsync(OPERATION, JSON.stringify(pending), options);
    }
    if (!pending.confirmed) {
      const credentials = await Promise.all(pending.proofs.map(id => SecureStore.getItemAsync(PREFIX + id)));
      if (!credentials.every(valid)) throw new Error('Не удалось прочитать ключи удаления. Запрос сохранён.');
      if (!endpoint.startsWith('https://')) throw new Error('Сервис удаления пока не подключён. Запрос сохранён.');
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(endpoint.replace(/\/$/, '') + '/api/access/delete', {
          method: 'POST', cache: 'no-store', signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operation_id: pending.id, credentials }),
        });
        const value = await response.json();
        if (!response.ok || value?.deleted !== true) throw new Error();
        pending = { ...pending, confirmed: true };
        // Record confirmation BEFORE local cleanup, so a crash halfway through
        // cleanup can finish after restart without needing erased proofs.
        await SecureStore.setItemAsync(OPERATION, JSON.stringify(pending), options);
      } catch {
        throw new Error('Не удалось подтвердить результат. Повторите тот же запрос удаления.');
      } finally { clearTimeout(timer); }
    }
    await cleanup();
    for (const id of pending.proofs) await SecureStore.deleteItemAsync(PREFIX + id);
    await SecureStore.setItemAsync(INDEX, JSON.stringify((await index()).filter(id => !pending.proofs.includes(id))), options);
    await SecureStore.deleteItemAsync(OPERATION);
  })).finally(() => { flight = undefined; });
  changes = flight.then(() => {}, () => {});
  return flight;
}
