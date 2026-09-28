import { classInfo } from './class-info';
import { SymbolView } from 'expo-symbols';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Organic as C } from '../prototype/theme';
import { type Attendance, isChosen, seriesId, subscribed } from './attendance';
import { type Occurrence, dayKey } from './model';

const format = (value: string | number, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Jerusalem', ...options }).format(new Date(value));
const time = (value: string) => format(value, { hour: '2-digit', minute: '2-digit' });
const every = ['Каждое воскресенье', 'Каждый понедельник', 'Каждый вторник', 'Каждую среду', 'Каждый четверг', 'Каждую пятницу', 'Каждую субботу'];
const arrow = <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={18} tintColor={C.sageDark} />;

export default function MyClasses({ all, prefs, now, disabled, cancelSeries, onCancelPrompt, onCancel, onOpen, onRestore, onSchedule }: {
  all: Occurrence[]; prefs: Attendance; now: number; disabled: boolean; cancelSeries: string | null;
  onCancelPrompt: (id: string | null) => void; onCancel: (id: string) => void;
  onOpen: (id: string) => void; onRestore: (id: string) => void; onSchedule: () => void;
}) {
  const { fontScale } = useWindowDimensions();
  const today = dayKey(now);
  const tomorrow = dayKey(Date.parse(`${today}T12:00:00Z`) + 86400000);
  const relative = (start: string, long = false) => dayKey(start) === today ? 'Сегодня' : dayKey(start) === tomorrow ? 'Завтра' : format(start, long ? { weekday: 'long', day: 'numeric', month: 'long' } : { weekday: 'short' });
  const subscriptions = Object.entries(prefs.subscriptions ?? {});
  const upcoming = all.filter(e => Date.parse(e.ends_at) > now).sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  const picked = upcoming.filter(e => isChosen(e, prefs));
  return <View style={s.page}>
    <Modal visible={!!cancelSeries} transparent animationType="slide" onRequestClose={() => onCancelPrompt(null)}>
      <SafeAreaProvider><View style={s.overlay}>
        <Pressable accessibilityRole="button" accessibilityLabel="Закрыть подтверждение" style={StyleSheet.absoluteFill} onPress={() => onCancelPrompt(null)} />
        <SafeAreaView edges={['bottom']} style={s.sheet}>
          <View style={s.row}><Text accessibilityRole="header" style={[s.title, s.flex]}>Больше не ходить каждую неделю?</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Закрыть" onPress={() => onCancelPrompt(null)} style={s.close}>
              <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={20} tintColor={C.accentDark} />
            </Pressable></View>
          <Text style={s.caption}>Регулярный выбор и будущие напоминания для этого занятия будут убраны.</Text>
          <Pressable accessibilityRole="button" disabled={disabled} style={s.primary} onPress={() => { if (cancelSeries) onCancel(cancelSeries); }}><Text style={s.primaryLabel}>Да, убрать регулярный выбор</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => onCancelPrompt(null)} style={s.restore}><Text style={s.link}>Оставить</Text></Pressable>
        </SafeAreaView>
      </View></SafeAreaProvider>
    </Modal>
    {!subscriptions.length && !picked.length && <View style={s.empty}>
      <Text style={s.emptyTitle}>Пока ничего не выбрано</Text>
      <Text style={s.caption}>Откройте занятие в расписании и нажмите «Начну ходить…» или «Пойду на эту дату».</Text>
      <Pressable accessibilityRole="button" onPress={onSchedule} style={s.primary}><Text style={s.primaryLabel}>Перейти к расписанию</Text></Pressable>
    </View>}
    {!!subscriptions.length && <View style={s.section}>
      <Text accessibilityRole="header" style={s.label}>РЕГУЛЯРНЫЕ ЗАНЯТИЯ · {subscriptions.length}</Text>
      {subscriptions.map(([id, subscription]) => {
        const events = upcoming.filter(e => seriesId(e.id) === id && subscribed(e, prefs));
        const next = events.find(e => isChosen(e, prefs) && e.status === 'scheduled');
        const sample = events[0] ?? all.find(e => seriesId(e.id) === id);
        const info = classInfo(sample?.title ?? subscription.title);
        const start = sample?.starts_at ?? subscription.startsAt;
        const weekday = new Date(`${dayKey(start)}T12:00:00Z`).getUTCDay();
        const skips = events.filter(e => prefs.skipped?.[e.id] && e.status === 'scheduled');
        const cancelled = events.filter(e => e.status === 'cancelled');
        return <View key={id} style={s.card}>
          <View style={[s.row, { alignItems: 'flex-start' }]}>
            <View style={s.content}><Text style={s.title}>{info.title}</Text>
              <Text style={s.every}>{every[weekday]} · {time(start)}{sample ? `–${time(sample.ends_at)}` : ''}</Text>
              <Text style={s.meta}>{info.format}{info.location ? ` · ${info.location}` : ''}</Text>
              <Text style={s.meta}>Хожу с {format(`${subscription.from}T12:00:00Z`, { day: 'numeric', month: 'long' })}</Text>
            </View>
            <SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }} size={22} tintColor="#586444" />
          </View>
          {!events.length && <Text style={s.absent}>Сейчас этой встречи нет в расписании на ближайшие 14 дней. Она остаётся в ваших регулярных — даты появятся, когда школа их добавит.</Text>}
          {next && <Pressable accessibilityRole="button" onPress={() => onOpen(next.id)} style={s.next}>
            <Text style={s.nextText}>Ближайшая: {relative(next.starts_at, true).toLowerCase()}, {time(next.starts_at)}</Text>{arrow}
          </Pressable>}
          {!!cancelled.length && <Text style={s.meta}>Школа отменила встречу: {cancelled.map(e => format(e.starts_at, { day: 'numeric', month: 'long' })).join(', ')}.</Text>}
          {skips.map(e => <View key={e.id} style={s.row}><Text style={[s.meta, s.flex]}>Пропускаю {format(e.starts_at, { day: 'numeric', month: 'long' })}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={`Вернуть ${format(e.starts_at, { day: 'numeric', month: 'long' })}: ${info.title}`} disabled={disabled || Date.parse(e.starts_at) <= now} onPress={() => onRestore(e.id)} style={s.restore}><Text style={s.link}>Вернуть</Text></Pressable></View>)}
          <Pressable accessibilityRole="button" disabled={disabled} style={s.cancel} onPress={() => onCancelPrompt(id)}><Text style={s.link}>Больше не ходить каждую неделю</Text></Pressable>

        </View>;
      })}
    </View>}
    {!!picked.length && <View style={s.section}>
      <Text accessibilityRole="header" style={s.label}>БЛИЖАЙШИЕ ВЫБРАННЫЕ ДАТЫ</Text>
      <View style={s.group}>{picked.map((e, i) => <Pressable key={e.id} accessibilityRole="button" onPress={() => onOpen(e.id)} style={[s.dateRow, i > 0 && s.separator, fontScale > 1.5 && s.large]}>
        <View style={[s.date, fontScale > 1.5 && s.largeDate]}><Text style={s.day}>{relative(e.starts_at)}</Text><Text style={s.shortDate}>{format(e.starts_at, { day: 'numeric', month: 'short' })}</Text></View>
        <View style={s.content}><Text style={s.dateTitle}>{classInfo(e.title).title}</Text><Text style={s.meta}>{time(e.starts_at)}–{time(e.ends_at)} · {subscribed(e, prefs) ? 'каждую неделю' : 'только эта дата'}{e.status === 'cancelled' ? ' · Отменено' : Date.parse(e.starts_at) <= now ? ' · Уже началось' : ''}</Text></View>{arrow}
      </Pressable>)}</View>
      <Text style={s.meta}>Показаны ближайшие 14 дней.</Text>
    </View>}
  </View>;
}
const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(32,30,29,0.3)' }, sheet: { backgroundColor: C.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 16 }, close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  page: { gap: 22 }, section: { gap: 10 }, label: { fontSize: 13, fontWeight: '600', letterSpacing: 0.39, color: '#645C50', paddingHorizontal: 4 },
  card: { backgroundColor: C.neutral100, borderRadius: 20, padding: 16, gap: 10 }, row: { flexDirection: 'row', gap: 10, alignItems: 'center' }, flex: { flex: 1 }, content: { flex: 1, gap: 3 },
  title: { fontSize: 17, lineHeight: 22, fontWeight: '600', color: C.text }, every: { fontSize: 15, lineHeight: 21, color: C.text }, meta: { fontSize: 14, lineHeight: 19, color: '#645C50' }, caption: { fontSize: 15, lineHeight: 22, color: '#645C50' },
  next: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: C.sageMuted }, nextText: { flex: 1, fontSize: 15, lineHeight: 20, fontWeight: '600', color: C.sageDeep },
  link: { color: C.accentDark, fontSize: 15, lineHeight: 20, fontWeight: '600' }, cancel: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 4 }, restore: { borderWidth: 1.5, borderColor: C.accentBorder, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
  absent: { padding: 12, borderRadius: 14, backgroundColor: C.neutral200, fontSize: 14, lineHeight: 20, color: C.text }, group: { backgroundColor: C.neutral100, borderRadius: 20, overflow: 'hidden' },
  dateRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 13, paddingHorizontal: 16, minHeight: 60 }, separator: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.divider }, date: { width: 66, gap: 2 }, day: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: C.text }, shortDate: { fontSize: 13, lineHeight: 18, color: '#645C50' }, dateTitle: { fontSize: 16, lineHeight: 21, fontWeight: '600', color: C.text }, large: { flexDirection: 'column' }, largeDate: { width: 'auto' },
  empty: { backgroundColor: C.neutral100, borderRadius: 24, padding: 22, gap: 10, alignItems: 'flex-start' }, emptyTitle: { fontSize: 19, fontWeight: '700', color: C.text }, primary: { minHeight: 50, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 999, backgroundColor: '#B2622D', justifyContent: 'center' }, primaryLabel: { fontSize: 17, fontWeight: '600', color: C.white },
});
