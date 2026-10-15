// The local web UI can request only public wiki DTOs. Tokens never cross this bridge.
export function publicWikiPath(value: unknown): string | null {
  if (value === '/api/wiki/graph') return '/graph';
  if (typeof value !== 'string') return null;
  const match = /^\/api\/wiki\/materials\/([A-Za-z0-9_-]{1,160})$/.exec(value);
  return match ? '/materials/' + match[1] : null;
}
export function materialId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,160}$/.test(value);
}
export function externalSource(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 4096) return false;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; }
  catch { return false; }
}
export function replyScript(id: string, value?: unknown, error?: string): string {
  const data = JSON.stringify({ id, value, error }).replace(/[<>&\u2028\u2029]/g, character => '\\u' + character.charCodeAt(0).toString(16).padStart(4, '0'));
  return `window.__daycheeReply(${data});true;`;
}
export function protectedSource(value: unknown): boolean {
  if (!externalSource(value)) return false;
  const host = new URL(value).hostname.toLowerCase().replace(/\.$/, '');
  return ['youtube.com', 'youtu.be', 'youtube-nocookie.com', 'zoom.us', 'zoom.com']
    .some(domain => host === domain || host.endsWith('.' + domain));
}
export function publicSource(value: unknown): value is string {
  return externalSource(value) && !protectedSource(value);
}
