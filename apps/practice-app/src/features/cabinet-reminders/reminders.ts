import type { PublicLesson } from '../schedule/cabinet-pilot';
import type { ReminderSnapshot } from './protocol';
import type { ReminderScope } from './controller';

export const ACCOUNT_REMINDER_PREFIX = 'daychi-cabinet:';
export const accountReminderPrefix = (scope: ReminderScope) =>
  `${ACCOUNT_REMINDER_PREFIX}${encodeURIComponent(scope.issuer)}:${encodeURIComponent(scope.accountId)}:`;
export type AccountReminder = { id: string; at: number; lesson: PublicLesson };

export function accountReminderPlan(scope: ReminderScope, snapshot: ReminderSnapshot | null,
  lessons: PublicLesson[], enabled: boolean, now: number): AccountReminder[] {
  if (!snapshot || !enabled) return [];
  const classes = new Set(snapshot.classIds), dates = new Set(snapshot.lessonIds);
  const minutes = snapshot.leadMinutes ?? snapshot.schoolMinutes;
  return lessons.filter(row => row.status === 'scheduled' && (classes.has(row.classId) || dates.has(row.id)) &&
      Date.parse(row.startsAt) > now)
    .map(lesson => ({ id: accountReminderPrefix(scope) + lesson.id, at: Date.parse(lesson.startsAt) - minutes * 60000, lesson }))
    .filter(item => item.at > now).sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
}

// The device has a bounded pending queue, not a bound on account choices. Always
// remove obsolete/moved/other-account and guest entries before filling that queue.
export async function reconcileAccountReminders(plan: AccountReminder[], scope: ReminderScope | null, port: {
  pending(): Promise<{ id: string; at: number; title: string; stale?: boolean }[]>;
  cancel(id: string): Promise<void>; schedule(item: AccountReminder): Promise<void>;
  current(): boolean; capacity: number; totalCapacity?: number; pauseGuest?: boolean; preserveCurrent?: boolean;
}) {
  if (!port.current()) return { scheduled: 0, eligible: plan.length, through: null as number | null };
  const pending = await port.pending();
  const owned = (id: string) => (id.startsWith(ACCOUNT_REMINDER_PREFIX) &&
    !(scope && port.preserveCurrent && id.startsWith(accountReminderPrefix(scope)))) ||
    ((!!scope || port.pauseGuest) && id.startsWith('quiet-class:'));
  const foreign = pending.filter(item => !owned(item.id)).length;
  const capacity = Math.max(0, Math.min(port.capacity, (port.totalCapacity ?? Infinity) - foreign));
  const target = scope ? plan.slice(0, capacity) : [];
  const desired = new Map(target.map(item => [item.id, item]));
  for (const item of pending) {
    if (!port.current()) return { scheduled: 0, eligible: plan.length, through: null };
    if (!owned(item.id)) continue;
    const next = desired.get(item.id);
    if (!next || item.stale || item.at !== next.at || item.title !== next.lesson.classTitle) await port.cancel(item.id);
  }
  for (const item of target) {
    if (!port.current()) return { scheduled: 0, eligible: plan.length, through: null };
    if (!pending.some(old => old.id === item.id && !old.stale && old.at === item.at && old.title === item.lesson.classTitle))
      await port.schedule(item);
  }
  if (!port.current()) return { scheduled: 0, eligible: plan.length, through: null };
  const confirmed = new Set((await port.pending()).map(item => item.id));
  if (target.some(item => !confirmed.has(item.id))) throw new Error('Device did not confirm reminder queue');
  return { scheduled: target.length, eligible: plan.length, through: target.at(-1)?.at ?? null };
}
