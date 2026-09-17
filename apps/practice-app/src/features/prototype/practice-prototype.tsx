import { useFonts } from 'expo-font';
import { SymbolView, SymbolViewProps } from 'expo-symbols';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TextStyle,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Article,
  ArticleKind,
  Lesson,
  ScheduleView,
  TabKey,
  articleBySlug,
  articles,
  formatPracticeDate,
  lessonById,
  lessons,
  mapStages,
  todayPractice,
  weekDays,
} from './data';
import { Organic, OrganicFonts, OrganicRadius } from './theme';

type Route =
  | { kind: 'lesson'; id: string }
  | { kind: 'notes'; id: string }
  | { kind: 'player'; id: string }
  | { kind: 'reminders'; id: string }
  | { kind: 'article'; id: string };

type ReminderState = { on: boolean; lead: '30' | '60' | 'start'; repeat: boolean };
type IconName = SymbolViewProps['name'];

const icons = {
  today: { ios: 'house.fill', android: 'home', web: 'home' } as IconName,
  schedule: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' } as IconName,
  map: { ios: 'map.fill', android: 'map', web: 'map' } as IconName,
  wiki: { ios: 'book.closed.fill', android: 'menu_book', web: 'menu_book' } as IconName,
  play: { ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' } as IconName,
  pause: { ios: 'pause.fill', android: 'pause', web: 'pause' } as IconName,
  chevron: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' } as IconName,
  back: { ios: 'chevron.left', android: 'arrow_back_ios_new', web: 'arrow_back_ios_new' } as IconName,
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' } as IconName,
  sparkle: { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' } as IconName,
  bell: { ios: 'bell', android: 'notifications', web: 'notifications' } as IconName,
  check: { ios: 'checkmark', android: 'check', web: 'check' } as IconName,
  previous: { ios: 'backward.end.fill', android: 'skip_previous', web: 'skip_previous' } as IconName,
  next: { ios: 'forward.end.fill', android: 'skip_next', web: 'skip_next' } as IconName,
  link: { ios: 'link', android: 'link', web: 'link' } as IconName,
};

const tabItems: { key: TabKey; label: string; icon: IconName }[] = [
  { key: 'today', label: 'Сегодня', icon: icons.today },
  { key: 'schedule', label: 'Расписание', icon: icons.schedule },
  { key: 'map', label: 'Карта', icon: icons.map },
  { key: 'wiki', label: 'Вики', icon: icons.wiki },
];

const noteBlocks = [
  { heading: 'Стойка и вес', text: 'Вес перенесён на опорную ногу до конца перехода — не раньше. Колено не выходит за носок.' },
  { heading: 'Дыхание', text: 'Вдох на раскрытии, выдох на переходе. Дыхание не задерживается на смене стойки.' },
  { heading: 'Частая ошибка', text: 'Разворот корпуса опережает разворот стопы — сначала стопа, потом корпус.' },
];

export default function PracticePrototype() {
  const [fontsLoaded] = useFonts({
    Caprasimo: require('../../../assets/fonts/Caprasimo-Regular.ttf'),
    Figtree: require('../../../assets/fonts/Figtree-Regular.ttf'),
    FigtreeSemiBold: require('../../../assets/fonts/Figtree-SemiBold.ttf'),
    FigtreeBold: require('../../../assets/fonts/Figtree-Bold.ttf'),
  });
  const [tab, setTab] = useState<TabKey>('today');
  const [stack, setStack] = useState<Route[]>([]);
  const [scheduleView, setScheduleView] = useState<ScheduleView>('week');
  const [selectedDay, setSelectedDay] = useState(26);
  const [wikiFilter, setWikiFilter] = useState<'all' | ArticleKind>('all');
  const [wikiQuery, setWikiQuery] = useState('');
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({ taiji: true });
  const [meditationExpanded, setMeditationExpanded] = useState(false);
  const [mySchedule, setMySchedule] = useState<Record<string, boolean>>(
    Object.fromEntries(lessons.filter((lesson) => lesson.mine).map((lesson) => [lesson.id, true])),
  );
  const [reminders, setReminders] = useState<Record<string, ReminderState>>(
    Object.fromEntries(
      lessons
        .filter((lesson) => lesson.mine)
        .map((lesson) => [lesson.id, { on: true, lead: '30', repeat: true }]),
    ),
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(173);
  const [speed, setSpeed] = useState('1.0x');
  const scrollRef = useRef<ScrollView>(null);
  const currentRoute = stack.at(-1);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [tab, currentRoute]);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => setElapsed((value) => Math.min(1500, value + 1)), 1000);
    return () => clearInterval(timer);
  }, [isPlaying]);

  const push = (route: Route) => setStack((value) => [...value, route]);
  const pop = () => setStack((value) => value.slice(0, -1));
  const selectTab = (key: TabKey) => {
    setTab(key);
    setStack([]);
  };

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={Organic.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.app}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {currentRoute ? (
            <DetailScreen
              route={currentRoute}
              pop={pop}
              push={push}
              isPlaying={isPlaying}
              setIsPlaying={setIsPlaying}
              elapsed={elapsed}
              speed={speed}
              setSpeed={setSpeed}
              mySchedule={mySchedule}
              setMySchedule={setMySchedule}
              reminders={reminders}
              setReminders={setReminders}
            />
          ) : (
            <RootScreen
              tab={tab}
              push={push}
              scheduleView={scheduleView}
              setScheduleView={setScheduleView}
              selectedDay={selectedDay}
              setSelectedDay={setSelectedDay}
              wikiFilter={wikiFilter}
              setWikiFilter={setWikiFilter}
              wikiQuery={wikiQuery}
              setWikiQuery={setWikiQuery}
              expandedStages={expandedStages}
              setExpandedStages={setExpandedStages}
              meditationExpanded={meditationExpanded}
              setMeditationExpanded={setMeditationExpanded}
            />
          )}
        </ScrollView>

        {!currentRoute && <BottomTabs selected={tab} onSelect={selectTab} />}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type RootScreenProps = {
  tab: TabKey;
  push: (route: Route) => void;
  scheduleView: ScheduleView;
  setScheduleView: (view: ScheduleView) => void;
  selectedDay: number;
  setSelectedDay: (day: number) => void;
  wikiFilter: 'all' | ArticleKind;
  setWikiFilter: (filter: 'all' | ArticleKind) => void;
  wikiQuery: string;
  setWikiQuery: (query: string) => void;
  expandedStages: Record<string, boolean>;
  setExpandedStages: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  meditationExpanded: boolean;
  setMeditationExpanded: (expanded: boolean) => void;
};

function RootScreen(props: RootScreenProps) {
  switch (props.tab) {
    case 'today': return <TodayScreen push={props.push} />;
    case 'schedule': return <ScheduleScreen {...props} />;
    case 'map': return <PracticeMapScreen {...props} />;
    case 'wiki': return <WikiScreen {...props} />;
  }
}

function TodayScreen({ push }: { push: (route: Route) => void }) {
  const nextLesson = lessons.find((lesson) => lesson.id === 'l10')!;
  return (
    <View style={styles.screen}>
      <View>
        <Eyebrow>СЕГОДНЯ</Eyebrow>
        <Heading style={styles.todayTitle}>Воскресенье, 26 июля</Heading>
      </View>

      <View style={[styles.card, styles.practiceCard]}>
        <View style={styles.rowBetween}>
          <Tag tone="accent">{todayPractice.direction}</Tag>
          <Body style={styles.mutedSmall}>{todayPractice.duration} мин</Body>
        </View>
        <Heading style={styles.practiceTitle}>{todayPractice.title}</Heading>
        <Progress value={todayPractice.progress} color={Organic.accent} />
        <View style={styles.rowBetween}>
          <Body style={styles.muted}>Пройдено {todayPractice.progress}%</Body>
          <OrganicButton
            label="Продолжить"
            icon={icons.play}
            onPress={() => push({ kind: 'player', id: todayPractice.id })}
            testID="continue-practice"
          />
        </View>
        <View style={styles.cardLinks}>
          <TextButton label="Конспект" onPress={() => push({ kind: 'notes', id: todayPractice.id })} />
          <TextButton label="Связанные материалы" onPress={() => push({ kind: 'article', id: 'form24' })} />
        </View>
      </View>

      <View style={styles.sectionBlock}>
        <SectionLabel>БЛИЖАЙШЕЕ ЗАНЯТИЕ</SectionLabel>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Открыть занятие ${nextLesson.title}`}
          onPress={() => push({ kind: 'lesson', id: nextLesson.id })}
          style={({ pressed }) => [styles.nextLesson, pressed && styles.pressed]}>
          <View style={styles.rowBetween}>
            <Text style={styles.lessonTime}>{nextLesson.time} · онлайн</Text>
            <Icon name={icons.chevron} size={14} color={Organic.accentDark} />
          </View>
          <Body style={styles.lessonTitle}>{nextLesson.title}</Body>
          <Body style={styles.mutedSmall}>{nextLesson.teacher} · {nextLesson.place}</Body>
        </Pressable>
      </View>

      <View style={styles.sectionBlock}>
        <SectionLabel>ОБНОВЛЕНО В ВИКИ</SectionLabel>
        <Pressable
          accessibilityRole="button"
          onPress={() => push({ kind: 'article', id: 'qigong-morning' })}
          style={({ pressed }) => [styles.wikiUpdate, pressed && styles.pressed]}>
          <View style={styles.rowBetween}>
            <Heading style={styles.wikiUpdateTitle}>Цигун: утренний комплекс</Heading>
            <Body style={styles.updated}>сегодня</Body>
          </View>
          <Body style={styles.mutedSmall}>Регулярное утреннее занятие — точка входа в практику для начинающих.</Body>
        </Pressable>
      </View>
    </View>
  );
}

function ScheduleScreen({
  push, scheduleView, setScheduleView, selectedDay, setSelectedDay,
}: RootScreenProps) {
  const dayLessons = lessons.filter((lesson) => lesson.day === selectedDay);
  return (
    <View style={styles.screen}>
      <View>
        <Eyebrow>РАСПИСАНИЕ</Eyebrow>
        <Heading style={styles.pageTitle}>Занятия школы</Heading>
      </View>
      <SegmentedControl value={scheduleView} onChange={setScheduleView} />
      <View style={styles.legend}>
        <View style={[styles.legendDot, { backgroundColor: Organic.accent }]} />
        <Body style={styles.legendText}>моё расписание</Body>
        <View style={styles.legendOutline} />
        <Body style={styles.legendText}>общее расписание школы</Body>
      </View>
      {scheduleView === 'day' && (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayStrip}>
            {weekDays.map((day) => {
              const active = day.day === selectedDay;
              return (
                <Pressable
                  key={day.day}
                  onPress={() => setSelectedDay(day.day)}
                  style={[styles.dayChip, active && styles.dayChipActive]}>
                  <Body style={[styles.dayShort, active && styles.inverse]}>{day.short}</Body>
                  <Heading style={[styles.dayNumber, active && styles.inverse]}>{day.day}</Heading>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.lessonList}>
            {dayLessons.length ? dayLessons.map((lesson) => (
              <LessonCard key={lesson.id} lesson={lesson} onPress={() => push({ kind: 'lesson', id: lesson.id })} />
            )) : <Body style={styles.empty}>Занятий нет</Body>}
          </View>
        </>
      )}
      {scheduleView === 'week' && (
        <View style={styles.weekList}>
          {weekDays.map((day) => {
            const rows = lessons.filter((lesson) => lesson.day === day.day);
            return (
              <View key={day.day} style={[styles.weekRow, day.day === 26 && styles.todayWeekRow]}>
                <View style={styles.weekDate}>
                  <Body style={styles.dayShort}>{day.short}</Body>
                  <Heading style={styles.weekNumber}>{day.day}</Heading>
                </View>
                <View style={styles.weekLessons}>
                  {rows.length ? rows.map((lesson) => (
                    <Pressable
                      key={lesson.id}
                      onPress={() => push({ kind: 'lesson', id: lesson.id })}
                      style={({ pressed }) => [styles.weekLesson, lesson.mine && styles.weekLessonMine, pressed && styles.pressed]}>
                      <Text style={styles.weekTime}>{lesson.time}</Text>
                      <Body style={styles.weekLessonTitle}>{lesson.title}</Body>
                    </Pressable>
                  )) : <Body style={styles.noLesson}>—</Body>}
                </View>
              </View>
            );
          })}
        </View>
      )}
      {scheduleView === 'month' && (
        <MonthView selectedDay={selectedDay} setSelectedDay={setSelectedDay} push={push} />
      )}
    </View>
  );
}

function MonthView({ selectedDay, setSelectedDay, push }: {
  selectedDay: number;
  setSelectedDay: (day: number) => void;
  push: (route: Route) => void;
}) {
  const cells = [...Array(2).fill(null), ...Array.from({ length: 31 }, (_, index) => index + 1)];
  const lessonDays = new Set(lessons.map((lesson) => lesson.day));
  const selectedLessons = lessons.filter((lesson) => lesson.day === selectedDay);
  return (
    <View style={styles.monthWrap}>
      <Heading style={styles.monthTitle}>Июль 2026</Heading>
      <View style={styles.calendarGrid}>
        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day) => (
          <Body key={day} style={styles.calendarHead}>{day}</Body>
        ))}
        {cells.map((day, index) => day === null ? (
          <View key={`blank-${index}`} style={styles.calendarCell} />
        ) : (
          <Pressable
            key={day}
            onPress={() => setSelectedDay(day)}
            style={[styles.calendarCell, selectedDay === day && styles.calendarCellSelected, day === 26 && selectedDay !== day && styles.calendarToday]}>
            <Body style={[styles.calendarNumber, selectedDay === day && styles.inverse]}>{day}</Body>
            {lessonDays.has(day) && <View style={[styles.calendarDot, selectedDay === day && { backgroundColor: Organic.background }]} />}
          </Pressable>
        ))}
      </View>
      <Body style={styles.selectedDayLabel}>{formatPracticeDate(selectedDay)}</Body>
      <View style={styles.lessonList}>
        {selectedLessons.length ? selectedLessons.map((lesson) => (
          <LessonCard key={lesson.id} lesson={lesson} onPress={() => push({ kind: 'lesson', id: lesson.id })} />
        )) : <Body style={styles.empty}>Занятий нет</Body>}
      </View>
    </View>
  );
}

function LessonCard({ lesson, onPress }: { lesson: Lesson; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.lessonCard, lesson.mine && styles.lessonCardMine, pressed && styles.pressed]}>
      <View style={styles.rowBetween}>
        <Text style={styles.lessonTime}>{lesson.time}</Text>
        <Tag tone="outline">{lesson.mode === 'online' ? 'онлайн' : 'офлайн'}</Tag>
      </View>
      <Body style={styles.lessonTitle}>{lesson.title}</Body>
      <Body style={styles.mutedSmall}>{lesson.teacher} · {lesson.place}</Body>
    </Pressable>
  );
}

function PracticeMapScreen({
  expandedStages, setExpandedStages, meditationExpanded, setMeditationExpanded,
}: RootScreenProps) {
  return (
    <View style={styles.screen}>
      <View>
        <Eyebrow>КАРТА ПРАКТИКИ</Eyebrow>
        <Heading style={styles.pageTitle}>Ваш путь</Heading>
        <Body style={styles.pageSubtitle}>От основ движения — к внутренней работе.</Body>
      </View>
      <View>
        {mapStages.map((stage, index) => {
          const expanded = Boolean(expandedStages[stage.id]);
          const badgeTone = stage.status === 'done' ? 'sage' : stage.status === 'current' ? 'solid' : 'neutral';
          return (
            <View key={stage.id}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                onPress={() => setExpandedStages((value) => ({ ...value, [stage.id]: !value[stage.id] }))}
                style={({ pressed }) => [styles.stageCard, stage.status === 'current' && styles.currentStage, stage.status === 'next' && styles.futureStage, pressed && styles.pressed]}>
                <View style={styles.stageHeader}>
                  <View style={styles.stageCopy}>
                    <Body style={styles.stageKicker}>{stage.kicker}</Body>
                    <Heading style={styles.stageTitle}>{stage.title}</Heading>
                  </View>
                  <Tag tone={badgeTone}>{stage.status === 'done' ? 'пройдено' : stage.status === 'current' ? 'сейчас' : 'впереди'}</Tag>
                </View>
                <Progress value={stage.progress} color={stage.status === 'done' ? Organic.sage : Organic.accent} />
              </Pressable>
              {expanded && (
                <View style={styles.stageSteps}>
                  {stage.steps.map((step) => (
                    <View key={step} style={styles.stageStep}>
                      <View style={styles.stepDot} />
                      <Body style={styles.stepText}>{step}</Body>
                    </View>
                  ))}
                </View>
              )}
              {index < mapStages.length - 1 && <View style={styles.connector} />}
            </View>
          );
        })}
      </View>
      <Pressable
        onPress={() => setMeditationExpanded(!meditationExpanded)}
        style={({ pressed }) => [styles.meditationCard, pressed && styles.pressed]}>
        <View style={styles.stageHeader}>
          <View style={styles.stageCopy}>
            <Body style={styles.stageKicker}>ПАРАЛЛЕЛЬНО, БЕЗ СТУПЕНЕЙ</Body>
            <Heading style={styles.stageTitle}>Медитация</Heading>
          </View>
          <Tag tone="sage">постоянная практика</Tag>
        </View>
        <Body style={styles.pageSubtitle}>Сопровождает любой этап — как отдельное занятие, а не ступень пути.</Body>
        {meditationExpanded && <Body style={styles.meditationNote}>20 минут тишины · ежедневно</Body>}
      </Pressable>
    </View>
  );
}

function WikiScreen({
  push, wikiFilter, setWikiFilter, wikiQuery, setWikiQuery,
}: RootScreenProps) {
  const filtered = useMemo(() => {
    const query = wikiQuery.trim().toLowerCase();
    return articles.filter((article) =>
      (wikiFilter === 'all' || article.kind === wikiFilter) &&
      (!query || `${article.title} ${article.aliases} ${article.summary}`.toLowerCase().includes(query)),
    );
  }, [wikiFilter, wikiQuery]);
  const filters: { key: 'all' | ArticleKind; label: string }[] = [
    { key: 'all', label: 'Всё' }, { key: 'term', label: 'Термины' },
    { key: 'practice', label: 'Практики' }, { key: 'lecture', label: 'Лекции' },
    { key: 'lesson', label: 'Занятия' },
  ];
  return (
    <View style={[styles.screen, styles.wikiScreen]}>
      <View>
        <Eyebrow>ВИКИ</Eyebrow>
        <Heading style={styles.pageTitle}>Живая база знаний</Heading>
      </View>
      <View style={styles.searchWrap}>
        <Icon name={icons.search} size={16} color={Organic.neutral500} />
        <TextInput
          accessibilityLabel="Поиск по вики"
          onChangeText={setWikiQuery}
          placeholder="термин, практика, лекция…"
          placeholderTextColor={Organic.neutral500}
          style={styles.searchInput}
          value={wikiQuery}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {filters.map((filter) => {
          const selected = filter.key === wikiFilter;
          return (
            <Pressable key={filter.key} onPress={() => setWikiFilter(filter.key)} style={[styles.filterChip, selected && styles.filterChipSelected]}>
              <Body style={[styles.filterText, selected && styles.inverse]}>{filter.label}</Body>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.wikiResults}>
        {filtered.length ? filtered.map((article) => (
          <ArticleCard key={article.slug} article={article} onPress={() => push({ kind: 'article', id: article.slug })} />
        )) : <Body style={styles.empty}>Ничего не найдено</Body>}
      </View>
      <View style={styles.aiPlaceholder}>
        <Icon name={icons.sparkle} size={16} color={Organic.neutral500} />
        <Body style={styles.aiText}>AI-чат по вики — появится позже</Body>
      </View>
    </View>
  );
}

function ArticleCard({ article, onPress }: { article: Article; onPress: () => void }) {
  const tone = article.kind === 'term' ? 'sage' : article.kind === 'practice' ? 'accent' : article.kind === 'lecture' ? 'outline' : 'neutral';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.articleCard, pressed && styles.pressed]}>
      <View style={styles.rowBetween}>
        <Tag tone={tone}>{article.kindLabel}</Tag>
        <Body style={styles.updated}>{article.updated}</Body>
      </View>
      <Heading style={styles.articleTitle}>{article.title}</Heading>
      <Body style={styles.articleSummary}>{article.summary}</Body>
    </Pressable>
  );
}

type DetailProps = {
  route: Route;
  pop: () => void;
  push: (route: Route) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  elapsed: number;
  speed: string;
  setSpeed: (speed: string) => void;
  mySchedule: Record<string, boolean>;
  setMySchedule: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  reminders: Record<string, ReminderState>;
  setReminders: React.Dispatch<React.SetStateAction<Record<string, ReminderState>>>;
};

function DetailScreen(props: DetailProps) {
  switch (props.route.kind) {
    case 'lesson': return <LessonDetail {...props} lesson={lessonById(props.route.id)!} />;
    case 'notes': return <NotesDetail {...props} />;
    case 'player': return <PlayerDetail {...props} />;
    case 'reminders': return <ReminderDetail {...props} lesson={lessonById(props.route.id)!} />;
    case 'article': return <ArticleDetail {...props} article={articleBySlug(props.route.id)!} />;
  }
}

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
      <Icon name={icons.back} size={14} color={Organic.accentDark} />
      <Body style={styles.backText}>Назад</Body>
    </Pressable>
  );
}

function LessonDetail({ lesson, pop, push, mySchedule, setMySchedule }: DetailProps & { lesson: Lesson }) {
  const mine = Boolean(mySchedule[lesson.id]);
  return (
    <View style={styles.detailScreen}>
      <BackButton onPress={pop} />
      <View>
        <Tag tone="accent">{lesson.direction}</Tag>
        <Heading style={styles.detailTitle}>{lesson.title}</Heading>
        <Body style={styles.detailMeta}>Школа Сюань-Сюэ 玄學 · {lesson.teacher}</Body>
      </View>
      <View style={styles.detailCard}>
        <DetailRow label="Когда" value={`${formatPracticeDate(lesson.day)}, ${lesson.time}`} />
        <DetailRow label="Длительность" value={`${lesson.duration} мин`} />
        <DetailRow label="Формат" value={lesson.mode === 'online' ? 'онлайн' : 'офлайн'} />
        <DetailRow label="Место" value={lesson.place} />
      </View>
      <View style={styles.dualButtons}>
        <OrganicButton
          label={mine ? 'В моём расписании ✓' : 'Добавить в моё'}
          onPress={() => setMySchedule((value) => ({ ...value, [lesson.id]: !mine }))}
          style={{ flex: 1.25, backgroundColor: mine ? Organic.sageDark : Organic.accent }}
        />
        <OrganicButton
          label="Напоминание"
          icon={icons.bell}
          variant="secondary"
          onPress={() => push({ kind: 'reminders', id: lesson.id })}
          style={{ flex: 1 }}
        />
      </View>
      <View style={styles.detailActions}>
        <OrganicButton label="Конспект занятия" variant="secondary" onPress={() => push({ kind: 'notes', id: lesson.id })} />
        <OrganicButton label="Связанные материалы в вики" variant="ghost" onPress={() => push({ kind: 'article', id: 'form24' })} />
      </View>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Body style={styles.detailLabel}>{label}</Body>
      <Body style={styles.detailValue}>{value}</Body>
    </View>
  );
}

function NotesDetail({ route, pop, push }: DetailProps) {
  const lesson = route.id === todayPractice.id ? undefined : lessonById(route.id);
  const title = lesson?.title ?? todayPractice.title;
  const teacher = lesson?.teacher ?? 'Дмитрий Дейч';
  const day = lesson?.day ?? 26;
  return (
    <View style={styles.detailScreen}>
      <BackButton onPress={pop} />
      <View>
        <SectionLabel>КОНСПЕКТ</SectionLabel>
        <Heading style={styles.notesTitle}>{title}</Heading>
        <Body style={styles.detailMeta}>{formatPracticeDate(day)} · {teacher}</Body>
      </View>
      <View style={styles.notesBody}>
        {noteBlocks.map((block) => (
          <View key={block.heading} style={styles.noteBlock}>
            <Heading style={styles.noteHeading}>{block.heading}</Heading>
            <Body style={styles.noteText}>{block.text}</Body>
          </View>
        ))}
      </View>
      <View style={styles.relatedTags}>
        {['Форма 24', 'Ци (气)', 'У-вэй'].map((label, index) => (
          <Pressable key={label} onPress={() => push({ kind: 'article', id: ['form24', 'qi', 'wuwei'][index] })}>
            <Tag tone="outline">{label}</Tag>
          </Pressable>
        ))}
      </View>
      <OrganicButton label="Открыть плеер" onPress={() => push({ kind: 'player', id: route.id })} />
    </View>
  );
}

function PlayerDetail({ route, pop, push, isPlaying, setIsPlaying, elapsed, speed, setSpeed }: DetailProps) {
  const lesson = route.id === todayPractice.id ? undefined : lessonById(route.id);
  const title = lesson?.title ?? todayPractice.title;
  const teacher = lesson?.teacher ?? 'Дмитрий Дейч';
  const total = 1500;
  const fmtTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  return (
    <View style={[styles.detailScreen, styles.playerScreen]}>
      <View style={styles.fullWidth}><BackButton onPress={pop} /></View>
      <View style={styles.coverArt}>
        <Icon name={icons.play} size={48} color={Organic.background} />
      </View>
      <View style={styles.playerCopy}>
        <Heading style={styles.playerTitle}>{title}</Heading>
        <Body style={styles.detailMeta}>{teacher} · {todayPractice.direction}</Body>
      </View>
      <View style={styles.fullWidth}>
        <Progress value={(elapsed / total) * 100} color={Organic.accent} />
        <View style={styles.playerTimes}>
          <Body style={styles.updated}>{fmtTime(elapsed)}</Body>
          <Body style={styles.updated}>{fmtTime(total)}</Body>
        </View>
      </View>
      <View style={styles.playerControls}>
        <Icon name={icons.previous} size={22} color={Organic.neutral500} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Пауза' : 'Воспроизвести'}
          onPress={() => setIsPlaying(!isPlaying)}
          style={({ pressed }) => [styles.playButton, pressed && styles.pressed]}>
          <Icon name={isPlaying ? icons.pause : icons.play} size={22} color={Organic.background} />
        </Pressable>
        <Icon name={icons.next} size={22} color={Organic.neutral500} />
      </View>
      <View style={styles.speedOptions}>
        {['0.75x', '1.0x', '1.25x'].map((item) => (
          <Pressable key={item} onPress={() => setSpeed(item)} style={[styles.speedChip, speed === item && styles.speedChipSelected]}>
            <Body style={[styles.speedText, speed === item && styles.inverse]}>{item}</Body>
          </Pressable>
        ))}
      </View>
      <TextButton label="Открыть конспект" onPress={() => push({ kind: 'notes', id: route.id })} />
    </View>
  );
}

function ReminderDetail({ lesson, pop, reminders, setReminders }: DetailProps & { lesson: Lesson }) {
  const reminder = reminders[lesson.id] ?? { on: false, lead: '30', repeat: false };
  const update = (patch: Partial<ReminderState>) => setReminders((value) => ({
    ...value,
    [lesson.id]: { ...reminder, ...patch },
  }));
  const leadOptions: { key: ReminderState['lead']; label: string }[] = [
    { key: '30', label: 'За 30 минут' }, { key: '60', label: 'За 1 час' }, { key: 'start', label: 'В момент начала' },
  ];
  return (
    <View style={styles.detailScreen}>
      <BackButton onPress={pop} />
      <View>
        <SectionLabel>НАПОМИНАНИЕ</SectionLabel>
        <Heading style={styles.reminderTitle}>{lesson.title}</Heading>
      </View>
      <View style={styles.reminderCard}>
        <Body style={styles.reminderLabel}>Напоминать об этом занятии</Body>
        <Switch
          accessibilityLabel="Напоминать об этом занятии"
          ios_backgroundColor={Organic.neutral300}
          onValueChange={(on) => update({ on })}
          thumbColor={Organic.background}
          trackColor={{ false: Organic.neutral300, true: Organic.accent }}
          value={reminder.on}
        />
      </View>
      {reminder.on && (
        <View style={styles.reminderOptions}>
          <SectionLabel>ЗА СКОЛЬКО НАПОМНИТЬ</SectionLabel>
          {leadOptions.map((option) => (
            <Pressable key={option.key} onPress={() => update({ lead: option.key })} style={styles.leadOption}>
              <Body>{option.label}</Body>
              {reminder.lead === option.key && <Icon name={icons.check} size={16} color={Organic.accentDark} />}
            </Pressable>
          ))}
          <View style={styles.repeatRow}>
            <Body>Повторять каждую неделю</Body>
            <Switch
              accessibilityLabel="Повторять каждую неделю"
              ios_backgroundColor={Organic.neutral300}
              onValueChange={(repeat) => update({ repeat })}
              thumbColor={Organic.background}
              trackColor={{ false: Organic.neutral300, true: Organic.accent }}
              value={reminder.repeat}
            />
          </View>
        </View>
      )}
    </View>
  );
}

function ArticleDetail({ article, pop, push }: DetailProps & { article: Article }) {
  return (
    <View style={styles.detailScreen}>
      <BackButton onPress={pop} />
      <View style={styles.frontmatter}>
        <Body style={styles.frontmatterText}>title: {article.title}</Body>
        <Body style={styles.frontmatterText}>aliases: [{article.aliases}]</Body>
        <Body style={styles.frontmatterText}>type: {article.kindLabel}</Body>
        <Body style={styles.frontmatterText}>updated: {article.updatedIso}</Body>
      </View>
      <Heading style={styles.articleDetailTitle}>{article.title}</Heading>
      <View style={styles.articleBlocks}>
        {article.blocks.map((block) => <Body key={block} style={styles.articleBlock}>{block}</Body>)}
      </View>
      <View>
        <SectionLabel>СВЯЗАННЫЕ ПОНЯТИЯ</SectionLabel>
        <View style={styles.relatedTags}>
          {article.related.map((slug) => {
            const related = articleBySlug(slug);
            return related ? (
              <Pressable key={slug} onPress={() => push({ kind: 'article', id: slug })}>
                <Tag tone="sage">{related.title}</Tag>
              </Pressable>
            ) : null;
          })}
        </View>
      </View>
      <View>
        <SectionLabel>ИСТОЧНИКИ</SectionLabel>
        <View style={styles.sources}>
          <View style={styles.sourceRow}><Icon name={icons.link} size={14} color={Organic.accentDark} /><Body style={styles.sourceText}>ТЕОРИЯ — telaviv-taiji.com/texts</Body></View>
          <View style={styles.sourceRow}><Icon name={icons.link} size={14} color={Organic.accentDark} /><Body style={styles.sourceText}>Записки о практике (блог школы)</Body></View>
        </View>
      </View>
    </View>
  );
}

function BottomTabs({ selected, onSelect }: { selected: TabKey; onSelect: (tab: TabKey) => void }) {
  return (
    <SafeAreaView edges={['bottom']} style={styles.tabSafeArea}>
      <View style={styles.bottomTabs}>
        {tabItems.map((tab) => {
          const active = selected === tab.key;
          const color = active ? Organic.accentDark : Organic.neutral500;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => onSelect(tab.key)}
              style={({ pressed }) => [styles.tabItem, pressed && styles.pressed]}
              testID={`tab-${tab.key}`}>
              <Icon name={tab.icon} size={19} color={color} />
              <Body style={[styles.tabLabel, { color }, active && styles.tabLabelActive]}>{tab.label}</Body>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

function SegmentedControl({ value, onChange }: { value: ScheduleView; onChange: (view: ScheduleView) => void }) {
  const items: { key: ScheduleView; label: string }[] = [
    { key: 'day', label: 'День' }, { key: 'week', label: 'Неделя' }, { key: 'month', label: 'Календарь' },
  ];
  return (
    <View style={styles.segmented}>
      {items.map((item) => {
        const active = value === item.key;
        return (
          <Pressable key={item.key} onPress={() => onChange(item.key)} style={[styles.segment, active && styles.segmentActive]}>
            <Body style={[styles.segmentText, active && styles.segmentTextActive]}>{item.label}</Body>
          </Pressable>
        );
      })}
    </View>
  );
}

function Icon({ name, size, color }: { name: IconName; size: number; color: string }) {
  return <SymbolView name={name} size={size} tintColor={color} />;
}

function Heading({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.heading, style]}>{children}</Text>;
}

function Body({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.body, style]}>{children}</Text>;
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function Progress({ value, color }: { value: number; color: string }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: color }]} />
    </View>
  );
}

function Tag({ children, tone = 'neutral' }: {
  children: React.ReactNode;
  tone?: string;
}) {
  const toneStyle = {
    accent: styles.tagAccent,
    sage: styles.tagSage,
    solid: styles.tagSolid,
    outline: styles.tagOutline,
    neutral: styles.tagNeutral,
  }[tone] ?? styles.tagNeutral;
  const textStyle = {
    accent: styles.tagTextAccent,
    sage: styles.tagTextSage,
    solid: styles.tagTextSolid,
    outline: styles.tagTextAccent,
    neutral: styles.tagTextNeutral,
  }[tone] ?? styles.tagTextNeutral;
  return (
    <View style={[styles.tag, toneStyle]}>
      <Body style={[styles.tagText, textStyle]}>{children}</Body>
    </View>
  );
}

function OrganicButton({ label, onPress, icon, variant = 'primary', style, testID }: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'ghost';
  style?: object;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, styles[`button_${variant}`], style, pressed && styles.pressed]}
      testID={testID}>
      {icon && <Icon name={icon} size={14} color={variant === 'primary' ? Organic.background : Organic.accentDark} />}
      <Text style={[styles.buttonLabel, variant !== 'primary' && styles.buttonLabelAlt]}>{label}</Text>
    </Pressable>
  );
}

function TextButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      <Body style={styles.textButton}>{label}</Body>
    </Pressable>
  );
}

const shadow = Platform.select({
  ios: { shadowColor: '#2E2B25', shadowOpacity: 0.14, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  android: { elevation: 3 },
  default: { boxShadow: '0 3px 10px rgba(46,43,37,0.16)' },
});

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Organic.background },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: 402,
    alignSelf: 'center',
    backgroundColor: Organic.background,
  },
  app: { flex: 1, backgroundColor: Organic.background },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28 },
  screen: { gap: 22 },
  detailScreen: { gap: 18 },
  body: { color: Organic.text, fontFamily: OrganicFonts.regular, fontSize: 15, lineHeight: 21 },
  heading: { color: Organic.text, fontFamily: OrganicFonts.heading, fontWeight: '400', letterSpacing: -0.3 },
  eyebrow: { color: Organic.accentDark, fontFamily: OrganicFonts.heading, fontSize: 12, letterSpacing: 1.7, lineHeight: 16 },
  sectionLabel: { color: Organic.text, fontFamily: OrganicFonts.regular, fontSize: 13, letterSpacing: 1.05, lineHeight: 18, opacity: 0.55 },
  todayTitle: { color: Organic.sageDeep, fontSize: 30, lineHeight: 34, marginTop: 2 },
  pageTitle: { color: Organic.sageDeep, fontSize: 28, lineHeight: 32, marginTop: 2 },
  pageSubtitle: { fontSize: 13, lineHeight: 19, opacity: 0.62, marginTop: 6 },
  card: { backgroundColor: Organic.neutral100, borderRadius: OrganicRadius.large },
  practiceCard: { padding: 22, gap: 14, ...shadow },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  muted: { fontSize: 13, opacity: 0.6 },
  mutedSmall: { fontSize: 13, lineHeight: 18, opacity: 0.62 },
  practiceTitle: { fontSize: 23, lineHeight: 28, maxWidth: 290 },
  progressTrack: { height: 6, overflow: 'hidden', borderRadius: OrganicRadius.pill, backgroundColor: Organic.neutral300 },
  progressFill: { height: '100%', borderRadius: OrganicRadius.pill },
  cardLinks: { flexDirection: 'row', gap: 18, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Organic.divider },
  textButton: { color: Organic.accentDark, fontSize: 13, lineHeight: 20 },
  sectionBlock: { gap: 10 },
  nextLesson: { backgroundColor: Organic.accentSoft, borderColor: Organic.accentBorder, borderWidth: 1, borderRadius: OrganicRadius.medium, padding: 16, gap: 6 },
  lessonTime: { color: Organic.accentDark, fontFamily: OrganicFonts.heading, fontSize: 14, lineHeight: 18 },
  lessonTitle: { fontFamily: OrganicFonts.semibold, fontSize: 16, lineHeight: 22 },
  wikiUpdate: { backgroundColor: Organic.neutral100, borderRadius: OrganicRadius.medium, padding: 16, gap: 5 },
  wikiUpdateTitle: { color: Organic.sageDeep, fontSize: 17, lineHeight: 22, flex: 1 },
  updated: { fontSize: 11, lineHeight: 15, opacity: 0.5 },
  pressed: { opacity: 0.68 },
  segmented: { flexDirection: 'row', backgroundColor: Organic.neutral200, borderRadius: OrganicRadius.pill, padding: 3 },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: OrganicRadius.pill },
  segmentActive: { backgroundColor: Organic.neutral100, ...shadow },
  segmentText: { fontFamily: OrganicFonts.semibold, fontSize: 13, opacity: 0.55 },
  segmentTextActive: { opacity: 1 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 10 },
  legendOutline: { width: 10, height: 10, borderRadius: 2, borderWidth: 1.5, borderColor: Organic.divider, marginLeft: 6 },
  legendText: { fontSize: 12, opacity: 0.6 },
  dayStrip: { gap: 6, paddingBottom: 4 },
  dayChip: { minWidth: 45, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 6, borderRadius: 14, backgroundColor: Organic.neutral100 },
  dayChipActive: { backgroundColor: Organic.sageDeep },
  dayShort: { fontSize: 10, lineHeight: 14, textTransform: 'uppercase', opacity: 0.58 },
  dayNumber: { fontSize: 17, lineHeight: 22 },
  inverse: { color: Organic.background, opacity: 1 },
  lessonList: { gap: 10 },
  lessonCard: { padding: 14, borderRadius: OrganicRadius.medium, borderWidth: 1, borderColor: Organic.divider, gap: 5 },
  lessonCardMine: { backgroundColor: Organic.accentSoft, borderColor: Organic.accentBorder },
  empty: { textAlign: 'center', paddingVertical: 40, fontSize: 14, opacity: 0.5 },
  weekList: { gap: 2 },
  weekRow: { flexDirection: 'row', gap: 12, paddingVertical: 6 },
  todayWeekRow: { backgroundColor: 'rgba(240,250,225,0.58)', borderRadius: 12, paddingLeft: 6 },
  weekDate: { width: 54 },
  weekNumber: { fontSize: 18, lineHeight: 23 },
  weekLessons: { flex: 1, gap: 6 },
  weekLesson: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 12, backgroundColor: Organic.neutral100 },
  weekLessonMine: { backgroundColor: Organic.accentSoft },
  weekTime: { color: Organic.text, fontFamily: OrganicFonts.heading, fontSize: 12, lineHeight: 16 },
  weekLessonTitle: { flex: 1, fontFamily: OrganicFonts.semibold, fontSize: 13, lineHeight: 17 },
  noLesson: { fontSize: 12, opacity: 0.35, paddingVertical: 6 },
  monthWrap: { gap: 14 },
  monthTitle: { color: Organic.sageDeep, fontSize: 16, lineHeight: 20, textAlign: 'center' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  calendarHead: { width: '12.7%', textAlign: 'center', fontSize: 10, lineHeight: 14, opacity: 0.5 },
  calendarCell: { width: '12.7%', height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 2 },
  calendarCellSelected: { backgroundColor: Organic.sageDeep },
  calendarToday: { backgroundColor: Organic.accentSoft },
  calendarNumber: { fontSize: 13, lineHeight: 16 },
  calendarDot: { width: 4, height: 4, borderRadius: 4, backgroundColor: Organic.accent },
  selectedDayLabel: { fontFamily: OrganicFonts.semibold, fontSize: 13, opacity: 0.7 },
  stageCard: { padding: 18, borderRadius: OrganicRadius.large, backgroundColor: Organic.neutral100, gap: 12 },
  currentStage: { ...shadow },
  futureStage: { opacity: 0.7 },
  stageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  stageCopy: { flex: 1 },
  stageKicker: { fontSize: 11, lineHeight: 15, textTransform: 'uppercase', letterSpacing: 0.65, opacity: 0.55 },
  stageTitle: { fontSize: 20, lineHeight: 24, marginTop: 2 },
  stageSteps: { marginHorizontal: 14, marginVertical: 8, paddingLeft: 18, borderLeftWidth: 2, borderLeftColor: Organic.divider, gap: 2 },
  stageStep: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  stepDot: { width: 7, height: 7, borderRadius: 7, backgroundColor: Organic.sageDark },
  stepText: { fontSize: 13, opacity: 0.8 },
  connector: { width: 2, height: 16, backgroundColor: Organic.divider, marginLeft: 26 },
  meditationCard: { marginTop: 6, padding: 18, borderRadius: OrganicRadius.large, backgroundColor: Organic.sageSoft, gap: 8 },
  meditationNote: { color: Organic.sageDark, fontFamily: OrganicFonts.semibold, fontSize: 13, marginTop: 2 },
  wikiScreen: { gap: 16 },
  searchWrap: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, borderRadius: OrganicRadius.pill, borderWidth: 1, borderColor: Organic.divider, backgroundColor: Organic.surface },
  searchInput: { flex: 1, color: Organic.text, fontFamily: OrganicFonts.regular, fontSize: 14, paddingVertical: 8 },
  filters: { gap: 8, paddingBottom: 2 },
  filterChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: OrganicRadius.pill, backgroundColor: Organic.neutral100 },
  filterChipSelected: { backgroundColor: Organic.sageDeep },
  filterText: { fontFamily: OrganicFonts.semibold, fontSize: 12, lineHeight: 16 },
  wikiResults: { gap: 10 },
  articleCard: { backgroundColor: Organic.neutral100, borderRadius: OrganicRadius.medium, padding: 16, gap: 6 },
  articleTitle: { fontSize: 18, lineHeight: 22 },
  articleSummary: { fontSize: 13, lineHeight: 19, opacity: 0.65 },
  aiPlaceholder: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 16, borderRadius: OrganicRadius.medium, borderWidth: 1, borderStyle: 'dashed', borderColor: Organic.divider, opacity: 0.7 },
  aiText: { fontSize: 12, color: Organic.neutral500 },
  backButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, paddingVertical: 2 },
  backText: { color: Organic.accentDark, fontFamily: OrganicFonts.semibold, fontSize: 13 },
  detailTitle: { fontSize: 26, lineHeight: 31, marginTop: 10 },
  detailMeta: { fontSize: 13, lineHeight: 19, opacity: 0.6, marginTop: 5 },
  detailCard: { borderRadius: OrganicRadius.large, backgroundColor: Organic.neutral100, padding: 18, gap: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18 },
  detailLabel: { fontSize: 14, opacity: 0.6 },
  detailValue: { flex: 1, textAlign: 'right', fontFamily: OrganicFonts.semibold, fontSize: 14 },
  dualButtons: { flexDirection: 'row', gap: 10 },
  detailActions: { gap: 8, marginTop: 6 },
  button: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 9, paddingHorizontal: 16, borderRadius: OrganicRadius.medium, borderWidth: 1, borderColor: 'transparent' },
  button_primary: { backgroundColor: Organic.accent },
  button_secondary: { backgroundColor: 'transparent', borderColor: Organic.divider },
  button_ghost: { backgroundColor: 'transparent' },
  buttonLabel: { color: Organic.background, fontFamily: OrganicFonts.heading, fontSize: 13, lineHeight: 17 },
  buttonLabelAlt: { color: Organic.accentDark },
  notesTitle: { fontSize: 24, lineHeight: 29, marginTop: 4 },
  notesBody: { gap: 14 },
  noteBlock: { gap: 4 },
  noteHeading: { color: Organic.sageDeep, fontSize: 15, lineHeight: 20 },
  noteText: { fontSize: 15, lineHeight: 24, opacity: 0.85 },
  relatedTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  playerScreen: { alignItems: 'center', textAlign: 'center', gap: 22 },
  fullWidth: { width: '100%' },
  coverArt: { width: 220, height: 220, borderRadius: OrganicRadius.large, alignItems: 'center', justifyContent: 'center', backgroundColor: Organic.sageDark, ...shadow },
  playerCopy: { alignItems: 'center' },
  playerTitle: { fontSize: 22, lineHeight: 27, textAlign: 'center' },
  playerTimes: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  playerControls: { flexDirection: 'row', alignItems: 'center', gap: 28 },
  playButton: { width: 60, height: 60, borderRadius: 60, alignItems: 'center', justifyContent: 'center', backgroundColor: Organic.accent },
  speedOptions: { flexDirection: 'row', gap: 8 },
  speedChip: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: OrganicRadius.pill, backgroundColor: Organic.neutral100 },
  speedChipSelected: { backgroundColor: Organic.sageDeep },
  speedText: { fontFamily: OrganicFonts.semibold, fontSize: 12, lineHeight: 16 },
  reminderTitle: { fontSize: 22, lineHeight: 27, marginTop: 4 },
  reminderCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 14, padding: 18, borderRadius: OrganicRadius.large, backgroundColor: Organic.neutral100 },
  reminderLabel: { flex: 1, fontFamily: OrganicFonts.semibold, fontSize: 15 },
  reminderOptions: { gap: 8 },
  leadOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: Organic.neutral100 },
  repeatRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 2 },
  frontmatter: { backgroundColor: Organic.neutral100, borderRadius: OrganicRadius.medium, paddingVertical: 14, paddingHorizontal: 16 },
  frontmatterText: { fontFamily: 'ui-monospace', fontSize: 11, lineHeight: 19, opacity: 0.7 },
  articleDetailTitle: { fontSize: 26, lineHeight: 31 },
  articleBlocks: { gap: 12 },
  articleBlock: { fontSize: 15, lineHeight: 25, opacity: 0.85 },
  sources: { gap: 8, marginTop: 8 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sourceText: { color: Organic.accentDark, fontSize: 13 },
  tag: { alignSelf: 'flex-start', paddingVertical: 3, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: 'transparent' },
  tagAccent: { backgroundColor: Organic.accentSoft },
  tagSage: { backgroundColor: Organic.sageSoft },
  tagSolid: { backgroundColor: Organic.accent },
  tagOutline: { borderColor: Organic.accent },
  tagNeutral: { backgroundColor: Organic.neutral200 },
  tagText: { fontSize: 11, lineHeight: 15 },
  tagTextAccent: { color: Organic.accentDark },
  tagTextSage: { color: Organic.sageDark },
  tagTextSolid: { color: Organic.background },
  tagTextNeutral: { color: Organic.text, opacity: 0.72 },
  tabSafeArea: { backgroundColor: 'rgba(245,234,216,0.98)', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Organic.divider },
  bottomTabs: { height: 60, flexDirection: 'row', alignItems: 'center' },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 52 },
  tabLabel: { fontSize: 10, lineHeight: 13 },
  tabLabelActive: { fontFamily: OrganicFonts.semibold },
});
