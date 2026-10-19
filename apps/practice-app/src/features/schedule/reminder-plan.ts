import type { Occurrence } from './model.ts';
import { isChosen, type Attendance } from './attendance.ts';

export type Preferences = Attendance & { enabled: boolean; lead: number };
export type PlannedReminder = { id: string; at: number; event: Occurrence };
export const REMINDER_PREFIX = 'quiet-class:';

export function reminderPlan(events: Occurrence[], prefs: Preferences, now: number): PlannedReminder[] {
  if (!prefs.enabled) return [];
  return events.filter(e => isChosen(e, prefs) && e.status === 'scheduled')
    .map(event => ({ id: `${REMINDER_PREFIX}${event.id}`, event,
      at: Date.parse(event.starts_at) - prefs.lead * 60000 }))
    .filter(item => item.at > now).sort((a, b) => a.at - b.at);
}

// Dependency-injected to test cancel/reschedule/error behaviour without iOS.
export async function reconcileReminders(plan: PlannedReminder[], port: {
  pending: () => Promise<{ id: string; at: number; title: string; stale?: boolean }[]>;
  cancel: (id: string) => Promise<void>;
  schedule: (item: PlannedReminder) => Promise<void>;
  current?: () => boolean;
}) {
  if (port.current && !port.current()) return 0;
  if (plan.length > 60) throw new Error('Не больше 60 напоминаний одновременно.');
  const existing = await port.pending();
  const desired = new Map(plan.map(item => [item.id, item]));
  for (const current of existing) {
    if (port.current && !port.current()) return 0;
    if (!current.id.startsWith(REMINDER_PREFIX)) continue;
    const next = desired.get(current.id);
    if (current.stale || !next || next.at !== current.at || next.event.title !== current.title) await port.cancel(current.id);
  }
  for (const next of plan) {
    if (port.current && !port.current()) return 0;
    if (!existing.some(item => !item.stale && item.id === next.id && item.at === next.at && item.title === next.event.title))
      await port.schedule(next);
    if (port.current && !port.current()) { await port.cancel(next.id); return 0; }
  }
  const confirmed = new Set((await port.pending()).map(item => item.id));
  if (plan.some(item => !confirmed.has(item.id))) throw new Error('Телефон не подтвердил напоминания. Повтори попытку.');
  return plan.length;
}
