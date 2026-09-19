import { telegramSchedule } from './zoom';
import { Platform } from 'react-native';
import { decodeSchedule, type Schedule } from './model';
import { scheduleFromHTML, SOURCE_URL } from './source';

const endpoint = process.env.EXPO_PUBLIC_SCHEDULE_API_URL || 'https://mac-mini-server.tail07600a.ts.net';

async function get(url: string, html: boolean): Promise<Schedule> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) throw new Error('Source unavailable');
    return html ? scheduleFromHTML(await response.text()) : decodeSchedule(await response.json());
  } finally { clearTimeout(timer); }
}

export async function loadSchedule(): Promise<Schedule> {
  // Public school HTML has no CORS permission for web. Native iOS can read it
  // directly; race independent HTTPS paths, retaining certificate validation.
  const requests = [get(`${endpoint.replace(/\/$/, '')}/api/v1/schedule`, false)];
  if (Platform.OS !== 'web') requests.push(get(SOURCE_URL, true));
  return telegramSchedule(await Promise.any(requests));
}
