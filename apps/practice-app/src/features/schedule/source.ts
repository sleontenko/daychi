import { Parser } from 'htmlparser2';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { dayKey, decodeSchedule, type Schedule } from './model.ts';

export const SOURCE_URL = 'https://www.telaviv-taiji.com/kogda';
const days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
const hash = (text: string) => bytesToHex(sha256(new TextEncoder().encode(text)));

// Match the server importer, including its stable series identity. Never infer
// cancellations or silently accept a partially parsed week.
export function parseWeek(html: string) {
  if (html.length > 4_000_000) throw new Error('Unexpected source size');
  const groups: string[][] = [];
  let depth = 0, block = '', text = '', group: string[] = [];
  const parser = new Parser({
    onopentag(tag, attrs) {
      if (tag === 'div') {
        if (depth) depth++;
        else if (attrs['data-testid'] === 'richTextElement') { depth = 1; group = []; }
      }
      if (depth && ['h2', 'p'].includes(tag)) { block = tag; text = ''; }
      if (block && tag === 'br') text += ' ';
    },
    ontext(value) { if (block) text += value; },
    onclosetag(tag) {
      if (tag === block) {
        const line = text.replace(/\u200b/g, '').replace(/\s+/g, ' ').trim();
        if (line) group.push(line);
        block = '';
      }
      if (tag === 'div' && depth && --depth === 0) { groups.push(group); block = ''; }
    },
  }, { decodeEntities: true });
  parser.write(html); parser.end();
  const seen = new Set<number>(), ids = new Set<string>();
  const rows: { weekday: number; title: string; start: string; end: string; id: string }[] = [];
  for (const lines of groups) {
    const weekday = days.indexOf(lines[0]);
    if (weekday < 0) continue;
    if (seen.has(weekday) || lines.length < 2) throw new Error('Ambiguous weekday');
    seen.add(weekday);
    for (const line of lines.slice(1)) {
      const m = /^(\d{1,2})[.:](\d{2})\s*[-–—]\s*(\d{1,2})[.:](\d{2})\s+(.+)$/.exec(line);
      if (!m) throw new Error('Unrecognized class');
      const [h, min, eh, emin] = m.slice(1, 5).map(Number);
      if (h > 23 || eh > 23 || min > 59 || emin > 59 || eh * 60 + emin <= h * 60 + min)
        throw new Error('Invalid time');
      const id = hash(`${weekday}:${m[5]}`).slice(0, 20);
      if (ids.has(id)) throw new Error('Ambiguous class');
      ids.add(id);
      rows.push({ weekday, title: m[5], start: `${m[1].padStart(2, '0')}:${m[2]}`,
        end: `${m[3].padStart(2, '0')}:${m[4]}`, id });
    }
  }
  if (seen.size !== 7) throw new Error('Incomplete timetable');
  return rows.sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
}

export function schoolInstant(day: string, time: string): string {
  const wall = Date.parse(`${day}T${time}:00Z`);
  let value = wall;
  // Resolve Israel UTC offset on the occurrence date, not today's/device offset.
  const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(formatter.formatToParts(value).map(part => [part.type, part.value]));
    const represented = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`);
    const next = value + wall - represented;
    if (next === value) return new Date(value).toISOString();
    value = next;
  }
  throw new Error('Ambiguous school time');
}

export function scheduleFromHTML(html: string, now = Date.now()): Schedule {
  const rows = parseWeek(html);
  const today = dayKey(now);
  const occurrences = Array.from({ length: 14 }, (_, offset) => {
    const date = new Date(Date.parse(`${today}T12:00:00Z`) + offset * 86400000);
    const day = date.toISOString().slice(0, 10);
    return rows.filter(row => row.weekday === (date.getUTCDay() + 6) % 7).map(row => ({
      id: `${row.id}:${day}`, title: row.title, starts_at: schoolInstant(day, row.start),
      ends_at: schoolInstant(day, row.end), status: 'scheduled' as const,
    }));
  }).flat();
  return decodeSchedule({ revision: hash(JSON.stringify(rows)), fetched_at: new Date(now).toISOString(),
    valid_until: new Date(now + 300000).toISOString(), source_url: SOURCE_URL,
    timezone: 'Asia/Jerusalem', kind: 'weekly_template', exceptions_verified: false, occurrences });
}
