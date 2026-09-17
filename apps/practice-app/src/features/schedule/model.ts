export type Occurrence = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  status: 'scheduled' | 'cancelled';
};

export type Schedule = {
  revision: string;
  fetched_at: string;
  valid_until: string;
  source_url: string;
  timezone: 'Asia/Jerusalem';
  kind: 'weekly_template';
  exceptions_verified: boolean;
  occurrences: Occurrence[];
};

const awareDate = (value: unknown): value is string =>
  typeof value === 'string' && /(Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));

export function decodeSchedule(value: unknown): Schedule {
  const data = value as Partial<Schedule> | null;
  if (!data || typeof data.revision !== 'string' || !awareDate(data.fetched_at) ||
      !awareDate(data.valid_until) || Date.parse(data.valid_until) <= Date.parse(data.fetched_at) ||
      data.source_url !== 'https://www.telaviv-taiji.com/kogda' || data.timezone !== 'Asia/Jerusalem' ||
      data.kind !== 'weekly_template' || typeof data.exceptions_verified !== 'boolean' ||
      !Array.isArray(data.occurrences)) throw new Error('Некорректный ответ сервиса расписания');
  const ids = new Set<string>();
  for (const event of data.occurrences) {
    if (!event || typeof event.id !== 'string' || !event.id || ids.has(event.id) ||
        typeof event.title !== 'string' || !event.title || !awareDate(event.starts_at) ||
        !awareDate(event.ends_at) || Date.parse(event.ends_at) <= Date.parse(event.starts_at) ||
        !['scheduled', 'cancelled'].includes(event.status)) throw new Error('Некорректное занятие');
    ids.add(event.id);
  }
  return data as Schedule;
}

export function dayKey(value: string | number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(value));
}

export function isFresh(data: Schedule, now: number): boolean {
  return Date.parse(data.fetched_at) <= now && now < Date.parse(data.valid_until);
}

export function decodeChoices(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([key, selected]) =>
    key.length < 200 && selected === true));
}
