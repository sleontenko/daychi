import { useEffect, useState } from 'react';
import { privateRequest, useAccess } from '../access/session';
import corrections from './time-corrections.json';
import type { Occurrence, Schedule } from './model';
import { dayKey } from './model';
import { schoolInstant } from './source';
import { zoomForOccurrence, type ZoomClass } from './zoom-model';

// Public timing corrections contain no room URLs or passwords.
export function telegramSchedule(schedule: Schedule): Schedule {
  return { ...schedule, occurrences: schedule.occurrences.map(event => {
    const day = dayKey(event.starts_at);
    const weekday = (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;
    const start = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(event.starts_at));
    const matches = corrections.filter(row => event.id === `${row.seriesId}:${day}` && row.weekday === weekday && row.start === start);
    if (matches.length !== 1 || event.status === 'cancelled') return event;
    const end = schoolInstant(day, matches[0].end);
    return Date.parse(end) > Date.parse(event.starts_at) ? { ...event, ends_at: end } : event;
  }) };
}
export function useClassZoom(event: Occurrence | undefined) {
  const access = useAccess();
  const [result, setResult] = useState<{ id: string; room: ZoomClass | null } | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (access !== 'active' || !event) {
      // Drop private in-memory data when access is suspended or the detail closes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResult(null); setError(''); return;
    }
    let active = true;
    privateRequest<ZoomClass[]>('/api/access/zoom').then(rows => {
      if (active) { setResult({ id: event.id, room: zoomForOccurrence(event, rows) }); setError(''); }
    }).catch(() => { if (active) setError('Не удалось загрузить подключение к занятию.'); });
    return () => { active = false; };
  }, [access, event, revision]);
  return { room: access === 'active' && result?.id === event?.id ? result?.room : null, error: access === 'active' ? error : '', retry: () => setRevision(x => x + 1) };
}
