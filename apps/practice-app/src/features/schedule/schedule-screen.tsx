import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAccess } from '../access/session';
import AccessScreen from '../access/access-screen';
import SettingsScreen, { type SettingsPage } from '../settings/settings-screen';
import { isChosen, seriesId, subscribed } from './attendance';
import AttendanceActions from './attendance-actions';
import CalendarExport from './calendar-export';
import { useClassZoom } from './zoom';
import WikiScreen from '../wiki/wiki-screen';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, Platform, Pressable, RefreshControl, ScrollView,
  StyleSheet, Switch, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Organic as C } from '../prototype/theme';
import { dayKey, type Occurrence } from './model';
import { testReminder } from './local-reminders';
import { useSchedule } from './use-schedule';
import { classInfo, matchesFormat, type FormatFilter } from './class-info';

type Tab = 'schedule' | 'mine' | 'wiki';
const format = (value: string | number, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Jerusalem', ...options }).format(new Date(value));
const time = (value: string) => format(value, { hour: '2-digit', minute: '2-digit' });
const date = (value: string | number) => format(value, { weekday: 'long', day: 'numeric', month: 'long' });
const iconNames = {
  settings: { ios: 'gearshape', android: 'settings', web: 'settings' },
  feedback: { ios: 'bubble', android: 'chat_bubble_outline', web: 'chat_bubble_outline' },
  schedule: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' },
  mine: { ios: 'checkmark.circle', android: 'check_circle', web: 'check_circle' },
  wiki: { ios: 'book.closed', android: 'menu_book', web: 'menu_book' },
  bell: { ios: 'bell', android: 'notifications', web: 'notifications' },
  back: { ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' },
  forward: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  selected: { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' },
  dot: { ios: 'circle.fill', android: 'circle', web: 'circle' },
} as const;
function Icon({ name, active = false, size = 21, color }: { name: keyof typeof iconNames; active?: boolean; size?: number; color?: string }) {
  return <SymbolView name={iconNames[name] as SymbolViewProps['name']} size={size} tintColor={color ?? (active ? C.accentDark : '#77716A')} />;
}

export default function ScheduleScreen() {
  const access = useAccess();
  const model = useSchedule();
  const { data, prefs, now, busy, ready, offline, loading } = model;
  const { fontScale } = useWindowDimensions();
  const [tab, setTab] = useState<Tab>('schedule');
  const [settingsPage, setSettingsPage] = useState<SettingsPage | null>(null);
  const [cancelSeries, setCancelSeries] = useState<string | null>(null);
  const [week, setWeek] = useState(0);
  const [wikiOpened, setWikiOpened] = useState(false);
  const [view, setView] = useState<'day' | 'week' | 'calendar'>('week');
  const viewRevision = useRef(0);
  const viewQueue = useRef(Promise.resolve());
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem('daychee.schedule.view.v1').then(saved => {
      if (active && viewRevision.current === 0 && (saved === 'day' || saved === 'week' || saved === 'calendar')) setView(saved);
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  const changeView = (value: 'day' | 'week' | 'calendar') => {
    viewRevision.current++; setView(value);
    viewQueue.current = viewQueue.current.catch(() => {}).then(() => AsyncStorage.setItem('daychee.schedule.view.v1', value));
    void viewQueue.current.catch(() => model.setError('Не удалось сохранить вид расписания.'));
  };
  const [formatFilter, setFormatFilter] = useState<FormatFilter>('all');
  const [selectedDay, setSelectedDay] = useState(dayKey(now));
  const [detail, setDetailId] = useState<string | null>(null);
  const [zoomError, setZoomError] = useState('');
  const setDetail = (id: string | null) => { setZoomError(''); setDetailId(id); };
  const [testState, setTestState] = useState('');
  const scroll = useRef<ScrollView>(null);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [tab, detail]);

  useEffect(() => {
    if (!detail) return;
    const handler = BackHandler.addEventListener('hardwareBackPress', () => { setDetailId(null); return true; });
    return () => handler.remove();
  }, [detail]);

  const today = dayKey(now);
  const all = data?.occurrences ?? [];
  const visible = all.filter(e => matchesFormat(e.title, formatFilter));
  const days = Array.from({ length: 14 }, (_, i) => new Date(Date.parse(`${today}T12:00:00Z`) + i * 86400000).toISOString().slice(0, 10));
  const mine = all.filter(e => isChosen(e, prefs) && Date.parse(e.ends_at) > now);
  const next = mine.find(e => e.status === 'scheduled' && Date.parse(e.starts_at) > now);
  const lesson = all.find(e => e.id === detail);
  const info = lesson ? classInfo(lesson.title) : null;
  const zoomState = useClassZoom(lesson);
  const zoom = zoomState.room;
  const unavailable = Object.keys(prefs.choices).filter(id => !all.some(e => e.id === id) && id.split(':').at(-1)! >= today);
  const agenda = (day: string) => {
    const events = visible.filter(e => dayKey(e.starts_at) === day);
    const isToday = day === today;
    return <View key={day} style={s.agendaSection}>
      <View style={s.dayHeading}>
        {isToday && <Icon name="dot" active size={10} />}
        <Text accessibilityRole="header" style={s.dayHeadingText}>
          {isToday ? 'Сегодня, ' : ''}{format(`${day}T12:00:00Z`, { weekday: 'long' })} · {format(`${day}T12:00:00Z`, { day: 'numeric', month: 'long' })}
        </Text>
      </View>
      {events.length ? <View style={s.agendaGroup}>{events.map((event, index) => {
        const details = classInfo(event.title);
        const selected = isChosen(event, prefs);
        const ended = Date.parse(event.ends_at) <= now;
        const status = event.status === 'cancelled' ? 'Отменено' : ended ? 'Завершилось' : subscribed(event, prefs) && !selected ? 'Пропускаю эту дату' : Date.parse(event.starts_at) <= now ? 'Уже началось' : '';
        const meta = details.location ? [details.location, details.online ? 'Онлайн' : null].filter(Boolean).join(' · ') : details.format;
        const badge = selected && <View style={s.attendanceBadge}><Icon name="selected" size={20} color={C.sageDark} /><Text style={s.attendanceText}>Я иду</Text></View>;
        return <Pressable key={event.id} accessibilityRole="button" accessibilityState={{ selected }}
          accessibilityLabel={`${date(event.starts_at)}, ${time(event.starts_at)}, ${event.title}${selected ? ', я иду' : ''}${status ? `, ${status}` : ''}`}
          onPress={() => setDetail(event.id)} style={({ pressed }) => [s.agendaRow, fontScale > 1.5 && s.agendaRowLarge, index > 0 && s.agendaSeparator, selected && s.agendaSelected, pressed && s.pressed]}>
          <View style={[s.agendaTimeColumn, fontScale > 1.3 && s.agendaTimeLarge]}><Text style={s.agendaTime}>{time(event.starts_at)}</Text><Text style={s.agendaEnd}>{time(event.ends_at)}</Text></View>
          <View style={s.agendaContent}><Text style={s.agendaTitle}>{details.title}</Text><Text style={s.agendaMeta}>{meta}</Text>
            {!!status && <Text style={s.agendaStatus}>{status}</Text>}
            {fontScale > 1.3 && badge}
          </View>
          {fontScale <= 1.3 && badge}
        </Pressable>;
      })}</View> : data ? <Text style={s.caption}>{formatFilter === 'all' ? 'Нет занятий' : 'Нет занятий этого формата'}</Text> : null}
    </View>;
  };
  const card = (event: Occurrence, compact = false) => {
    const selected = isChosen(event, prefs), past = Date.parse(event.starts_at) <= now;
    return <View key={event.id} style={[s.lessonCard, selected && s.lessonMine]}>
      {!compact && <Pressable accessibilityRole="button" accessibilityLabel={`Открыть ${event.title}, ${time(event.starts_at)}`}
        onPress={() => setDetail(event.id)} style={({ pressed }) => [s.cardMain, pressed && s.pressed]}>
        <Text style={s.time}>{time(event.starts_at)}–{time(event.ends_at)}</Text>
        <Text style={s.lessonTitle}>{event.title}</Text>
      </Pressable>}
      <View style={s.between}>
        <Text style={s.caption}>{event.status === 'cancelled' ? 'Отменено' : Date.parse(event.ends_at) <= now ? 'Завершилось' : past ? 'Уже началось' : selected ? 'В моём расписании' : 'Занятие школы'}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`${selected ? 'Изменить выбор' : 'Выбрать занятие'}: ${event.title}, ${date(event.starts_at)}`}
          accessibilityState={{ checked: selected, selected, disabled: !ready || busy || (!selected && (past || event.status === 'cancelled')) }}
          disabled={!ready || busy || (!selected && (past || event.status === 'cancelled'))}
          onPress={() => setDetail(event.id)} style={({ pressed }) => [s.choose, selected && s.chosen, pressed && s.pressed]}>
          <Text style={[s.chooseLabel, selected && s.inverse]}>{selected ? '✓ Я иду' : '+ Пойду'}</Text>
        </Pressable>
      </View>
      {selected && prefs.enabled && !past && Date.parse(event.starts_at) - prefs.lead * 60000 <= now &&
        <Text style={s.caption}>Время напоминания уже прошло. Выбери «В начале», чтобы напомнить к началу занятия.</Text>}
    </View>;
  };
  const empty = (text: string) => <View style={s.empty}><Text style={s.body}>{text}</Text></View>;
  const reminders = <View style={s.section}>
    <View style={s.reminderRow}>
      <Icon name="bell" active={prefs.enabled && model.allowed} />
      <View style={s.flex}><Text style={s.lessonTitle}>Напоминать о занятиях</Text>
        <Text style={s.caption}>{Platform.OS === 'web' ? 'Доступно в приложении на телефоне' : prefs.enabled && model.allowed
          ? `Запланировано: ${model.scheduled}` : 'Для выбранных дат, даже без интернета'}</Text></View>
      <Switch accessibilityLabel="Напоминать о занятиях" value={prefs.enabled && model.allowed} disabled={busy || !ready || Platform.OS === 'web'}
        trackColor={{ false: C.neutral300, true: C.sage }} onValueChange={value => void model.setEnabled(value)} />
    </View>
    {prefs.enabled && model.allowed && <>
      <Text style={s.sectionLabel}>КОГДА НАПОМНИТЬ</Text>
      <View style={[s.segments, fontScale > 1.2 && s.controlsLarge]}>{[[0, 'В начале'], [15, '15 мин'], [30, '30 мин'], [60, '1 час']].map(([lead, label]) =>
        <Pressable key={lead} accessibilityRole={Platform.OS === 'web' ? 'radio' : 'button'} accessibilityState={{ checked: prefs.lead === lead, selected: prefs.lead === lead }} disabled={busy}
          onPress={() => void model.setLead(Number(lead))} style={[s.segment, prefs.lead === lead && s.segmentOn]}>
          <Text style={s.segmentText}>{label}</Text></Pressable>)}</View>
      <Pressable accessibilityRole="button" onPress={() => {
        void testReminder().then(() => setTestState('Сверни приложение — через 10 секунд придёт уведомление.'))
          .catch(() => setTestState('Не удалось отправить проверку. Проверь разрешение уведомлений.'));
      }} style={s.textButton}><Text style={s.link}>Проверить уведомление</Text></Pressable>
      {!!testState && <Text accessibilityRole="text" style={s.caption}>{testState}</Text>}
    </>}
    {Platform.OS !== 'web' && !model.allowed && <Pressable accessibilityRole="button" style={s.textButton}
      onPress={() => void Linking.openSettings()}><Text style={s.link}>Настройки уведомлений телефона</Text></Pressable>}
  </View>;

  return <SafeAreaView edges={['top']} style={s.safe}>
    <SettingsScreen page={settingsPage} onPage={setSettingsPage} reminders={reminders} view={view} onView={changeView} />
    {!detail && <View style={s.rootBar}>
      <Pressable accessibilityRole="button" accessibilityLabel="Настройки" onPress={() => setSettingsPage('settings')} style={s.roundButton}><Icon name="settings" color={C.text} size={24} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Обратная связь" onPress={() => setSettingsPage('feedback')} style={s.roundButton}><Icon name="feedback" color={C.text} size={24} /></Pressable>
    </View>}
    {wikiOpened && <View style={{ flex: 1, display: tab === 'wiki' ? 'flex' : 'none' }}>{access === 'active' ? <WikiScreen active={tab === 'wiki' && !settingsPage} /> : <AccessScreen />}</View>}
    <ScrollView style={{ display: tab === 'wiki' ? 'none' : 'flex' }} ref={scroll} contentContainerStyle={s.page} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={model.refresh} tintColor={C.accent} />}>
      <View style={s.screen}>
        {detail ? <>
          <Pressable accessibilityRole="button" onPress={() => setDetail(null)} style={s.back}><Icon name="back" active /><Text style={s.link}>Назад</Text></Pressable>
          {lesson ? <>
            <View style={s.filters}><Text style={s.detailTag}>{info!.format}</Text></View>
            <Text style={s.detailTitle}>{info!.title}</Text>
            <Text style={s.body}>{info!.description}</Text>
            <Text style={s.body}>{date(lesson.starts_at)} · {time(lesson.starts_at)}–{time(lesson.ends_at)}</Text>
            <View style={s.section}>
              {!!info!.location && <Text style={s.body}>{info!.location}</Text>}
              <Text style={s.caption}>Время Израиля · {Math.round((Date.parse(lesson.ends_at) - Date.parse(lesson.starts_at)) / 60000)} мин</Text></View>
            {info!.online && access !== 'active' && <Pressable accessibilityRole="button" style={s.outlineButton} onPress={() => setSettingsPage('access')}><Text style={s.link}>{access === 'offline' ? 'Проверить доступ к Zoom · нужен интернет' : access === 'loading' ? 'Проверяем доступ к Zoom…' : 'Подключение доступно по приглашению'}</Text></Pressable>}
            {!!zoomState.error && <View><Text accessibilityRole="alert" style={s.caption}>{zoomState.error}</Text><Pressable accessibilityRole="button" onPress={zoomState.retry} style={s.textButton}><Text style={s.link}>Повторить</Text></Pressable></View>}
            {zoom && Date.parse(lesson.ends_at) > now && <View style={s.section}>
              <Text style={s.lessonTitle}>Подключение к занятию</Text>
              <Text selectable style={s.body}>Пароль Zoom: {zoom.password}</Text>
              <Pressable accessibilityRole="link" accessibilityLabel="Открыть занятие в Zoom"
                style={({ pressed }) => [s.outlineButton, pressed && s.pressed]}
                onPress={() => { setZoomError(''); void Linking.openURL(zoom.url).catch(() =>
                  setZoomError('Не удалось открыть Zoom. Проверьте интернет или откройте ссылку вручную.')); }}>
                <Text style={s.link}>Открыть Zoom ↗</Text>
              </Pressable>
              {!!zoomError && <><Text accessibilityRole="alert" style={s.caption}>{zoomError}</Text>
                <Text selectable style={s.link}>{zoom.url}</Text></>}
            </View>}
            <AttendanceActions key={lesson.id} event={lesson} prefs={prefs} now={now} disabled={busy || !ready}
              onChoose={weekly => void model.choose(lesson, weekly)} onToggle={() => void model.toggle(lesson.id)}
              onCancel={() => void model.cancelSubscription(seriesId(lesson.id))} />
            {lesson.status === 'scheduled' && Date.parse(lesson.starts_at) > now &&
              <CalendarExport key={`calendar:${lesson.id}`} event={lesson} weekly={subscribed(lesson, prefs)} />}
            <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(info!.source).catch(() => model.setError('Не удалось открыть материал школы.'))} style={s.textButton}><Text style={s.link}>Материал школы о направлении ↗</Text></Pressable>
            {isChosen(lesson, prefs) && <Pressable accessibilityRole="button" onPress={() => setSettingsPage('reminders')} style={s.outlineButton}><Text style={s.link}>Напоминания</Text></Pressable>}
          </> : empty('Занятие больше не найдено в расписании.')}
        </> : <>
          <View><Text accessibilityRole="header" style={s.title}>{tab === 'schedule' ? 'Расписание' : 'Мои занятия'}</Text>
            <Text style={s.caption}>Время Израиля{data ? ` · ${offline ? 'сохранено' : 'обновлено'} ${format(data.fetched_at, { hour: '2-digit', minute: '2-digit' })}` : ''}</Text></View>

          {tab === 'schedule' && <>
            <View accessibilityLabel="Формат занятий" style={[s.filters, fontScale > 1.2 && s.controlsLarge]}>{([['all', 'Все'], ['online', 'Онлайн'], ['in-person', 'Очно']] as const).map(([key, label]) =>
              <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: formatFilter === key }} onPress={() => setFormatFilter(key)} style={[s.filter, formatFilter === key && s.filterOn]}>
                <Text style={[s.filterText, formatFilter === key && { color: C.accentDark }]}>{label}</Text></Pressable>)}</View>
            {view === 'week' ? <>
              <View style={s.between}>
                <Pressable accessibilityRole="button" accessibilityLabel="Предыдущая неделя" disabled={week === 0} onPress={() => setWeek(0)} style={[s.roundButton, week === 0 && { opacity: 0.3 }]}><Icon name="back" /></Pressable>
                <View style={s.weekLabel}><Text style={s.lessonTitle}>{format(`${days[week * 7]}T12:00:00Z`, { day: 'numeric', month: 'short' })} – {format(`${days[week * 7 + 6]}T12:00:00Z`, { day: 'numeric', month: 'short' })}</Text><Text style={s.caption}>{week === 0 ? 'Ближайшие 7 дней' : 'Следующие 7 дней'}</Text></View>
                <Pressable accessibilityRole="button" accessibilityLabel="Следующая неделя" disabled={week === 1} onPress={() => setWeek(1)} style={[s.roundButton, week === 1 && { opacity: 0.3 }]}><Icon name="forward" /></Pressable>
              </View>
              {days.slice(week * 7, week * 7 + 7).map(agenda)}
            </> : <>
              {view === 'day' ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dayStrip}>
                {days.map(day => <Pressable key={day} accessibilityRole="button" accessibilityLabel={date(`${day}T12:00:00Z`)} onPress={() => setSelectedDay(day)}
                  style={[s.dayChip, day === selectedDay && s.dayOn]}><Text style={[s.dayShort, day === selectedDay && s.inverse]}>{format(`${day}T12:00:00Z`, { weekday: 'short' })}</Text>
                  <Text style={[s.dayNumber, day === selectedDay && s.inverse]}>{Number(day.slice(-2))}</Text></Pressable>)}
              </ScrollView> : <View style={s.section}>
                <Text style={s.lessonTitle}>Ближайшие 14 дней</Text><View style={s.calendar}>
                  {days.map(day => <Pressable key={day} accessibilityRole="button" accessibilityLabel={date(`${day}T12:00:00Z`)} onPress={() => setSelectedDay(day)}
                    style={[s.calendarDay, day === selectedDay && s.dayOn]}><Text style={[s.dayShort, day === selectedDay && s.inverse]}>{format(`${day}T12:00:00Z`, { weekday: 'short' })}</Text>
                    <Text style={[s.dayNumber, day === selectedDay && s.inverse]}>{Number(day.slice(-2))}</Text></Pressable>)}
                </View></View>}
              <Text style={s.sectionLabel}>{date(`${selectedDay}T12:00:00Z`)}</Text>
              {visible.filter(e => dayKey(e.starts_at) === selectedDay).map(e => card(e))}
              {data && !visible.some(e => dayKey(e.starts_at) === selectedDay) && empty('На эту дату нет занятий выбранного формата.')}
            </>}
          </>}
          {tab === 'mine' && <>
            {next && <Pressable accessibilityRole="button" onPress={() => setDetail(next.id)} style={s.next}><Text style={s.sectionLabel}>БЛИЖАЙШЕЕ МОЁ ЗАНЯТИЕ</Text><Text style={s.lessonTitle}>{next.title}</Text><Text style={s.caption}>{date(next.starts_at)} · {time(next.starts_at)}</Text></Pressable>}
            {!!Object.keys(prefs.subscriptions ?? {}).length && <View style={s.section}>
              <Text style={s.sectionLabel}>КАЖДУЮ НЕДЕЛЮ</Text>
              <Text style={s.caption}>Регулярный выбор действует до отмены. Ближайшие даты и напоминания обновляются при открытии приложения.</Text>
              {Object.entries(prefs.subscriptions ?? {}).map(([id, subscription]) => <View key={id} style={s.section}>
                <Text style={s.lessonTitle}>{subscription.title}</Text>
                <Text style={s.caption}>{format(subscription.startsAt, { weekday: 'long' })} · с {subscription.from}</Text>
                {!all.some(e => seriesId(e.id) === id) && <Text style={s.caption}>Сейчас нет в загруженном расписании. Регулярный выбор сохранён.</Text>}
                <Pressable accessibilityRole="button" disabled={busy || !ready} style={s.textButton}
                  onPress={() => setCancelSeries(id)}><Text style={s.link}>Больше не ходить каждую неделю</Text></Pressable>
                {cancelSeries === id && <View style={s.section}><Text style={s.body}>Убрать регулярный выбор и будущие напоминания?</Text><Pressable accessibilityRole="button" disabled={busy || !ready} style={s.outlineButton} onPress={() => { void model.cancelSubscription(id); setCancelSeries(null); }}><Text style={s.link}>Да, убрать регулярный выбор</Text></Pressable><Pressable accessibilityRole="button" style={s.textButton} onPress={() => setCancelSeries(null)}><Text style={s.link}>Оставить</Text></Pressable></View>}
              </View>)}
            </View>}
            {mine.length ? mine.map(e => <View key={e.id} style={s.section}><Text style={s.sectionLabel}>{date(e.starts_at)}</Text>{card(e)}</View>)
              : <View style={s.next}><Text style={s.nextTitle}>Место для твоей практики</Text><Text style={s.body}>Отметь «Пойду» у занятия — оно появится здесь.</Text>
                <Pressable accessibilityRole="button" style={s.primary} onPress={() => setTab('schedule')}><Text style={s.primaryLabel}>Выбрать занятия</Text></Pressable></View>}
            {unavailable.map(id => <View key={id} style={s.section}><Text style={s.body}>Выбранное занятие на {id.split(':').at(-1)} больше не найдено.</Text>
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => void model.toggle(id)} style={s.textButton}><Text style={s.link}>Убрать из выбранных</Text></Pressable></View>)}
          </>}
        </>}

        {!data && <View style={s.empty}>{loading ? <ActivityIndicator color={C.accent} /> : <>
          <Text style={s.lessonTitle}>Не удалось загрузить занятия</Text><Text style={s.body}>Проверь подключение. Мы попробуем снова.</Text>
          <Pressable accessibilityRole="button" style={s.textButton} onPress={model.refresh}><Text style={s.link}>Повторить загрузку</Text></Pressable></>}</View>}
        {!!model.error && <View accessibilityRole="alert" style={s.notice}><Text style={s.body}>{model.error}</Text>
          <Pressable accessibilityRole="button" onPress={() => void model.retry()} style={s.textButton}><Text style={s.link}>Повторить</Text></Pressable></View>}
        {!!data && <View style={s.footer}>
          <Text style={s.caption}>{offline ? 'Без связи · сохранено' : 'Обновлено'} {format(data.fetched_at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
          <Text style={s.footnote}>Регулярное расписание школы. Отмены из Telegram пока не учитываются. Изменения проверяются при открытии приложения.</Text>
          {offline && <Pressable accessibilityRole="button" style={s.textButton} onPress={model.refresh}><Text style={s.link}>Обновить</Text></Pressable>}
        </View>}
      </View>
    </ScrollView>
    {!detail && <SafeAreaView edges={['bottom']} style={s.tabSafe}><View style={s.tabs}>
      {([['schedule', 'Расписание'], ['mine', 'Мои занятия'], ['wiki', 'Вики']] as const).map(([key, label]) =>
        <Pressable key={key} accessibilityRole={Platform.OS === 'web' ? 'tab' : 'button'} accessibilityState={{ selected: tab === key }} accessibilityLabel={label} onPress={() => { if (key === 'wiki') setWikiOpened(true); setTab(key); }} style={s.tab}>
          <Icon name={key} active={tab === key} /><Text maxFontSizeMultiplier={1.2} style={[s.tabText, tab === key && s.tabOn]}>{label}</Text></Pressable>)}
    </View></SafeAreaView>}
  </SafeAreaView>;
}

const s = StyleSheet.create({
  detailTitle: { color: C.text, fontSize: 26, lineHeight: 32, fontWeight: '700' },
  detailTag: { color: C.accentDark, backgroundColor: '#FFE1D0', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 99, fontSize: 14, fontWeight: '600' },
  rootBar: { paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between' },
  roundButton: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 99 },
  weekLabel: { flex: 1, alignItems: 'center', gap: 2 },
  agendaEnd: { fontSize: 13, color: '#645C50', fontVariant: ['tabular-nums'] },
  loading: { flex: 1, backgroundColor: C.background, alignItems: 'center', justifyContent: 'center' },
  safe: { flex: 1, backgroundColor: C.background, width: '100%', maxWidth: 600, alignSelf: 'center' },
  page: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 }, screen: { gap: 16 },
  eyebrow: { color: C.accentDark, fontSize: 11, letterSpacing: 1.7, lineHeight: 16, marginBottom: 7 },
  title: { color: C.text, fontSize: 32, lineHeight: 38, fontWeight: '700', marginBottom: 6, letterSpacing: -0.6 },
  body: { color: C.text, fontSize: 17, lineHeight: 25 },
  caption: { color: '#68635B', fontSize: 14, lineHeight: 20 },
  sectionLabel: { color: '#68635B', fontSize: 12, lineHeight: 18, letterSpacing: 0.6 },
  lessonTitle: { fontWeight: '600', color: C.text, fontSize: 17, lineHeight: 23 },
  nextTitle: { fontWeight: '500', color: C.sageDeep, fontSize: 24, lineHeight: 30 },
  next: { padding: 20, gap: 12, borderRadius: 28, backgroundColor: C.neutral100 },
  lessonCard: { backgroundColor: C.neutral100, borderRadius: 14, padding: 16, gap: 12 },
  lessonMine: { backgroundColor: C.sageMuted },
  cardMain: { gap: 5, minHeight: 48 },
  time: { fontWeight: '500', fontVariant: ['tabular-nums'], color: C.accentDark, fontSize: 15, lineHeight: 21 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  choose: { minHeight: 44, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: C.accentBorder },
  chosen: { backgroundColor: C.sageDark, borderColor: C.sageDark },
  chooseLabel: { fontWeight: '600', fontSize: 15, color: C.accentDark },
  inverse: { color: C.white, opacity: 1 }, pressed: { opacity: 0.65 },
  section: { gap: 12 }, flex: { flex: 1 },
  reminderRow: { padding: 16, borderRadius: 24, backgroundColor: C.neutral100, flexDirection: 'row', gap: 12, alignItems: 'center' },
  segments: { flexDirection: 'row', backgroundColor: C.neutral200, padding: 3, borderRadius: 99 },
  segment: { minHeight: 44, flex: 1, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 99, alignItems: 'center', justifyContent: 'center' },
  controlsLarge: { flexDirection: 'column', flexWrap: 'nowrap', alignItems: 'stretch', borderRadius: 16 },
  segmentOn: { backgroundColor: C.neutral100 }, segmentText: { alignSelf: 'stretch', textAlign: 'center', fontWeight: '500', fontSize: 15, color: C.text },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, filter: { backgroundColor: C.neutral100, paddingHorizontal: 20, minHeight: 44, paddingVertical: 8, borderRadius: 24, borderWidth: 1, borderColor: C.divider, alignItems: 'center', justifyContent: 'center' },
  filterOn: { backgroundColor: '#FFE1D0', borderColor: C.accentBorder }, filterText: { alignSelf: 'stretch', textAlign: 'center', fontWeight: '500', fontSize: 15, color: C.text },
  attend: { minHeight: 56, padding: 16, borderRadius: 16, backgroundColor: C.accentDark, alignItems: 'center', justifyContent: 'center' },
  attendSelected: { backgroundColor: C.sageDark }, attendLabel: { fontWeight: '600', fontSize: 17, lineHeight: 24, color: C.white },
  agendaSection: { gap: 12 },
  dayHeading: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 4 },
  dayHeadingText: { flex: 1, fontSize: 15, lineHeight: 22, fontWeight: '600', color: C.text },
  agendaGroup: { backgroundColor: C.neutral100, borderRadius: 20, overflow: 'hidden' },
  agendaRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 12, gap: 10, minHeight: 66 },
  agendaRowLarge: { flexDirection: 'column', alignItems: 'stretch' },
  agendaSeparator: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.divider },
  agendaSelected: { backgroundColor: C.sageMuted },
  agendaTimeColumn: { width: 50, alignSelf: 'stretch', gap: 3 },
  agendaTimeLarge: { width: 'auto', minWidth: 76, borderRightWidth: 0 },
  agendaTime: { fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'], color: '#59564E' },
  agendaContent: { flex: 1, gap: 3 },
  agendaTitle: { fontSize: 16, lineHeight: 21, fontWeight: '500', color: C.text },
  agendaMeta: { fontSize: 14, lineHeight: 19, color: '#68635B' },
  agendaStatus: { fontSize: 13, lineHeight: 18, color: C.accentDark },
  attendanceBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3 },
  attendanceText: { fontSize: 13, fontWeight: '500', color: C.sageDark },
  dayShort: { fontSize: 12, lineHeight: 18, textTransform: 'uppercase', color: C.sageDark },
  dayNumber: { fontWeight: '600', color: C.text, fontSize: 18, lineHeight: 25 },
  dayStrip: { gap: 6 }, dayChip: { minWidth: 46, padding: 10, alignItems: 'center', backgroundColor: C.neutral100, borderRadius: 14 },
  dayOn: { backgroundColor: C.sageDeep }, calendar: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 }, calendarDay: { width: '13%', minHeight: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  textButton: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }, link: { fontWeight: '500', fontSize: 16, color: C.accentDark },
  outlineButton: { borderWidth: 1, borderColor: C.divider, borderRadius: 16, alignItems: 'center', padding: 14, minHeight: 48 },
  primary: { backgroundColor: C.accentDark, borderRadius: 16, minHeight: 48, padding: 14, alignItems: 'center' }, primaryLabel: { fontWeight: '600', color: C.white, fontSize: 16 },
  empty: { paddingVertical: 28, gap: 12 }, notice: { padding: 16, backgroundColor: C.surface, borderRadius: 16 },
  footer: { paddingTop: 16, gap: 7, borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.divider },
  footnote: { color: '#68635B', fontSize: 12, lineHeight: 18 },
  back: { flexDirection: 'row', gap: 6, alignItems: 'center', minHeight: 44 },
  tabSafe: { backgroundColor: C.neutral100, borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.divider },
  tabs: { height: 60, flexDirection: 'row' }, tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  tabText: { alignSelf: 'stretch', textAlign: 'center', fontSize: 11, color: '#68635B' }, tabOn: { fontWeight: '600', color: C.accentDark },
});
