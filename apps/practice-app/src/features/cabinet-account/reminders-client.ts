import { CabinetError, issuer } from './protocol';
import { REMINDER_SYNC_PATH, encodeReminderChanges, type ReminderChange } from '../cabinet-reminders/protocol';

export class ReminderRequestError extends Error {
  constructor(readonly status: number, readonly retrySeconds = 0) { super('Cabinet reminder request failed'); }
}

// This transport is called only by the native credential owner. No renewal or
// mutation retry, redirects, cookies, raw errors or profile data reach the caller.
export function createReminderClient(origin: string, read: typeof fetch = globalThis.fetch, timeoutMs = 12000) {
  const url = issuer(origin) + REMINDER_SYNC_PATH;
  return async (token: string, changes?: ReminderChange[]): Promise<unknown> => {
    const body = changes === undefined ? undefined : encodeReminderChanges(changes);
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { abort.abort(); reject(new ReminderRequestError(0)); }, timeoutMs);
    });
    try {
      return await Promise.race([deadline, (async () => {
        const response = await read(url, { method: body === undefined ? 'GET' : 'PATCH', body,
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json',
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
          credentials: 'omit', cache: 'no-store', redirect: 'error', signal: abort.signal });
        // Route envelopes differ from native-auth envelopes. HTTP status still
        // governs lifecycle even when a refusal body is unknown or malformed.
        if (response.status === 401) throw new CabinetError('invalid_token');
        if (response.status === 403) throw new CabinetError('account_blocked');
        if (response.status !== 200) {
          const raw = response.headers.get('retry-after');
          let delay = raw && /^\d+$/.test(raw) ? Number(raw) : 0;
          if (raw && !/^\d+$/.test(raw)) delay = Math.max(0, Math.ceil((Date.parse(raw) - Date.now()) / 1000));
          throw new ReminderRequestError(response.status, Number.isSafeInteger(delay) ? delay : 0);
        }
        if (response.redirected || response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json' ||
            !response.headers.get('cache-control')?.toLowerCase().split(',').some(v => v.trim() === 'no-store'))
          throw new ReminderRequestError(0);
        return await response.json();
      })()]);
    } catch (error) {
      if (error instanceof CabinetError || error instanceof ReminderRequestError) throw error;
      throw new ReminderRequestError(0);
    } finally { clearTimeout(timer!); }
  };
}
