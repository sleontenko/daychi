import type { Occurrence } from './model.ts';

export const CALENDAR_NOTE = 'Тихая практика · время Израиля. Копия расписания: отмены, переносы и пропуски в приложении не обновляют календарь. Изменяй или удаляй событие в календаре отдельно.';

// Local wall time plus IANA zone preserves school time across DST transitions.
export function calendarWallTime(value: string): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(value)).map(part => [part.type, part.value]));
  return `${parts.year}${parts.month}${parts.day}T${parts.hour}${parts.minute}${parts.second}`;
}

export function googleCalendarURL(event: Occurrence, weekly: boolean, location: string): string {
  const params = new URLSearchParams({ action: 'TEMPLATE', text: event.title,
    dates: `${calendarWallTime(event.starts_at)}/${calendarWallTime(event.ends_at)}`,
    ctz: 'Asia/Jerusalem', details: CALENDAR_NOTE, location });
  if (weekly) params.set('recur', 'RRULE:FREQ=WEEKLY');
  return `https://calendar.google.com/calendar/render?${params}`;
}

export function nativeCalendarEvent(event: Occurrence, location: string) {
  return { title: event.title, startDate: new Date(event.starts_at), endDate: new Date(event.ends_at),
    timeZone: 'Asia/Jerusalem', location, notes: CALENDAR_NOTE };
}
