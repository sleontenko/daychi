import { dayKey, type Occurrence, type Schedule } from './model.ts';

import { schoolInstant } from './source.ts';

export type ZoomClass = { seriesId: string; weekday: number; start: string; url: string; password: string; end?: string };

// Match the stable source identity AND Jerusalem weekday/time. A moved class
// must be reviewed instead of accidentally opening another group's room.
export function zoomForOccurrence(event: Occurrence, classes: ZoomClass[]) {
  if (event.status === 'cancelled') return null;
  const day = dayKey(event.starts_at);
  const weekday = (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;
  const start = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(event.starts_at));
  const matches = classes.filter(row => `${row.seriesId}:${day}` === event.id && row.weekday === weekday && row.start === start);
  if (matches.length !== 1) return null;
  const row = matches[0];
  try {
    const url = new URL(row.url);
    if (url.protocol !== 'https:' || !['zoom.us', 'us02web.zoom.us'].includes(url.hostname) ||
        url.username || url.password || !/^\/j\/\d+$/.test(url.pathname)) return null;
  } catch { return null; }
  return row;
}

// Apply the owner's Telegram corrections to either live source or restored cache.
// Keep identity, selection and cancellation state; never change the start time.
export function applyTelegramTimes(schedule: Schedule, classes: ZoomClass[]): Schedule {
  return { ...schedule, occurrences: schedule.occurrences.map(event => {
    const row = zoomForOccurrence(event, classes);
    if (!row?.end) return event;
    const end = schoolInstant(dayKey(event.starts_at), row.end);
    return Date.parse(end) > Date.parse(event.starts_at) ? { ...event, ends_at: end } : event;
  }) };
}
