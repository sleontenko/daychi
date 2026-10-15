// Workshop 3c98d4a5201710f8f777183dd7b61caefe47e2d5, native-account-session.
// Cabinet definitions: shared/src/native-auth.ts at 67d5cbd0041daa13c6973b657479e45a6716486f.
export const CALLBACK = 'su.xuanxue.daychi:/oauth/cabinet';
export const CLIENT_ID = 'daychi-native';
export const SCOPE = 'account:read';
export const ATTEMPT_MS = 900000;
export const ISSUERS = ['https://staging.xuanxue.su', 'https://xuanxue.su'] as const;
export type Issuer = typeof ISSUERS[number];
export type Failure = 'configuration' | 'network' | 'invalid-response' | 'storage' |
  'invalid_token' | 'account_blocked' | 'rate_limited' | 'temporarily_unavailable' |
  'server_error' | 'invalid_request' | 'invalid_client' | 'invalid_grant' |
  'unsupported_grant_type' | 'access_denied' | 'unsupported_response_type' |
  'invalid_scope' | 'interrupted' | 'expired';
export class CabinetError extends Error {
  constructor(readonly kind: Failure, readonly retrySeconds?: number) {
    // Never use URLs, response bodies or native error messages here.
    super('Cabinet account operation failed');
  }
}
export const hiddenTiles = ['nextLesson', 'notice', 'exams', 'payment', 'grading', 'events'] as const;
const roles = ['admin', 'teacher', 'assistant', 'accountant'];
export type Account = {
  id: string; name: string; roles: string[]; status: 'active';
  telegramLinked: boolean; botChatActive: boolean; hasEmail: boolean;
  email?: string; googleLinked: boolean; pendingEmail?: string;
  noTelegram: boolean; needsProfile: boolean; studentMode: boolean;
  canUseStudentMode: boolean; homeHiddenTiles: typeof hiddenTiles[number][];
};
export type TokenDTO = { access_token: string; token_type: 'Bearer'; scope: 'account:read';
  expires_in: number; renew_after: number; session_id: string };
export type MeDTO = { account: Account; session: { id: string; expires_in: number; renew_after: number } };
export type Pending = { issuer: Issuer; state: string; verifier: string;
  redirect: typeof CALLBACK; startedAt: number; phase: 'browser' | 'exchange' };
export const malformed = (): never => { throw new CabinetError('invalid-response'); };
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return malformed();
  return value as Record<string, unknown>;
}
export const opaque = (value: unknown): value is string => typeof value === 'string' &&
  value.length <= 1024 && /^[A-Za-z0-9._~+/-]+=*$/.test(value);
export const randomValue = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
export const grantID = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(value);
const seconds = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
export function issuer(value: string): Issuer {
  if (!ISSUERS.includes(value as Issuer)) throw new CabinetError('configuration');
  return value as Issuer;
}
function durations(raw: Record<string, unknown>) {
  if (!seconds(raw.expires_in) || raw.expires_in <= 0 || raw.expires_in > 7776000 ||
      !seconds(raw.renew_after) || raw.renew_after > 604801 || raw.renew_after >= raw.expires_in) return malformed();
  return { expires_in: raw.expires_in, renew_after: raw.renew_after };
}
export function tokenDTO(value: unknown): TokenDTO {
  const raw = record(value);
  if (!opaque(raw.access_token) || raw.token_type !== 'Bearer' || raw.scope !== SCOPE || !grantID(raw.session_id)) return malformed();
  return { ...durations(raw), access_token: raw.access_token, token_type: 'Bearer', scope: SCOPE, session_id: raw.session_id };
}
export function accountDTO(value: unknown): Account {
  const raw = record(value);
  const flags = ['telegramLinked', 'botChatActive', 'hasEmail', 'googleLinked', 'noTelegram', 'needsProfile', 'studentMode', 'canUseStudentMode'];
  if (typeof raw.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(raw.id) || typeof raw.name !== 'string' || raw.status !== 'active' ||
      flags.some(key => typeof raw[key] !== 'boolean') || !Array.isArray(raw.roles) || raw.roles.some(r => !roles.includes(r)) ||
      (raw.studentMode && raw.roles.length !== 0) ||
      (Object.hasOwn(raw, 'email') && typeof raw.email !== 'string') ||
      (Object.hasOwn(raw, 'pendingEmail') && typeof raw.pendingEmail !== 'string') ||
      raw.hasEmail !== Object.hasOwn(raw, 'email') || !Array.isArray(raw.homeHiddenTiles) ||
      raw.homeHiddenTiles.some((key, i, list) => !hiddenTiles.includes(key) || (i > 0 && hiddenTiles.indexOf(list[i - 1]) >= hiddenTiles.indexOf(key)))) return malformed();
  // Only declared profile fields enter application state. Extra wire fields are ignored.
  return Object.fromEntries(['id', 'name', 'roles', 'status', ...flags, 'email', 'pendingEmail', 'homeHiddenTiles']
    .filter(key => Object.hasOwn(raw, key)).map(key => [key, Array.isArray(raw[key]) ? [...raw[key]] : raw[key]])) as Account;
}
export function meDTO(value: unknown, expectedGrant: string): MeDTO {
  const raw = record(value), session = record(raw.session);
  if (!grantID(session.id) || session.id !== expectedGrant) return malformed();
  return { account: accountDTO(raw.account), session: { id: session.id, ...durations(session) } };
}
export function pendingValid(pending: Pending, now: number): boolean {
  return pending.issuer === issuer(pending.issuer) && pending.redirect === CALLBACK &&
    randomValue(pending.state) && randomValue(pending.verifier) && Number.isSafeInteger(pending.startedAt) &&
    now >= pending.startedAt && now - pending.startedAt < ATTEMPT_MS;
}
const callbackErrors = ['invalid_request', 'unsupported_response_type', 'invalid_scope', 'access_denied', 'temporarily_unavailable', 'server_error'];
export function callback(raw: string, pending: Pending, now: number): { code: string } | { error: Failure } | null {
  if (!pendingValid(pending, now) || pending.phase !== 'browser' || raw.includes('#') || raw.split('?')[0] !== CALLBACK) return null;
  try {
    const query = raw.slice(raw.indexOf('?') + 1), fields = new Map<string, string>();
    for (const part of query.split('&')) {
      const at = part.indexOf('=');
      if (at < 0) return null;
      const decode = (v: string) => decodeURIComponent(v.replace(/\+/g, ' '));
      const key = decode(part.slice(0, at)), value = decode(part.slice(at + 1));
      if (!value || fields.has(key)) return null;
      fields.set(key, value);
    }
    if (fields.size !== 3 || fields.get('state') !== pending.state || fields.get('iss') !== pending.issuer) return null;
    if (fields.has('code') && randomValue(fields.get('code'))) return { code: fields.get('code')! };
    if (fields.has('error') && callbackErrors.includes(fields.get('error')!)) return { error: fields.get('error') as Failure };
    return null;
  } catch { return null; }
}
export function authorizeURL(pending: Pending, challenge: string): string {
  if (!randomValue(challenge)) throw new CabinetError('configuration');
  const query = new URLSearchParams({ response_type: 'code', client_id: CLIENT_ID, redirect_uri: CALLBACK,
    scope: SCOPE, state: pending.state, code_challenge: challenge, code_challenge_method: 'S256' });
  return `${issuer(pending.issuer)}/auth/native/authorize?${query}`;
}
