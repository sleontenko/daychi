// Unmounted preparation for Workshop17; no transport, storage or notification effects.
// https://github.com/dveyarangi/xuanxue-workshop/blob/67bb5dde5489a8e6594a9d978e5ed8d3ad703724/docs/contracts/reminder-sync.md
export const REMINDER_SYNC_PATH = '/api/me/notifications/lessons/sync';
export type LeadMinutes = 0 | 15 | 30 | 60 | 120 | null;
export type ClassSlot = { weekday: number; time: string; durationMin: number; everyWeeks?: 1 | 2 };
export type ReminderClass = { id: string; title: string; groupLabel: string; tz: string; slots: ClassSlot[] };
export type ReminderSnapshot = {
  version: 1; accountId: string; revision: string; classIds: string[]; lessonIds: string[];
  leadMinutes: LeadMinutes; schoolMinutes: number; classes: ReminderClass[];
};
export type ReminderChange = { kind: 'class' | 'lesson'; id: string; selected: boolean } |
  { kind: 'lead'; minutes: LeadMinutes };

// Do not retain raw provider values in errors, application state or diagnostics.
function invalid(): never { throw new Error('Invalid Cabinet reminder data'); }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}
const id = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{24}$/.test(value);
const lead = (value: unknown): value is LeadMinutes => value === null ||
  (typeof value === 'number' && [0, 15, 30, 60, 120].includes(value));
const revision = (value: unknown): value is string => typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value);
const exactFields = (raw: Record<string, unknown>, fields: string[]) =>
  Object.keys(raw).length === fields.length && fields.every(field => Object.hasOwn(raw, field));
function ids(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((item, index) =>
    !id(item) || (index > 0 && value[index - 1] >= item))) return invalid();
  return [...value];
}
function slot(value: unknown): ClassSlot {
  const raw = record(value);
  if (!Number.isInteger(raw.weekday) || Number(raw.weekday) < 0 || Number(raw.weekday) > 6 ||
      typeof raw.time !== 'string' || !/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(raw.time) ||
      !Number.isInteger(raw.durationMin) || Number(raw.durationMin) <= 0 ||
      (Object.hasOwn(raw, 'everyWeeks') && raw.everyWeeks !== 1 && raw.everyWeeks !== 2)) return invalid();
  return { weekday: raw.weekday as number, time: raw.time, durationMin: raw.durationMin as number,
    ...(Object.hasOwn(raw, 'everyWeeks') ? { everyWeeks: raw.everyWeeks as 1 | 2 } : {}) };
}
function catalogue(value: unknown): ReminderClass[] {
  if (!Array.isArray(value)) return invalid();
  const classes: ReminderClass[] = [];
  for (const item of value) {
    const raw = record(item);
    if (!id(raw.id) || (classes.length > 0 && classes[classes.length - 1].id >= raw.id) ||
        typeof raw.title !== 'string' || typeof raw.groupLabel !== 'string' ||
        typeof raw.tz !== 'string' || !raw.tz || /^[+-]/.test(raw.tz) || !Array.isArray(raw.slots)) return invalid();
    try { new Intl.DateTimeFormat('en', { timeZone: raw.tz }); } catch { return invalid(); }
    classes.push({ id: raw.id, title: raw.title, groupLabel: raw.groupLabel, tz: raw.tz, slots: raw.slots.map(slot) });
  }
  return classes;
}

// accountId is opaque: compare it with the existing credential owner's account,
// without normalizing it or deriving a local account from selection ObjectIds.
export function decodeReminderSnapshot(value: unknown, expectedAccountId: string): ReminderSnapshot {
  const raw = record(value);
  if (!expectedAccountId || typeof raw.accountId !== 'string' || raw.accountId !== expectedAccountId ||
      raw.version !== 1 || !revision(raw.revision) || !lead(raw.leadMinutes) ||
      !Number.isInteger(raw.schoolMinutes) || Number(raw.schoolMinutes) < 5 || Number(raw.schoolMinutes) > 1440)
    return invalid();
  const classIds = ids(raw.classIds), lessonIds = ids(raw.lessonIds);
  if (classIds.length > 50) return invalid();
  return { version: 1, accountId: raw.accountId, revision: raw.revision, classIds, lessonIds,
    leadMinutes: raw.leadMinutes, schoolMinutes: raw.schoolMinutes as number, classes: catalogue(raw.classes) };
}

// Decimal comparison avoids precision loss for revisions above Number.MAX_SAFE_INTEGER.
export function compareReminderRevisions(left: string, right: string): -1 | 0 | 1 {
  if (!revision(left) || !revision(right)) return invalid();
  if (left === right) return 0;
  return left.length !== right.length ? (left.length < right.length ? -1 : 1) : (left < right ? -1 : 1);
}

// The caller must also fence issuer/session generation. Equal revisions can refresh
// catalogue/school metadata; this function does not establish authentication.
export function acceptReminderSnapshot(current: ReminderSnapshot | null, value: unknown,
  expectedAccountId: string): ReminderSnapshot {
  const incoming = decodeReminderSnapshot(value, expectedAccountId);
  if (current && current.accountId !== expectedAccountId) return invalid();
  return current && compareReminderRevisions(incoming.revision, current.revision) < 0 ? current : incoming;
}

// Accept only deliberate specified-key batches. No snapshot PUT, timestamp, split,
// retry or queued intent is produced here. Existence/transaction checks are Cabinet's.
export function encodeReminderChanges(value: unknown): string {
  if (!Array.isArray(value) || value.length < 1 || value.length > 64) return invalid();
  const keys = new Set<string>();
  const changes: ReminderChange[] = value.map(item => {
    const raw = record(item);
    let change: ReminderChange, key: string;
    if (raw.kind === 'class' || raw.kind === 'lesson') {
      if (!exactFields(raw, ['kind', 'id', 'selected']) || !id(raw.id) || typeof raw.selected !== 'boolean') return invalid();
      key = `${raw.kind}:${raw.id}`;
      change = { kind: raw.kind, id: raw.id, selected: raw.selected };
    } else if (raw.kind === 'lead') {
      if (!exactFields(raw, ['kind', 'minutes']) || !lead(raw.minutes)) return invalid();
      key = 'lead'; change = { kind: 'lead', minutes: raw.minutes };
    } else return invalid();
    if (keys.has(key)) return invalid();
    keys.add(key);
    return change;
  });
  // All emitted strings are fixed ASCII keys/enums or validated ASCII ObjectIds.
  // With 64 keys the canonical payload is already well below 128 KiB.
  return JSON.stringify({ version: 1, changes });
}
