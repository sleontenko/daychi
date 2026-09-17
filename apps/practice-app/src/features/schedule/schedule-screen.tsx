import { useFonts } from 'expo-font';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Linking, Platform, Pressable, RefreshControl, ScrollView,
  StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Organic as C, OrganicFonts as F } from '../prototype/theme';
import { dayKey, type Occurrence } from './model';
import { testReminder } from './local-reminders';
import { useSchedule } from './use-schedule';

type Tab = 'today' | 'schedule' | 'mine';
const format = (value: string | number, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Jerusalem', ...options }).format(new Date(value));
const time = (value: string) => format(value, { hour: '2-digit', minute: '2-digit' });
const date = (value: string | number) => format(value, { weekday: 'long', day: 'numeric', month: 'long' });
const iconNames = {
  today: { ios: 'house', android: 'home', web: 'home' },
  schedule: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' },
  mine: { ios: 'checkmark.circle', android: 'check_circle', web: 'check_circle' },
  bell: { ios: 'bell', android: 'notifications', web: 'notifications' },
  back: { ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' },
} as const;
function Icon({ name, active = false }: { name: keyof typeof iconNames; active?: boolean }) {
  return <SymbolView name={iconNames[name] as SymbolViewProps['name']} size={21} tintColor={active ? C.accentDark : C.neutral500} />;
}

export default function ScheduleScreen() {
  const model = useSchedule();
  const { data, prefs, now, busy, ready, offline, loading } = model;
  const [fonts] = useFonts({ Caprasimo: require('../../../assets/fonts/Caprasimo-Regular.ttf'),
    Figtree: require('../../../assets/fonts/Figtree-Regular.ttf'), FigtreeSemiBold: require('../../../assets/fonts/Figtree-SemiBold.ttf'),
    FigtreeBold: require('../../../assets/fonts/Figtree-Bold.ttf') });
  const [tab, setTab] = useState<Tab>('today');
  const [view, setView] = useState<'day' | 'week' | 'calendar'>('week');
  const [selectedDay, setSelectedDay] = useState(dayKey(now));
  const [detail, setDetail] = useState<string | null>(null);
  const [testState, setTestState] = useState('');
  const scroll = useRef<ScrollView>(null);
  const [fade] = useState(() => new Animated.Value(1));
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
    fade.setValue(0.5);
    Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [tab, detail, fade]);

  const today = dayKey(now);
  const all = data?.occurrences ?? [];
  const days = Array.from({ length: 14 }, (_, i) => new Date(Date.parse(`${today}T12:00:00Z`) + i * 86400000).toISOString().slice(0, 10));
  const mine = all.filter(e => prefs.choices[e.id] && Date.parse(e.ends_at) > now);
  const next = mine.find(e => e.status === 'scheduled' && Date.parse(e.starts_at) > now);
  const lesson = all.find(e => e.id === detail);
  const unavailable = Object.keys(prefs.choices).filter(id => !all.some(e => e.id === id) && id.split(':').at(-1)! >= today);
  const card = (event: Occurrence, compact = false) => {
    const selected = !!prefs.choices[event.id], past = Date.parse(event.starts_at) <= now;
    return <View key={event.id} style={[s.lessonCard, selected && s.lessonMine]}>
      {!compact && <Pressable accessibilityRole="button" accessibilityLabel={`Открыть ${event.title}, ${time(event.starts_at)}`}
        onPress={() => setDetail(event.id)} style={({ pressed }) => [s.cardMain, pressed && s.pressed]}>
        <Text style={s.time}>{time(event.starts_at)}–{time(event.ends_at)}</Text>
        <Text style={s.lessonTitle}>{event.title}</Text>
      </Pressable>}
      <View style={s.between}>
        <Text style={s.caption}>{event.status === 'cancelled' ? 'Отменено' : Date.parse(event.ends_at) <= now ? 'Завершилось' : past ? 'Уже началось' : selected ? 'В моём расписании' : 'Занятие школы'}</Text>
        <Pressable accessibilityRole={Platform.OS === 'web' ? 'checkbox' : 'button'} accessibilityLabel={`Пойду: ${event.title}, ${date(event.starts_at)}`}
          accessibilityState={{ checked: selected, selected, disabled: !ready || busy || (!selected && (past || event.status === 'cancelled')) }}
          disabled={!ready || busy || (!selected && (past || event.status === 'cancelled'))}
          onPress={() => void model.toggle(event.id)} style={({ pressed }) => [s.choose, selected && s.chosen, pressed && s.pressed]}>
          <Text style={[s.chooseLabel, selected && s.inverse]}>{selected ? '✓ Пойду' : '+ Пойду'}</Text>
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
        <Text style={s.caption}>{Platform.OS !== 'ios' ? 'Доступно на iPhone' : prefs.enabled && model.allowed
          ? `Запланировано на iPhone: ${model.scheduled}` : 'Для выбранных дат, даже без интернета'}</Text></View>
      <Switch accessibilityLabel="Напоминать о занятиях" value={prefs.enabled && model.allowed} disabled={busy || !ready || Platform.OS !== 'ios'}
        trackColor={{ false: C.neutral300, true: C.sage }} onValueChange={value => void model.setEnabled(value)} />
    </View>
    {prefs.enabled && model.allowed && <>
      <Text style={s.sectionLabel}>КОГДА НАПОМНИТЬ</Text>
      <View style={s.segments}>{[[0, 'В начале'], [15, '15 мин'], [30, '30 мин'], [60, '1 час']].map(([lead, label]) =>
        <Pressable key={lead} accessibilityRole={Platform.OS === 'web' ? 'radio' : 'button'} accessibilityState={{ checked: prefs.lead === lead, selected: prefs.lead === lead }} disabled={busy}
          onPress={() => void model.setLead(Number(lead))} style={[s.segment, prefs.lead === lead && s.segmentOn]}>
          <Text style={s.segmentText}>{label}</Text></Pressable>)}</View>
      <Pressable accessibilityRole="button" onPress={() => {
        void testReminder().then(() => setTestState('Сверни приложение — через 10 секунд придёт уведомление.'))
          .catch(() => setTestState('Не удалось отправить проверку. Проверь разрешение iOS.'));
      }} style={s.textButton}><Text style={s.link}>Проверить уведомление</Text></Pressable>
      {!!testState && <Text accessibilityRole="text" style={s.caption}>{testState}</Text>}
    </>}
    {Platform.OS === 'ios' && !model.allowed && <Pressable accessibilityRole="button" style={s.textButton}
      onPress={() => void Linking.openSettings()}><Text style={s.link}>Настройки уведомлений iPhone</Text></Pressable>}
  </View>;

  if (!fonts) return <View style={s.loading}><ActivityIndicator color={C.accent} /></View>;
  return <SafeAreaView edges={['top']} style={s.safe}>
    <ScrollView ref={scroll} contentContainerStyle={s.page} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={model.refresh} tintColor={C.accent} />}>
      <Animated.View style={[s.screen, { opacity: fade }]}>
        {detail ? <>
          <Pressable accessibilityRole="button" onPress={() => setDetail(null)} style={s.back}><Icon name="back" active /><Text style={s.link}>Назад</Text></Pressable>
          {lesson ? <>
            <Text style={s.eyebrow}>ЗАНЯТИЕ ШКОЛЫ</Text><Text style={s.title}>{lesson.title}</Text>
            <Text style={s.body}>{date(lesson.starts_at)} · {time(lesson.starts_at)}–{time(lesson.ends_at)}</Text>
            <Text style={s.caption}>Время Израиля</Text>{card(lesson, true)}
            {!!prefs.choices[lesson.id] && reminders}
          </> : empty('Занятие больше не найдено в расписании.')}
        </> : <>
          <View><Text style={s.eyebrow}>{tab === 'today' ? 'СЕГОДНЯ' : tab === 'schedule' ? 'РАСПИСАНИЕ' : 'МОЯ ПРАКТИКА'}</Text>
            <Text accessibilityRole="header" style={s.title}>{tab === 'today' ? date(now) : tab === 'schedule' ? 'Занятия школы' : 'Мои занятия'}</Text>
            <Text style={s.caption}>Время занятий — Израиль</Text></View>

          {tab === 'today' && <>
            {next && <View style={s.next}><Text style={s.sectionLabel}>БЛИЖАЙШЕЕ ИЗ ВЫБРАННЫХ</Text>
              <Text style={s.nextTitle}>{next.title}</Text><Text style={s.body}>{date(next.starts_at)} · {time(next.starts_at)}</Text>
              <Pressable accessibilityRole="button" onPress={() => setDetail(next.id)} style={s.textButton}><Text style={s.link}>О занятии →</Text></Pressable></View>}
            <Text style={s.sectionLabel}>ЗАНЯТИЯ СЕГОДНЯ</Text>
            {all.filter(e => dayKey(e.starts_at) === today).map(e => card(e))}
            {data && !all.some(e => dayKey(e.starts_at) === today) && empty('Сегодня занятий нет.')}
            <Pressable accessibilityRole="button" style={s.outlineButton} onPress={() => setTab('schedule')}><Text style={s.link}>Выбрать занятия на неделю →</Text></Pressable>
          </>}

          {tab === 'schedule' && <>
            <View style={s.segments}>{([['day', 'День'], ['week', 'Неделя'], ['calendar', 'Календарь']] as const).map(([key, label]) =>
              <Pressable accessibilityRole={Platform.OS === 'web' ? 'tab' : 'button'} accessibilityState={{ selected: view === key }} key={key} onPress={() => setView(key)} style={[s.segment, view === key && s.segmentOn]}>
                <Text style={s.segmentText}>{label}</Text></Pressable>)}</View>
            <View style={s.legend}><View style={s.dot} /><Text style={s.caption}>моё расписание</Text><View style={s.legendOutline}/><Text style={s.caption}>занятия школы</Text></View>
            {view === 'week' ? days.slice(0, 7).map(day => <View key={day} style={[s.weekRow, day === today && s.todayRow]}>
              <View style={s.weekDate}><Text style={s.dayShort}>{format(`${day}T12:00:00Z`, { weekday: 'short' })}</Text><Text style={s.dayNumber}>{Number(day.slice(-2))}</Text></View>
              <View style={s.weekLessons}>{all.filter(e => dayKey(e.starts_at) === day).map(e =>
                <Pressable accessibilityRole="button" accessibilityLabel={`${date(e.starts_at)}, ${time(e.starts_at)}, ${e.title}${prefs.choices[e.id] ? ', выбрано' : ''}`}
                  key={e.id} onPress={() => setDetail(e.id)} style={({ pressed }) => [s.weekLesson, prefs.choices[e.id] && s.lessonMine, pressed && s.pressed]}>
                  <Text style={s.weekTime}>{time(e.starts_at)}</Text><Text style={s.weekTitle}>{e.title}{prefs.choices[e.id] ? ' ✓' : ''}</Text>
                </Pressable>)}{data && !all.some(e => dayKey(e.starts_at) === day) && <Text style={s.caption}>Нет занятий</Text>}</View>
            </View>) : <>
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
              {all.filter(e => dayKey(e.starts_at) === selectedDay).map(e => card(e))}
            </>}
          </>}
          {tab === 'mine' && <>
            {reminders}
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
      </Animated.View>
    </ScrollView>
    {!detail && <SafeAreaView edges={['bottom']} style={s.tabSafe}><View style={s.tabs}>
      {([['today', 'Сегодня'], ['schedule', 'Расписание'], ['mine', 'Мои занятия']] as const).map(([key, label]) =>
        <Pressable key={key} accessibilityRole={Platform.OS === 'web' ? 'tab' : 'button'} accessibilityState={{ selected: tab === key }} accessibilityLabel={label} onPress={() => setTab(key)} style={s.tab}>
          <Icon name={key} active={tab === key} /><Text style={[s.tabText, tab === key && s.tabOn]}>{label}</Text></Pressable>)}
    </View></SafeAreaView>}
  </SafeAreaView>;
}

const s = StyleSheet.create({
  loading: { flex: 1, backgroundColor: C.background, alignItems: 'center', justifyContent: 'center' },
  safe: { flex: 1, backgroundColor: C.background, width: '100%', maxWidth: 600, alignSelf: 'center' },
  page: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 }, screen: { gap: 20 },
  eyebrow: { fontFamily: F.heading, color: C.accentDark, fontSize: 12, letterSpacing: 1.7, lineHeight: 17 },
  title: { fontFamily: F.heading, color: C.sageDeep, fontSize: 28, lineHeight: 34, marginTop: 3 },
  body: { fontFamily: F.regular, color: C.text, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: F.regular, color: C.text, opacity: 0.62, fontSize: 12, lineHeight: 18 },
  sectionLabel: { fontFamily: F.regular, color: C.text, opacity: 0.6, fontSize: 12, lineHeight: 18, letterSpacing: 0.8 },
  lessonTitle: { fontFamily: F.semibold, color: C.text, fontSize: 16, lineHeight: 22 },
  nextTitle: { fontFamily: F.heading, color: C.sageDeep, fontSize: 22, lineHeight: 28 },
  next: { padding: 20, gap: 12, borderRadius: 28, backgroundColor: C.neutral100 },
  lessonCard: { borderWidth: 1, borderColor: C.divider, borderRadius: 16, padding: 14, gap: 8 },
  lessonMine: { backgroundColor: C.accentSoft, borderColor: C.accentBorder },
  cardMain: { gap: 5, minHeight: 48 },
  time: { fontFamily: F.heading, color: C.accentDark, fontSize: 14, lineHeight: 19 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  choose: { minHeight: 44, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: C.accentBorder },
  chosen: { backgroundColor: C.accent, borderColor: C.accent },
  chooseLabel: { fontFamily: F.semibold, fontSize: 13, color: C.accentDark },
  inverse: { color: C.white, opacity: 1 }, pressed: { opacity: 0.65 },
  section: { gap: 12 }, flex: { flex: 1 },
  reminderRow: { padding: 16, borderRadius: 24, backgroundColor: C.neutral100, flexDirection: 'row', gap: 12, alignItems: 'center' },
  segments: { flexDirection: 'row', backgroundColor: C.neutral200, padding: 3, borderRadius: 99 },
  segment: { minHeight: 44, flex: 1, borderRadius: 99, alignItems: 'center', justifyContent: 'center' },
  segmentOn: { backgroundColor: C.neutral100 }, segmentText: { fontFamily: F.semibold, fontSize: 13, color: C.text },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6 }, dot: { width: 9, height: 9, borderRadius: 9, backgroundColor: C.accent },
  legendOutline: { width: 9, height: 9, borderWidth: 1, borderColor: C.neutral500, borderRadius: 2, marginLeft: 8 },
  weekRow: { flexDirection: 'row', gap: 12, paddingVertical: 5 }, todayRow: { backgroundColor: 'rgba(240,250,225,0.58)', borderRadius: 12 },
  weekDate: { width: 44, paddingTop: 5 }, dayShort: { fontFamily: F.regular, fontSize: 10, lineHeight: 16, textTransform: 'uppercase', color: C.neutral500 },
  dayNumber: { fontFamily: F.heading, color: C.text, fontSize: 18, lineHeight: 25 }, weekLessons: { flex: 1, gap: 6 },
  weekLesson: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, backgroundColor: C.neutral100, minHeight: 44 },
  weekTime: { fontFamily: F.heading, color: C.text, fontSize: 12 }, weekTitle: { flex: 1, fontFamily: F.semibold, color: C.text, fontSize: 13, lineHeight: 18 },
  dayStrip: { gap: 6 }, dayChip: { minWidth: 46, padding: 10, alignItems: 'center', backgroundColor: C.neutral100, borderRadius: 14 },
  dayOn: { backgroundColor: C.sageDeep }, calendar: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 }, calendarDay: { width: '13%', minHeight: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  textButton: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }, link: { fontFamily: F.semibold, fontSize: 14, color: C.accentDark },
  outlineButton: { borderWidth: 1, borderColor: C.divider, borderRadius: 16, alignItems: 'center', padding: 14, minHeight: 48 },
  primary: { backgroundColor: C.accent, borderRadius: 16, minHeight: 48, padding: 14, alignItems: 'center' }, primaryLabel: { fontFamily: F.heading, color: C.white, fontSize: 14 },
  empty: { paddingVertical: 28, gap: 12 }, notice: { padding: 16, backgroundColor: C.surface, borderRadius: 16 },
  footer: { paddingTop: 16, gap: 7, borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.divider },
  footnote: { fontFamily: F.regular, color: C.text, opacity: 0.55, fontSize: 11, lineHeight: 16 },
  back: { flexDirection: 'row', gap: 6, alignItems: 'center', minHeight: 44 },
  tabSafe: { backgroundColor: C.background, borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.divider },
  tabs: { height: 60, flexDirection: 'row' }, tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  tabText: { fontFamily: F.regular, fontSize: 10, color: C.neutral500 }, tabOn: { fontFamily: F.semibold, color: C.accentDark },
});
