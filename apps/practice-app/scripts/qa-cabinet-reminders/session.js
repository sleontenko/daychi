import { useSyncExternalStore } from 'react';
import { createAccountSession } from '../../src/features/cabinet-account/session-core';
import { createAccountClient } from '../../src/features/cabinet-account/client';
import { CALLBACK } from '../../src/features/cabinet-account/protocol';
const origin = 'https://staging.xuanxue.su', storage = new Map();
storage.set('daychi.cabinet.account.v1.staging', JSON.stringify({ version: 1, issuer: origin, pending: null,
  session: { token: 'synthetic_token_123456789', grant: 'synthetic_grant_123456', savedAt: Date.now(), expiresAt: Date.now() + 7776000000, renewAt: Date.now() + 604801000 } }));
const session = createAccountSession({ origin, client: createAccountClient(origin),
  storage: { get: async key => storage.get(key) ?? null, set: async (key, value) => { storage.set(key, value); }, delete: async key => { storage.delete(key); } },
  random: async () => 'a'.repeat(43), challenge: async () => 'b'.repeat(43),
});
export const cabinetAccountEnabled = true;
export const cabinetSession = () => session;
export const useCabinetAccount = () => useSyncExternalStore(session.subscribe, session.getState, session.getState);
export const signOutCabinet = () => session.logout();
export const cancelCabinetSignIn = () => session.cancel();
export const redirectCabinetCallback = async () => null;
export async function signInCabinet() {
  const attempt = await session.begin();
  if (attempt) await session.receive(CALLBACK + '?' + new URLSearchParams({ iss: origin, state: attempt.state, code: 'c'.repeat(43) }));
}
