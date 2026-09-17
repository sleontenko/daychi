export type TabKey = 'today' | 'schedule' | 'map' | 'wiki';
export type ScheduleView = 'day' | 'week' | 'month';
export type ArticleKind = 'term' | 'practice' | 'lecture' | 'lesson';

export type Lesson = {
  id: string;
  day: number;
  time: string;
  title: string;
  direction: string;
  teacher: string;
  mode: 'online' | 'offline';
  place: string;
  duration: number;
  mine: boolean;
};

export type Article = {
  slug: string;
  title: string;
  kind: ArticleKind;
  kindLabel: string;
  updated: string;
  updatedIso: string;
  aliases: string;
  summary: string;
  blocks: string[];
  related: string[];
};

export const weekDays = [
  { short: 'Пн', day: 20 },
  { short: 'Вт', day: 21 },
  { short: 'Ср', day: 22 },
  { short: 'Чт', day: 23 },
  { short: 'Пт', day: 24 },
  { short: 'Сб', day: 25 },
  { short: 'Вс', day: 26 },
] as const;

export const lessons: Lesson[] = [
  { id: 'l1', day: 20, time: '07:00', title: 'Цигун: утренний комплекс', direction: 'Цигун', teacher: 'Светлана Тушина', mode: 'offline', place: 'зал Флорентин, Тель-Авив', duration: 45, mine: true },
  { id: 'l2', day: 20, time: '19:00', title: 'Тайцзицюань, форма 24', direction: 'Тайцзицюань', teacher: 'Дмитрий Дейч', mode: 'offline', place: 'зал Флорентин, Тель-Авив', duration: 60, mine: true },
  { id: 'l3', day: 21, time: '20:00', title: 'Медитация: практика сидя', direction: 'Медитация', teacher: 'Дмитрий Дейч', mode: 'online', place: 'онлайн, Zoom', duration: 30, mine: true },
  { id: 'l4', day: 22, time: '07:00', title: 'Цигун: утренний комплекс', direction: 'Цигун', teacher: 'Светлана Тушина', mode: 'offline', place: 'зал Флорентин, Тель-Авив', duration: 45, mine: false },
  { id: 'l5', day: 22, time: '19:00', title: 'Илицюань: внутренняя работа', direction: 'Илицюань', teacher: 'Михаил Шульман', mode: 'offline', place: 'зал Флорентин, Тель-Авив', duration: 75, mine: false },
  { id: 'l6', day: 23, time: '19:00', title: 'Тайцзицюань, форма 24', direction: 'Тайцзицюань', teacher: 'Дмитрий Дейч', mode: 'offline', place: 'зал Флорентин, Тель-Авив', duration: 60, mine: true },
  { id: 'l7', day: 24, time: '18:00', title: 'Открытый семинар с мастером Алексом Скалозубом', direction: 'Тайцзицюань', teacher: 'Алекс Скалозуб', mode: 'offline', place: 'зал Флорентин, Тель-Авив', duration: 90, mine: false },
  { id: 'l8', day: 25, time: '10:00', title: 'Тайцзицюань, форма 24 (продолжающие)', direction: 'Тайцзицюань', teacher: 'Мари Визель', mode: 'online', place: 'онлайн, Zoom', duration: 60, mine: false },
  { id: 'l9', day: 25, time: '12:00', title: 'Медитация: подготовка к ретриту', direction: 'Медитация', teacher: 'Дмитрий Дейч', mode: 'offline', place: 'зал Флорентин, Тель-Авив', duration: 90, mine: false },
  { id: 'l10', day: 26, time: '11:00', title: 'Цигун: утренний комплекс', direction: 'Цигун', teacher: 'Светлана Тушина', mode: 'online', place: 'онлайн, Zoom', duration: 45, mine: true },
];

export const articles: Article[] = [
  { slug: 'qi', title: 'Ци (气)', kind: 'term', kindLabel: 'термин', updated: '2 дня назад', updatedIso: '2026-07-24', aliases: 'ци, qi, ки', summary: 'Базовое понятие даосских практик — то, что движется и наполняет форму.', blocks: ['В даосских практиках ци — не «энергия» в бытовом смысле, а то, что связывает дыхание, движение и внимание в одно целое.', 'В цигун и тайцзицюань ци — рабочее понятие: его не обсуждают отвлечённо, а нарабатывают через форму и дыхание.'], related: ['dantian', 'qigong-morning'] },
  { slug: 'dantian', title: 'Дантянь (丹田)', kind: 'term', kindLabel: 'термин', updated: '5 дней назад', updatedIso: '2026-07-21', aliases: 'дань-тянь, нижний дантянь', summary: 'Условный центр тела ниже пупка, к которому обращена работа с ци.', blocks: ['Дантянь — не анатомическая точка, а рабочий ориентир: туда «опускают» внимание и дыхание в цигун и в стойках тайцзицюань.', 'На занятиях этот термин звучит как практическая инструкция, а не философская метафора.'], related: ['qi', 'form24'] },
  { slug: 'form24', title: 'Форма 24', kind: 'practice', kindLabel: 'практика', updated: 'вчера', updatedIso: '2026-07-25', aliases: 'упрощённая форма, 24式', summary: 'Базовая последовательность тайцзицюань из 24 движений — стержень практики в школе.', blocks: ['Форма 24 — стандартная упрощённая последовательность тайцзицюань, разбитая в школе на смысловые части для последовательного разучивания.', 'Личная карта практики отслеживает форму по частям, а не как одно большое движение.'], related: ['qi', 'iliquan-term'] },
  { slug: 'wuwei', title: 'У-вэй (無為)', kind: 'term', kindLabel: 'термин', updated: '12 дней назад', updatedIso: '2026-07-14', aliases: 'недеяние', summary: 'Действие без избыточного усилия — принцип, который проверяется в форме, а не только читается.', blocks: ['У-вэй часто переводят как «недеяние», но на занятиях это скорее про экономность усилия: убрать лишнее напряжение, оставить только нужное движение.'], related: ['form24', 'taiji-state'] },
  { slug: 'iliquan-term', title: 'Илицюань', kind: 'practice', kindLabel: 'практика', updated: '3 дня назад', updatedIso: '2026-07-23', aliases: 'и ли цюань', summary: 'Направление внутренней работы, которое идёт после освоения формы.', blocks: ['Илицюань в программе школы — следующий шаг после формы 24: меньше про последовательность движений, больше про внутреннее состояние в движении.'], related: ['form24', 'wuwei'] },
  { slug: 'qigong-morning', title: 'Цигун: утренний комплекс', kind: 'lesson', kindLabel: 'занятие', updated: 'сегодня', updatedIso: '2026-07-26', aliases: 'утренний цигун', summary: 'Регулярное утреннее занятие — точка входа в практику для начинающих.', blocks: ['Утренний комплекс цигун — базовый разогрев и дыхательная практика, с которой школа рекомендует начинать день и знакомство с практикой в целом.'], related: ['qi'] },
  { slug: 'retreat-notes', title: 'Записки: ретрит в Мицперамон', kind: 'lecture', kindLabel: 'лекция', updated: 'неделю назад', updatedIso: '2026-07-19', aliases: 'ретрит', summary: 'Конспект выездного ретрита школы — практика вне города, без городского ритма.', blocks: ['Выездной ретрит проходит без привычного городского расписания: длинные блоки практики вместо часовых занятий.'], related: ['taiji-state'] },
  { slug: 'taiji-state', title: 'Тайцзи как состояние', kind: 'lecture', kindLabel: 'лекция', updated: '2 недели назад', updatedIso: '2026-07-12', aliases: 'тайцзицюань — не техника', summary: 'Почему в школе тайцзи описывают как состояние, а не как набор приёмов.', blocks: ['В школе принято говорить о тайцзи не как о наборе приёмов, а как о состоянии — то, что нарабатывается через форму, но не сводится к ней.'], related: ['wuwei', 'form24'] },
];

export const mapStages = [
  { id: 'qigong', kicker: 'Ступень 1 · пройдено', title: 'Цигун — основы движения', status: 'done' as const, progress: 100, steps: ['Дыхание и стойка', 'Базовые связки', 'Утренний комплекс целиком'] },
  { id: 'taiji', kicker: 'Ступень 2 · текущая', title: 'Тайцзицюань, форма 24', status: 'current' as const, progress: 62, steps: ['Вводная стойка — пройдено', 'Части 1–2 — пройдено', 'Часть 3: переходы — сейчас', 'Части 4–6 — впереди'] },
  { id: 'iliquan', kicker: 'Ступень 3 · впереди', title: 'Илицюань — внутренняя работа', status: 'next' as const, progress: 0, steps: ['Открывается после формы 24'] },
];

export const todayPractice = {
  id: 'form24-p3',
  title: 'Форма 24 — часть 3: переходы',
  direction: 'Тайцзицюань',
  duration: 25,
  progress: 62,
};

export const articleBySlug = (slug: string) => articles.find((article) => article.slug === slug);
export const lessonById = (id: string) => lessons.find((lesson) => lesson.id === id);

export function formatPracticeDate(day: number) {
  const names: Record<number, string> = {
    20: 'Понедельник', 21: 'Вторник', 22: 'Среда', 23: 'Четверг',
    24: 'Пятница', 25: 'Суббота', 26: 'Воскресенье',
  };
  return `${names[day] ?? 'Июль'}, ${day} июля`;
}
