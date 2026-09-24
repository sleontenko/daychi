// Capture before Router navigation: a newly mounted screen can miss the URL event.
// Keep the secret in memory, never in navigation params or persisted route state.
let invitation: string | undefined;
const listeners = new Set<() => void>();
export const getInvitation = () => invitation;
export function subscribeInvitation(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function clearInvitation() {
  invitation = undefined;
  listeners.forEach(listener => listener());
}
export function redirectInvitation(path: string): string {
  try {
    const url = new URL(path, 'quietpractice://');
    if (url.protocol !== 'quietpractice:' || !(
      (url.hostname === 'invite' && (url.pathname === '' || url.pathname === '/')) ||
      (!url.hostname && url.pathname === '/invite')
    )) return path;
    const candidate = url.hash.slice(1);
    invitation = /^[A-Za-z0-9_-]{32,128}$/.test(candidate) ? candidate : undefined;
    listeners.forEach(listener => listener());
    return '/invite';
  } catch { return '/'; }
}
