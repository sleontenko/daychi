import { useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Organic as C } from '../prototype/theme';
import type { Occurrence } from './model';
import { classInfo } from './class-info';
import { googleCalendarURL, nativeCalendarEvent } from './calendar-model';

export default function CalendarExport({ event, weekly }: { event: Occurrence; weekly: boolean }) {
  const [open, setOpen] = useState(false), [override, setOverride] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const lock = useRef(false);
  const repeat = override ?? weekly;
  const info = classInfo(event.title), location = info.location || info.format;
  async function exportEvent(native: boolean) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setMessage('');
    try {
      if (native) {
        // Explicit legacy entry point: its form supports timeZone without reading calendars.
        const Calendar = await import('expo-calendar/legacy');
        if (Platform.OS === 'ios' && Number.parseInt(String(Platform.Version), 10) < 17) {
          const permission = await Calendar.requestCalendarPermissionsAsync();
          if (!permission.granted) { setMessage('Доступ к календарю отключён. Разреши его в настройках iPhone или выбери Google Calendar.'); return; }
        }
        const result = await Calendar.createEventInCalendarAsync({ ...nativeCalendarEvent(event, location),
          ...(repeat ? { recurrenceRule: { frequency: Calendar.Frequency.WEEKLY, interval: 1 } } : {}) });
        if (Platform.OS === 'android') setMessage('Проверь сохранение в приложении календаря.');
        else if (result.action === 'saved') setMessage('Событие добавлено в календарь.');
      } else {
        await Linking.openURL(googleCalendarURL(event, repeat, location));
        setMessage('Сохрани событие в открывшемся Google Calendar.');
      }
    } catch { setMessage('Не удалось открыть календарь. Попробуй ещё раз или выбери другой.'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <View style={s.section}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(x => !x)} style={s.button}>
      <Text style={s.label}>{open ? 'Скрыть выбор календаря' : 'Добавить в календарь'}</Text></Pressable>
    {open && <>
      <View style={s.options}>{[[false, 'Эта дата'], [true, 'Каждую неделю']].map(([value, title]) =>
        <Pressable key={String(value)} accessibilityRole="button" accessibilityState={{ selected: repeat === value, disabled: busy }} disabled={busy}
          onPress={() => setOverride(value === true)} style={[s.button, repeat === value && s.selected]}>
          <Text style={[s.label, repeat === value && { color: C.white }]}>{title}</Text></Pressable>)}</View>
      {Platform.OS !== 'web' && <Pressable accessibilityRole="button" disabled={busy} style={s.button} onPress={() => void exportEvent(true)}>
        <Text style={s.label}>{Platform.OS === 'ios' ? 'Календарь iPhone / iCloud' : 'Календарь телефона'}</Text></Pressable>}
      <Pressable accessibilityRole="button" disabled={busy} style={s.button} onPress={() => void exportEvent(false)}>
        <Text style={s.label}>Google Calendar</Text></Pressable>
      <Text style={s.caption}>Копия {repeat ? 'каждую неделю с этой даты' : 'на эту дату'}. Отмены, переносы и пропуски меняются в календаре отдельно. Повторное добавление может создать дубликат.</Text>
      {!!message && <Text accessibilityLiveRegion="polite" style={s.caption}>{message}</Text>}
    </>}
  </View>;
}
const s = StyleSheet.create({
  section: { gap: 12 }, options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { minHeight: 44, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: C.divider },
  selected: { backgroundColor: C.sageDark }, label: { fontSize: 16, color: C.accentDark, textAlign: 'center' },
  caption: { fontSize: 14, lineHeight: 21, color: '#68635B' },
});
