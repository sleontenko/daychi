// Unwired native integration preparation. Use only in a private native context,
// with the future agreed admission transport; never attach it to the public bridge.
// Cabinet account-session credentials remain private to their existing module.
import { createProtectedReader, type ProtectedReadResult } from '../../../../wiki-graph/src/protected-read.js';
import { externalSource, materialId, protectedSource } from './bridge';

export { createProtectedReader } from '../../../../wiki-graph/src/protected-read.js';
export type { ProtectedReadResult, ProtectedReadState } from '../../../../wiki-graph/src/protected-read.js';

export type ProtectedLinks = {
  id: string;
  links: { url: string; label: string; type: string }[];
  zoom_password: string | null;
};

export function protectedLinksDTO(value: unknown, identity: string): ProtectedLinks | null {
  if (!materialId(identity) || !value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (row.id !== identity || !Array.isArray(row.links) || row.links.length > 100 ||
      (row.zoom_password !== undefined && row.zoom_password !== null &&
        (typeof row.zoom_password !== 'string' || row.zoom_password.length > 1024))) return null;
  const links: ProtectedLinks['links'] = [];
  for (const value of row.links) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const link = value as Record<string, unknown>;
    if (typeof link.url !== 'string' || typeof link.label !== 'string' || link.label.length > 2048 ||
        typeof link.type !== 'string' || link.type.length > 64) return null;
    if (externalSource(link.url) && protectedSource(link.url)) {
      links.push({ url: link.url, label: link.label, type: link.type });
    }
  }
  return { id: identity, links, zoom_password: links.some(link =>
    ['zoom.us', 'zoom.com'].some(domain => {
      const host = new URL(link.url).hostname.toLowerCase().replace(/\.$/, '');
      return host === domain || host.endsWith('.' + domain);
    })) ? (row.zoom_password as string | null | undefined) ?? null : null };
}

export function createPreparedMaterialAccess(read: (id: string, signal: AbortSignal) => Promise<ProtectedReadResult>) {
  // No stored grant, account flag, HTTP endpoint or legacy fallback is accepted here.
  return createProtectedReader({ read, validate: protectedLinksDTO });
}
