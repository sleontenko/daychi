import { ATTEMPT_MS, CALLBACK, CabinetError, authorizeURL, callback, grantID, issuer,
  opaque, pendingValid, randomValue, record, type Account, type Failure, type Pending, type TokenDTO } from './protocol';
import type { createAccountClient } from './client';

type SavedSession = { token: string; grant: string; savedAt: number; expiresAt: number; renewAt: number };
type Saved = { version: 1; issuer: string; session: SavedSession | null; pending: Pending | null };
export type AccountState = {
  status: 'signed-out' | 'checking' | 'active' | 'blocked' | 'unavailable' | 'storage-error' | 'signout-incomplete';
  account: Account | null; hasSession: boolean; signIn: 'idle' | 'browser' | 'exchange';
  error: Failure | null; retryAt: number;
};
export type SecureStorage = { get(key: string): Promise<string | null>; set(key: string, value: string): Promise<void>; delete(key: string): Promise<void> };
export function createAccountSession({ origin, storage, client, random, challenge, now = Date.now }: {
  origin: string; storage: SecureStorage; client: ReturnType<typeof createAccountClient>;
  random: () => Promise<string>; challenge: (verifier: string) => Promise<string>; now?: () => number;
}) {
  const base = issuer(origin), key = `daychi.cabinet.account.v1.${base === 'https://xuanxue.su' ? 'production' : 'staging'}`;
  const empty = (): Saved => ({ version: 1, issuer: base, session: null, pending: null });
  let stored: Saved = empty(), initialized: Promise<void> | null = null;
  let epoch = 0, disabled = false, starting: number | null = null;
  let eligibleAttempt: string | null = null;
  let writes: Promise<unknown> = Promise.resolve();
  let check: { epoch: number; promise: Promise<void> } | null = null;
  let state: AccountState = { status: 'signed-out', account: null, hasSession: false, signIn: 'idle', error: null, retryAt: 0 };
  const listeners = new Set<() => void>();
  function publish(patch: Partial<AccountState>) {
    state = { ...state, ...patch };
    listeners.forEach(listener => listener());
  }
  const time = () => {
    const stamp = now();
    if (!Number.isSafeInteger(stamp) || stamp < 0) throw new CabinetError('expired');
    return stamp;
  };
  function decode(raw: string): Saved {
    try {
      const value = record(JSON.parse(raw));
      if (value.version !== 1 || value.issuer !== base || !Object.hasOwn(value, 'session') || !Object.hasOwn(value, 'pending')) throw Error();
      if (value.session !== null) {
        const s = record(value.session);
        if (!opaque(s.token) || !grantID(s.grant) || ![s.savedAt, s.expiresAt, s.renewAt].every(Number.isSafeInteger) ||
            Number(s.savedAt) < 0 || Number(s.expiresAt) <= Number(s.savedAt) || Number(s.renewAt) < Number(s.savedAt)) throw Error();
      }
      if (value.pending !== null) {
        const p = record(value.pending);
        if (p.issuer !== base || p.redirect !== CALLBACK || !randomValue(p.state) || !randomValue(p.verifier) ||
            !Number.isSafeInteger(p.startedAt) || Number(p.startedAt) < 0 || !['browser', 'exchange'].includes(String(p.phase))) throw Error();
      }
      return value as unknown as Saved;
    } catch { throw new CabinetError('storage'); }
  }
  function initialize(): Promise<void> {
    if (!initialized) {
      initialized = writes.then(async () => {
        try {
          const raw = await storage.get(key); stored = raw === null ? empty() : decode(raw);
          if (epoch === 0) eligibleAttempt = stored.pending?.state ?? null;
        }
        catch { throw new CabinetError('storage'); }
      }).catch(error => { initialized = null; throw error; });
    }
    return initialized;
  }
  function persist(next: () => Saved, expected: number, deleting = false, condition = () => true): Promise<boolean> {
    const write = writes.then(async () => {
      if (epoch !== expected || !condition()) return false;
      const value = next();
      try {
        if (deleting) await storage.delete(key); else await storage.set(key, JSON.stringify(value));
      } catch { throw new CabinetError('storage'); }
      // Reflect the actual completed write even when superseded during native IO.
      // A queued logout/new attempt sees and cleans up this durable predecessor.
      stored = value;
      return epoch === expected;
    });
    writes = write.catch(() => {});
    return write;
  }
  function saved(token: TokenDTO): SavedSession {
    const stamp = time();
    return { token: token.access_token, grant: token.session_id, savedAt: stamp,
      expiresAt: stamp + token.expires_in * 1000, renewAt: stamp + token.renew_after * 1000 };
  }
  const matching = (expected: number, token?: string) => epoch === expected && !disabled && (!token || stored.session?.token === token);
  async function fail(error: unknown, expected: number, token?: string) {
    if (!matching(expected, token)) return;
    const problem = error instanceof CabinetError ? error : new CabinetError('network');
    if (problem.kind === 'invalid_token' && token) {
      // A malformed 401 body cannot reach here. Never call the legacy 401 handler.
      try {
        if (!await persist(() => ({ ...stored, session: null }), expected)) return;
        publish({ status: 'signed-out', hasSession: false, account: null, error: problem.kind });
      } catch { publish({ status: 'storage-error', account: null, error: 'storage' }); }
    } else if (problem.kind === 'account_blocked' && token) {
      publish({ status: 'blocked', account: null, hasSession: true, error: problem.kind });
    } else {
      const retryAt = problem.kind === 'rate_limited' ? time() + problem.retrySeconds! * 1000 : state.retryAt;
      publish({ status: problem.kind === 'storage' ? 'storage-error' : stored.session ? 'unavailable' : 'signed-out',
        hasSession: Boolean(stored.session), error: problem.kind, retryAt });
    }
  }
  function rateCheck() {
    if (time() < state.retryAt) throw new CabinetError('rate_limited', Math.ceil((state.retryAt - time()) / 1000));
  }
  async function validate(expected: number) {
    const previous = stored.session;
    if (!previous || !matching(expected)) return;
    rateCheck();
    publish({ status: 'checking', hasSession: true, error: null });
    try {
      // Local metadata never authorizes use; only Cabinet's current response does.
      const profile = await client.me(previous.token, previous.grant);
      if (!matching(expected, previous.token)) return;
      publish({ status: 'active', account: profile.account, hasSession: true, error: null });
      if (profile.session.renew_after !== 0) return;
      const renewed = await client.renew(previous.token, previous.grant);
      if (!matching(expected, previous.token)) return;
      if (await persist(() => ({ ...stored, session: saved(renewed) }), expected)) publish({ status: 'active', error: null });
    } catch (error) { await fail(error, expected, previous.token); }
  }
  async function restore() {
    if (disabled || state.signIn === 'exchange') return;
    if (check?.epoch === epoch) return check.promise;
    const expected = epoch;
    const promise = (async () => {
      try {
        await initialize(); await writes;
        if (!matching(expected)) return;
        if (stored.pending && (!pendingValid(stored.pending, time()) || stored.pending.phase === 'exchange')) {
          const problem = stored.pending.phase === 'exchange' ? 'interrupted' : 'expired';
          if (!await persist(() => ({ ...stored, pending: null }), expected)) return;
          publish({ signIn: 'idle', error: problem });
        } else if (stored.pending) publish({ signIn: 'browser' });
        if (!stored.session) {
          publish({ status: 'signed-out', hasSession: false });
          return;
        }
        await validate(expected);
      } catch (error) { await fail(error, expected); }
    })().finally(() => { if (check?.epoch === expected) check = null; });
    check = { epoch: expected, promise };
    return promise;
  }
  async function begin(): Promise<{ url: string; state: string } | null> {
    const expected = ++epoch;
    starting = expected;
    eligibleAttempt = null;
    if (!disabled) publish({ signIn: 'browser', error: null });
    try {
      if (disabled) throw new CabinetError('storage');
      await initialize(); await writes;
      if (!matching(expected)) return null;
      rateCheck();
      // Retire the predecessor attempt durably before preparing its replacement.
      if (stored.pending && !await persist(() => ({ ...stored, pending: null }), expected)) return null;
      const startedAt = time(), [stateValue, verifier] = await Promise.all([random(), random()]);
      if (!randomValue(stateValue) || !randomValue(verifier)) throw new CabinetError('configuration');
      const pending: Pending = { issuer: base, state: stateValue, verifier, redirect: CALLBACK, startedAt, phase: 'browser' };
      const url = authorizeURL(pending, await challenge(verifier));
      if (!pendingValid(pending, time())) throw new CabinetError('expired');
      if (!await persist(() => ({ ...stored, pending }), expected)) return null;
      eligibleAttempt = stateValue;
      publish({ signIn: 'browser', error: null });
      return { url, state: stateValue };
    } catch (error) {
      if (epoch === expected) publish({ signIn: 'idle' });
      await fail(error, expected); return null;
    }
    finally { if (starting === expected) starting = null; }
  }
  async function cancel(attemptState?: string) {
    // Cancellation from an old browser must not cancel a newer attempt.
    const requestedAt = epoch;
    if (disabled) return;
    if (attemptState) {
      await initialize().catch(() => {});
      if (disabled || requestedAt !== epoch || starting !== null || stored.pending?.state !== attemptState) return;
    }
    const expected = ++epoch; // Explicit cancellation disables late work immediately.
    eligibleAttempt = null;
    publish({ signIn: 'idle' });
    try {
      await initialize().catch(() => {});
      if (await persist(() => ({ ...stored, pending: null }), expected)) {
        if (state.status === 'checking') publish({ status: stored.session ? 'unavailable' : 'signed-out' });
      }
    } catch (error) { await fail(error, expected); }
  }
  async function receive(raw: string): Promise<boolean> {
    const expected = epoch;
    try {
      if (disabled || starting !== null) return false;
      await initialize(); await writes;
      if (!matching(expected) || !stored.pending || eligibleAttempt !== stored.pending.state) return false;
      const pending = stored.pending, result = callback(raw, pending, time());
      if (!result) {
        if (!pendingValid(pending, time())) {
          if (await persist(() => ({ ...stored, pending: null }), expected)) {
            publish({ signIn: 'idle' }); await fail(new CabinetError('expired'), expected);
          }
        }
        return false;
      }
      if ('error' in result) {
        if (await persist(() => ({ ...stored, pending: null }), expected)) {
          publish({ signIn: 'idle' });
          eligibleAttempt = null;
          if (result.error !== 'access_denied') await fail(new CabinetError(result.error), expected);
        }
        return true;
      }
      rateCheck();
      // Durable single-use marker BEFORE sending the exchange. Duplicate callbacks
      // and crashes after dispatch cannot replay the code or recover its result.
      if (!await persist(() => ({ ...stored, pending: { ...pending, phase: 'exchange' } }), expected, false,
        () => stored.pending?.state === pending.state && stored.pending.phase === 'browser')) return true;
      eligibleAttempt = null;
      publish({ signIn: 'exchange', error: null });
      try {
        const token = await client.exchange(result.code, pending.verifier);
        if (!matching(expected)) return true;
        if (!await persist(() => ({ ...stored, session: saved(token), pending: null }), expected)) return true;
        publish({ signIn: 'idle', hasSession: true, account: null });
        await validate(expected);
      } catch (error) {
        // A failed secure write leaves the exchange marker for safe restart.
        // Remove the verifier when possible, retaining the usable predecessor.
        if (matching(expected)) {
          try { await persist(() => ({ ...stored, pending: null }), expected); }
          catch { error = new CabinetError('storage'); }
          publish({ signIn: 'idle' });
          await fail(error, expected);
        }
      }
      return true;
    } catch (error) { await fail(error, expected); return false; }
  }
  async function logout() {
    const expected = ++epoch;
    disabled = true;
    eligibleAttempt = null;
    publish({ status: 'signed-out', account: null, hasSession: false, signIn: 'idle', error: null });
    try {
      // Read failures do not prevent a secure delete. Never retain a revoke queue.
      await initialize().catch(() => {}); await writes;
      const token = stored.session?.token;
      if (token) void client.revoke(token).catch(() => {});
      if (await persist(empty, expected, true)) {
        disabled = false;
        publish({ status: 'signed-out', account: null, hasSession: false, signIn: 'idle', error: null, retryAt: 0 });
      }
    } catch {
      if (epoch === expected) publish({ status: 'signout-incomplete', error: 'storage' });
    }
  }
  function suspend() {
    // Browser login intentionally survives backgrounding. Invalidate only current
    // account reads; pending exchange/callback owns its epoch and durable marker.
    if (state.signIn !== 'idle') return;
    epoch++;
    if (stored.session && !disabled) publish({ status: 'unavailable' });
  }
  async function readContent<T>(read: (bearer: string) => Promise<T>): Promise<T> {
    await initialize(); await writes;
    const expected = epoch, token = stored.session?.token;
    if (!token || disabled) throw new CabinetError('invalid_token');
    rateCheck();
    try {
      const value = await read(token);
      if (!matching(expected, token)) throw new CabinetError('interrupted');
      return value;
    } catch (error) {
      await fail(error, expected, token);
      throw error;
    }
  }
  return { getState: () => state, subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    restore, begin, receive, cancel, logout, suspend, readContent,
    // Content credentials stay inside the epoch-bound session wrapper.
    attemptRemaining: () => stored.pending ? Math.max(0, ATTEMPT_MS - (time() - stored.pending.startedAt)) : 0,
  };
}
