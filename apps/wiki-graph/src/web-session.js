// Browser cookies are delivered by fetch; JS never reads/persists a credential.
const CABINET_ORIGINS = Object.freeze({ production: 'https://xuanxue.su', staging: 'https://staging.xuanxue.su' });
export function cabinetOrigin(profile = 'production') {
  if (!Object.hasOwn(CABINET_ORIGINS, profile)) throw new Error('Invalid web profile');
  return CABINET_ORIGINS[profile];
}
export function cabinetLogout(profile = 'production') { return cabinetOrigin(profile) + '/logout'; }
export function cabinetEntry(location, profile = 'production') {
  const destination = location.pathname + location.search + location.hash;
  if (!destination.startsWith('/') || destination.startsWith('//') || /[\\\x00-\x1f\x7f]/.test(destination) ||
      new TextEncoder().encode(destination).length > 1024) throw new Error('Invalid wiki destination');
  return cabinetOrigin(profile) + '/wiki?' + new URLSearchParams({ returnTo: destination });
}
export const CABINET_LOGOUT = 'https://xuanxue.su/logout';

export function createWebSessionReader({ fetch: request, suspend, failure, timeoutMs = 15000 }) {
  let epoch = 0;
  const pending = new Set();
  function invalidate() {
    ++epoch;
    for (const abort of pending) abort.abort();
    pending.clear();
    suspend();
  }
  async function read(path) {
    if (!path.startsWith('/api/wiki/') || /[\\#\x00-\x1f\x7f]/.test(path)) throw new Error('Invalid reader path');
    const own = epoch, abort = new AbortController(); pending.add(abort);
    let timer;
    try {
      const work = async () => {
        const response = await request(path, { credentials: 'same-origin', cache: 'no-store',
          redirect: 'error', signal: abort.signal });
        if (path === '/api/wiki/session' && response.status === 204 && await response.text() === '') return null;
        if (response.status === 401 || response.status === 403) throw { status: response.status };
        if (response.status === 404) throw { status: 404, missing: true, message: '404' };
        if (path === '/api/wiki/session') throw { status: 503 };
        if (response.status !== 200 || !response.headers.get('content-type')?.startsWith('application/json')) throw { status: 503 };
        const value = await response.json();
        if (!value || typeof value !== 'object') throw { status: 503 };
        return value;
      };
      const value = await Promise.race([work(), new Promise((_, reject) => {
        timer = setTimeout(() => { abort.abort(); reject({ status: 503 }); }, timeoutMs);
        abort.signal.addEventListener('abort', () => reject({ stale: own !== epoch, status: 503 }), { once: true });
      })]);
      if (own !== epoch) throw { stale: true };
      return value;
    } catch (error) {
      if (own !== epoch || error?.stale) throw { stale: true };
      if (error?.missing) throw error;
      const status = error?.status === 401 || error?.status === 403 ? error.status : 503;
      invalidate();
      failure(status);
      throw { status, handled: true };
    } finally {
      clearTimeout(timer);
      pending.delete(abort);
    }
  }
  return { read, invalidate };
}
