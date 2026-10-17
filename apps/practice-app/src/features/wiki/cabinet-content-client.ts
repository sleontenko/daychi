import { CabinetError } from '../cabinet-account/protocol';

export const CONTENT_MISSING = Symbol('content-missing');

export function createCabinetContentClient(endpoint: string, request: typeof fetch = fetch, deadlineMs = 10000) {
  const base = new URL(endpoint);
  if (base.protocol !== 'https:' || base.username || base.password || base.pathname !== '/' ||
      base.search || base.hash || ['wiki.xuanxue.su', 'wiki.staging.xuanxue.su'].includes(base.hostname.replace(/\.$/, '')) ||
      !Number.isFinite(deadlineMs) || deadlineMs <= 0 || deadlineMs > 10000) throw new CabinetError('configuration');
  return async function read<T>(path: string, bearer: string): Promise<T | typeof CONTENT_MISSING> {
    const url = new URL(base.origin + '/api/native/wiki' + path);
    if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\') || url.hash ||
        url.origin !== base.origin || !url.pathname.startsWith('/api/native/wiki/')) throw new CabinetError('configuration');
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { abort.abort(); reject(new CabinetError('temporarily_unavailable')); }, deadlineMs);
    });
    try {
      return await Promise.race([deadline, (async () => {
        const response = await request(url.href, {
          method: 'GET', credentials: 'omit', redirect: 'error', cache: 'no-store', signal: abort.signal,
          headers: { Authorization: 'Bearer ' + bearer, Accept: 'application/json' },
        });
        if (response.url && response.url !== url.href) throw new CabinetError('temporarily_unavailable');
        if (response.status === 404) return CONTENT_MISSING;
        if (response.status === 401) throw new CabinetError('invalid_token');
        if (response.status === 403) throw new CabinetError('account_blocked');
        if (response.status === 429 || (response.status === 503 && response.headers.has('Retry-After'))) {
          const delay = response.headers.get('Retry-After') ?? '';
          throw new CabinetError('rate_limited', /^[0-9]{1,2}$/.test(delay) && +delay >= 1 && +delay <= 60 ? +delay : 60);
        }
        if (response.status !== 200 ||
            response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
          throw new CabinetError('temporarily_unavailable');
        }
        return await response.json() as T;
      })()]);
    } catch (error) {
      throw error instanceof CabinetError ? error : new CabinetError('temporarily_unavailable');
    } finally { clearTimeout(timer!); }
  };
}
