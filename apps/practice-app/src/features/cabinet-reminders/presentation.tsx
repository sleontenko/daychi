import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Organic as C } from '../prototype/theme';
import { cabinetMatchesFormat, cabinetPresentation } from '../schedule/cabinet-presentation';
import { dayKey } from '../schedule/model';
import type { PublicLesson } from '../schedule/cabinet-pilot';
import type { FormatFilter } from '../schedule/class-info';
import type { SharedReminderModel } from './use-reminders';
import type { LeadMinutes } from './protocol';

const format = (value: string | number, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Jerusalem', ...options }).format(new Date(value));
const date = (value: string) => format(value, { weekday: 'long', day: 'numeric', month: 'long' });
const time = (value: string) => format(value, { hour: '2-digit', minute: '2-digit' });
function Button({ label, onPress, disabled = false, selected = false, filter = false }: {
  label: string; onPress: () => void; disabled?: boolean; selected?: boolean; filter?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled, selected }} disabled={disabled}
    onPress={onPress} style={({ pressed }) => [s.button, selected && (filter ? s.filterSelected : s.selected), (pressed || disabled) && s.disabled]}>
    <Text style={[s.link, selected && !filter && s.selectedLabel]}>{label}</Text>
  </Pressable>;
}
const chosen = (m: SharedReminderModel, row: PublicLesson) => !!m.confirmed &&
  (m.confirmed.classIds.includes(row.classId) || m.confirmed.lessonIds.includes(row.id));

export function AccountStatus({ model: m, onAccount }: { model: SharedReminderModel; onAccount: () => void }) {
  const delayed = m.now < m.retryAt;
  return <View style={s.section}>
    {(m.loading || m.phase === 'saving') && <View style={s.inline}><ActivityIndicator color={C.accentDark} />
      <Text style={s.caption}>{m.phase === 'saving' ? 'Сохраняем в Кабинете…' : 'Обновляем занятия и выбор…'}</Text></View>}
    {!m.online && <Text style={s.caption}>Без сети · сохранённые занятия доступны, изменения — после подключения.</Text>}
    {!!m.error && <Text accessibilityRole="alert" style={s.body}>{m.error}</Text>}
    {delayed && <Text style={s.caption}>Повторить можно после {format(m.retryAt, { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · время Израиля.</Text>}
    {(m.error || m.phase === 'uncertain' || (!m.confirmed && !m.loading)) && <Button label="Обновить выбор и расписание"
      disabled={m.loading || m.phase === 'saving' || delayed || !m.online} onPress={() => void m.refresh()} />}
    {m.phase === 'refused' && <><Button label="Проверить вход в Кабинет" onPress={onAccount} />
      <Button label="Продолжить без аккаунта" onPress={() => void m.signOut()} /></>}
  </View>;
}

function LessonRow({ row, model: m, onOpen }: { row: PublicLesson; model: SharedReminderModel; onOpen: (id: string) => void }) {
  const details = cabinetPresentation(row), selected = chosen(m, row);
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }}
    accessibilityLabel={`${date(row.startsAt)}, ${time(row.startsAt)}, ${row.classTitle}${selected ? ', выбрано' : ''}${row.status === 'cancelled' ? ', отменено' : ''}`}
    onPress={() => onOpen(row.id)} style={[s.row, selected && s.rowSelected]}>
    <View style={s.timeColumn}><Text style={s.time}>{time(row.startsAt)}</Text>
      {details.endsAt && <Text style={s.caption}>{time(details.endsAt)}</Text>}</View>
    <View style={s.flex}><Text style={s.lessonTitle}>{details.title}</Text><Text style={s.caption}>{details.meta}</Text>
      {!!details.description && <Text style={s.caption}>{details.description}</Text>}
      {row.status === 'cancelled' && <Text style={s.link}>Отменено</Text>}
      {selected && <Text style={s.selection}>✓ В моём расписании</Text>}</View>
  </Pressable>;
}

export function AccountOverview({ model: m, tab, onOpen, onSchedule, view, week, onWeek,
  selectedDay, onDay, filter, onFilter }: {
  model: SharedReminderModel; tab: 'schedule' | 'mine' | 'wiki'; onOpen: (id: string) => void; onSchedule: () => void;
  view: 'day' | 'week' | 'calendar'; week: number; onWeek: (week: number) => void;
  selectedDay: string; onDay: (day: string) => void; filter: FormatFilter; onFilter: (filter: FormatFilter) => void;
}) {
  const [cancel, setCancel] = useState<string | null>(null);
  const rows = m.calendar?.lessons ?? [], prefs = m.confirmed;
  const start = m.calendar?.from.slice(0, 10) ?? dayKey(m.now);
  const days = Array.from({ length: 14 }, (_, i) => new Date(Date.parse(`${start}T12:00:00Z`) + i * 86400000).toISOString().slice(0, 10));
  const day = days.includes(selectedDay) ? selectedDay : days[0];
  const upcoming = rows.find(row => chosen(m, row) && row.status === 'scheduled' && Date.parse(row.startsAt) > m.now);
  const dayChip = (d: string) => <Pressable key={d} accessibilityRole="button" accessibilityLabel={date(`${d}T12:00:00Z`)}
    accessibilityState={{ selected: d === day }} onPress={() => onDay(d)} style={[view === 'calendar' ? s.calendarDay : s.dayChip, d === day && s.filterSelected]}>
    <Text style={s.caption}>{format(`${d}T12:00:00Z`, { weekday: 'short' })}</Text><Text style={s.lessonTitle}>{Number(d.slice(-2))}</Text></Pressable>;
  return <View style={s.section}>
    <View><Text accessibilityRole="header" style={s.title}>{tab === 'mine' ? 'Мои занятия' : 'Расписание'}</Text>
      <Text style={s.caption}>Время Израиля · выбор синхронизируется с Кабинетом</Text></View>
    {tab === 'mine' ? <>
      {upcoming && <Button label={`Ближайшее: ${upcoming.classTitle} · ${date(upcoming.startsAt)}, ${time(upcoming.startsAt)}`} onPress={() => onOpen(upcoming.id)} />}
      {!!prefs && !prefs.classIds.length && !prefs.lessonIds.length && <View style={s.empty}>
        <Text style={s.lessonTitle}>Пока нет выбранных занятий</Text><Text style={s.body}>Выберите регулярные занятия или отдельные даты в расписании.</Text>
        <Button label="Открыть расписание" onPress={onSchedule} /></View>}
      {!!prefs?.classIds.length && <Text style={s.label}>РЕГУЛЯРНЫЕ ЗАНЯТИЯ</Text>}
      {prefs?.classIds.map(id => {
        const meta = prefs.classes.find(c => c.id === id);
        const next = rows.find(row => row.classId === id && row.status === 'scheduled' && Date.parse(row.startsAt) > m.now);
        return <View key={id} style={s.empty}><Text style={s.lessonTitle}>{meta?.title ?? 'Занятие вне текущего расписания'}</Text>
          <Text style={s.caption}>{next ? `${date(next.startsAt)} · ${time(next.startsAt)}` : 'Выбор сохранён. Ближайшая дата пока не загружена.'}</Text>
          {next && <Button label="Открыть ближайшее занятие" onPress={() => onOpen(next.id)} />}
          {cancel === id ? <><Text style={s.body}>Убрать регулярный выбор?</Text>
            <Button label="Да, убрать" disabled={!m.canEdit} onPress={() => { void m.save([{ kind: 'class', id, selected: false }]); setCancel(null); }} />
            <Button label="Оставить" onPress={() => setCancel(null)} /></> :
            <Button label="Убрать регулярный выбор" disabled={!m.canEdit} onPress={() => setCancel(id)} />}</View>;
      })}
      {!!prefs?.lessonIds.length && <Text style={s.label}>ОТДЕЛЬНЫЕ ЗАНЯТИЯ</Text>}
      {prefs?.lessonIds.map(id => {
        const row = rows.find(r => r.id === id);
        return <View key={id} style={s.empty}>{row ? <LessonRow row={row} model={m} onOpen={onOpen} /> :
          <><Text style={s.lessonTitle}>Занятие вне текущего расписания</Text><Text style={s.caption}>Выбор сохранён и появится при загрузке даты.</Text></>}
          <Button label="Убрать отдельный выбор" disabled={!m.canEdit} onPress={() => void m.save([{ kind: 'lesson', id, selected: false }])} />
          {!!row && prefs.classIds.includes(row.classId) && <Text style={s.caption}>Регулярный выбор этого занятия продолжит действовать.</Text>}</View>;
      })}
      <Text style={s.caption}>Это личный выбор и напоминания, не запись у преподавателя.</Text>
    </> : <>
      <View style={s.options}>{([['all', 'Все'], ['online', 'Онлайн'], ['in-person', 'Очно']] as const).map(([key, label]) =>
        <Button key={key} filter label={label} selected={filter === key} onPress={() => onFilter(key)} />)}</View>
      {view === 'week' ? <View style={s.weekNavigation}>
        <Pressable accessibilityRole="button" accessibilityLabel="Предыдущая неделя" disabled={week === 0} onPress={() => onWeek(0)} style={[s.arrow, week === 0 && s.disabled]}><Text style={s.arrowLabel}>‹</Text></Pressable>
        <View style={s.weekLabel}><Text style={s.lessonTitle}>{format(`${days[week * 7]}T12:00:00Z`, { day: 'numeric', month: 'short' })} – {format(`${days[week * 7 + 6]}T12:00:00Z`, { day: 'numeric', month: 'short' })}</Text>
          <Text style={s.caption}>{week === 0 ? 'Ближайшие 7 дней' : 'Следующие 7 дней'}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Следующая неделя" disabled={week === 1} onPress={() => onWeek(1)} style={[s.arrow, week === 1 && s.disabled]}><Text style={s.arrowLabel}>›</Text></Pressable>
      </View> :
        view === 'day' ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.options}>{days.map(dayChip)}</ScrollView> :
          <View style={s.calendar}>{days.map(dayChip)}</View>}
      {(view === 'week' ? days.slice(week * 7, week * 7 + 7) : [day]).map(d => {
        const events = rows.filter(row => dayKey(row.startsAt) === d && cabinetMatchesFormat(row, filter));
        return <View key={d} style={s.section}><Text accessibilityRole="header" style={s.dayHeading}>{date(`${d}T12:00:00Z`)}</Text>
          {events.length ? <View style={s.group}>{events.map(row => <LessonRow key={row.id} row={row} model={m} onOpen={onOpen} />)}</View> :
            !!m.calendar && <Text style={s.caption}>Нет доступных занятий выбранного формата</Text>}</View>;
      })}
    </>}
  </View>;
}

export function AccountLessonDetails({ id, model: m }: { id: string; model: SharedReminderModel }) {
  const row = m.calendar?.lessons.find(r => r.id === id), prefs = m.confirmed;
  if (!row) return <Text style={s.body}>Занятие сейчас вне загруженного расписания. Его выбор сохранён в «Моих занятиях».</Text>;
  const details = cabinetPresentation(row), recurring = !!prefs?.classIds.includes(row.classId), single = !!prefs?.lessonIds.includes(row.id);
  const unavailable = row.status !== 'scheduled' || Date.parse(row.startsAt) <= m.now;
  return <View style={s.section}>
    <Text accessibilityRole="header" style={s.title}>{row.classTitle}</Text><Text style={s.body}>{date(row.startsAt)} · {time(row.startsAt)}{details.endsAt ? `–${time(details.endsAt)}` : ''}</Text>
    <Text style={s.body}>{details.meta}</Text>{!!details.description && <Text style={s.body}>{details.description}</Text>}
    {row.status === 'cancelled' && <Text style={s.body}>Занятие отменено. Выбор сохранится на случай восстановления.</Text>}
    <Text style={s.label}>МОЙ ВЫБОР</Text>
    <Button label={recurring ? '✓ Регулярное занятие выбрано · убрать' : 'Выбрать регулярное занятие'} selected={recurring}
      disabled={!m.canEdit || (!recurring && unavailable)} onPress={() => void m.save([{ kind: 'class', id: row.classId, selected: !recurring }])} />
    <Button label={single ? '✓ Отдельная дата выбрана · убрать' : 'Выбрать только эту дату'} selected={single}
      disabled={!m.canEdit || (!single && unavailable)} onPress={() => void m.save([{ kind: 'lesson', id: row.id, selected: !single }])} />
    {recurring && <Text style={s.caption}>Регулярный выбор включает все будущие даты этого занятия. Отдельный выбор не отменяет регулярный.</Text>}
    <Text style={s.caption}>Изменения появятся после сохранения в Кабинете. Это не запись у преподавателя.</Text>
  </View>;
}

export function AccountReminderControls({ model: m }: { model: SharedReminderModel }) {
  const [error, setError] = useState('');
  const options: [LeadMinutes, string][] = [[null, `Как в школе · ${m.confirmed?.schoolMinutes ?? '…'} мин`], [0, 'В начале'], [15, '15 мин'], [30, '30 мин'], [60, '1 час'], [120, '2 часа']];
  return <View style={s.section}>
    <Text style={s.body}>Выбранные занятия и время напоминания общие с Кабинетом. Доставка на этом устройстве включается отдельно.</Text>
    <View style={s.inline}><Text style={[s.lessonTitle, s.flex]}>Напоминать на этом устройстве</Text>
      <Switch accessibilityLabel="Напоминать на этом устройстве" value={m.device.enabled && m.device.allowed} disabled={!m.scope}
        trackColor={{ false: C.neutral300, true: C.sage }} onValueChange={value => { setError(''); void m.setEnabled(value).catch(() => setError('Не удалось сохранить настройку устройства. Повторите.')); }} /></View>
    {m.device.enabled && m.device.allowed && <><Text style={s.caption}>Запланировано на устройстве: {m.device.scheduled}</Text>
      {m.device.eligible > m.device.scheduled && <Text style={s.caption}>Поместились ближайшие {m.device.scheduled} из {m.device.eligible} напоминаний{m.device.through ? ` · до ${format(m.device.through, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}. Остальные добавятся при открытии приложения.</Text>}</>}
    {!m.device.allowed && <Text style={s.caption}>Для доставки разрешите уведомления на устройстве.</Text>}
    <Text style={s.label}>КОГДА НАПОМНИТЬ</Text><View style={s.options}>{options.map(([minutes, label]) => <Button key={String(minutes)} label={label}
      selected={!!m.confirmed && m.confirmed.leadMinutes === minutes} disabled={!m.canEdit} onPress={() => void m.save([{ kind: 'lead', minutes }])} />)}</View>
    <Text style={s.caption}>Сохранённые напоминания работают без сети. Расписание и очередь обновляются при открытии приложения; при длительном закрытии изменения могут не попасть на устройство.</Text>
    {!!error && <Text accessibilityRole="alert" style={s.body}>{error}</Text>}
  </View>;
}

const s = StyleSheet.create({
  section: { gap: 16 }, inline: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 }, flex: { flex: 1, minWidth: 90 },
  weekNavigation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, weekLabel: { flex: 1, alignItems: 'center', gap: 2 },
  arrow: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 99 }, arrowLabel: { fontSize: 32, lineHeight: 36, color: C.accentDark },
  title: { color: C.text, fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -0.6 },
  body: { color: C.text, fontSize: 17, lineHeight: 25 }, caption: { color: '#68635B', fontSize: 14, lineHeight: 20 },
  label: { color: '#68635B', fontSize: 12, lineHeight: 18, letterSpacing: 0.6 },
  lessonTitle: { color: C.text, fontSize: 17, lineHeight: 23, fontWeight: '600' }, dayHeading: { color: C.text, fontSize: 16, lineHeight: 22, fontWeight: '600' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, button: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 22, borderWidth: 1, borderColor: C.divider, justifyContent: 'center' },
  filterSelected: { backgroundColor: '#FFE1D0', borderColor: C.accentBorder }, dayChip: { minWidth: 52, minHeight: 64, padding: 8, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 4 },
  calendar: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 }, calendarDay: { width: '13%', minHeight: 64, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 4 },
  link: { color: C.accentDark, fontSize: 15, lineHeight: 21, fontWeight: '600' }, selected: { backgroundColor: C.sageMuted, borderColor: C.sage }, selectedLabel: { color: C.sageDeep }, disabled: { opacity: 0.5 },
  group: { backgroundColor: C.neutral100, borderRadius: 14, overflow: 'hidden' }, row: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.divider },
  rowSelected: { backgroundColor: C.sageMuted }, timeColumn: { width: 52, gap: 4 }, time: { color: C.text, fontSize: 17, fontWeight: '600', fontVariant: ['tabular-nums'] },
  selection: { color: C.sageDeep, fontSize: 14, lineHeight: 22, fontWeight: '600' }, empty: { backgroundColor: C.neutral100, borderRadius: 20, padding: 16, gap: 12 },
});
