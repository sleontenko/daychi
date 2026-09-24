import { dayKey, type Occurrence } from './model.ts';

export type Subscription = { title: string; from: string; startsAt: string };
export type Attendance = {
  choices: Record<string, boolean>;
  subscriptions?: Record<string, Subscription>;
  skipped?: Record<string, boolean>;
};

// The importer uses weekday + title identity; time changes retain the series ID.
export function seriesId(id: string): string {
  return id.replace(/:\d{4}-\d{2}-\d{2}$/, '');
}

export function subscribed(event: Occurrence, prefs: Attendance): boolean {
  const subscription = prefs.subscriptions?.[seriesId(event.id)];
  return !!subscription && dayKey(event.starts_at) >= subscription.from;
}

export function isChosen(event: Occurrence, prefs: Attendance): boolean {
  return !prefs.skipped?.[event.id] && (!!prefs.choices[event.id] || subscribed(event, prefs));
}

export function decodeSubscriptions(value: unknown): Record<string, Subscription> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([id, row]) =>
    id.length > 0 && id.length < 200 && row && typeof row.title === 'string' &&
    typeof row.from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.from) &&
    typeof row.startsAt === 'string' && Number.isFinite(Date.parse(row.startsAt))));
}

export function chooseWeekly<T extends Attendance>(prefs: T, event: Occurrence): T {
  const id = seriesId(event.id), from = dayKey(event.starts_at);
  // Convert future one-off choices to the subscription so cancellation is unambiguous.
  const choices = Object.fromEntries(Object.entries(prefs.choices).filter(([key]) =>
    seriesId(key) !== id || key.slice(-10) < from));
  const skipped = Object.fromEntries(Object.entries(prefs.skipped ?? {}).filter(([key]) =>
    seriesId(key) !== id || key.slice(-10) < from));
  return { ...prefs, choices, skipped, subscriptions: { ...prefs.subscriptions,
    [id]: { title: event.title, from, startsAt: event.starts_at } } };
}

export function toggleDate<T extends Attendance>(prefs: T, event: Occurrence): T {
  const choices = { ...prefs.choices }, skipped = { ...prefs.skipped };
  if (isChosen(event, prefs)) {
    delete choices[event.id];
    if (subscribed(event, prefs)) skipped[event.id] = true;
  } else {
    delete skipped[event.id];
    if (!subscribed(event, prefs)) choices[event.id] = true;
  }
  return { ...prefs, choices, skipped };
}

export function cancelWeekly<T extends Attendance>(prefs: T, id: string): T {
  const subscriptions = { ...prefs.subscriptions };
  delete subscriptions[id];
  const skipped = Object.fromEntries(Object.entries(prefs.skipped ?? {}).filter(([key]) => seriesId(key) !== id));
  return { ...prefs, subscriptions, skipped };
}
