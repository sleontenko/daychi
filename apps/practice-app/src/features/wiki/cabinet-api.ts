import { CabinetError } from '../cabinet-account/protocol';
import { cabinetAccountEnabled, cabinetSession } from '../cabinet-account/session';
import { createCabinetContentClient } from './cabinet-content-client';

// Explicit private transport. Never selected by the existing public WebView bridge.
// Mounting a protected reader is a separate UX/activation change.
const enabled = process.env.EXPO_PUBLIC_CABINET_CONTENT_ENABLED === '1';
const endpoint = process.env.EXPO_PUBLIC_DAYCHEE_API_URL ?? '';
export async function cabinetWikiRequest<T>(path: string): Promise<T> {
  if (!enabled || !cabinetAccountEnabled) throw new CabinetError('configuration');
  const read = createCabinetContentClient(endpoint);
  return cabinetSession().readContent(token => read<T>(path, token));
}
