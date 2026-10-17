import { CabinetError } from '../cabinet-account/protocol';
import { cabinetAccountEnabled, cabinetSession } from '../cabinet-account/session';
import { CONTENT_MISSING, createCabinetContentClient } from './cabinet-content-client';

// Explicit private transport, selected only by the separate protected host.
export const cabinetContentEnabled = process.env.EXPO_PUBLIC_CABINET_CONTENT_ENABLED === '1';
const endpoint = process.env.EXPO_PUBLIC_DAYCHEE_API_URL ?? '';
export async function cabinetWikiRequest<T>(path: string): Promise<T> {
  if (!cabinetContentEnabled || !cabinetAccountEnabled) throw new CabinetError('configuration');
  const read = createCabinetContentClient(endpoint);
  const value = await cabinetSession().readContent(token => read<T>(path, token));
  if (value === CONTENT_MISSING) throw new Error('404');
  return value;
}
