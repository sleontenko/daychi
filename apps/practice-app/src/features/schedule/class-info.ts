export type FormatFilter = 'all' | 'online' | 'in-person';
const school = 'https://www.telaviv-taiji.com/';

// Editorial summaries of the school's public pages, checked 2026-09-17.
// These describe directions, not an invented syllabus for a dated occurrence.
export function classInfo(title: string) {
  const text = title.toLowerCase();
  const online = /онлайн|online/.test(text);
  const location = title.match(/\(([^)]*(?:Парк|Аркави)[^)]*)\)/i)?.[1];
  const inPerson = !!location || /офлайн|очно/.test(text);
  let description = 'Подробная программа этого занятия пока не опубликована в доступных материалах школы.';
  let source = `${school}kogda`;
  if (/медитац/.test(text)) {
    description = 'Практика чжи-гуань: исследование ума и внимательности. Школа описывает обучение как последовательный путь, где объяснения опираются на собственный опыт практикующего.';
    source = `${school}meditation`;
  } else if (/илицюань/.test(text)) {
    description = 'Парная практика, направленная на чувствительность, равновесие и осознавание движения. В описании школы важны расслабление, внимание и восприятие взаимодействия с партнёром.';
    source = `${school}iliqchuan`;
  } else if (/н[еэ]йгун/.test(text)) {
    description = 'Нейгун — внутренняя работа. Материалы школы отличают её от внешней формы движения и рассматривают как широкую область практик внимания и внутренних процессов тела.';
    source = `${school}neigong`;
  } else if (/цигун/.test(text)) {
    description = 'Цигун в подходе школы — не только гимнастика, а область практик, требующая регулярного обучения и собственного опыта.';
    if (/глаз/.test(text)) description += ' Это занятие посвящено цигун для глаз' + (/туйна/.test(text) ? ' и массажу туйна.' : '.');
    source = `${school}chikong`;
  } else if (/тайцзи/.test(text)) {
    description = 'Изучение тайцзицюань через движение и внимательное выполнение формы. В материалах школы акцент сделан на процессе практики, регулярности и постепенном освоении основ.';
    if (/веер/.test(text)) description += ' В расписании эта группа обозначена как занятие с веером.';
    source = `${school}taiji`;
  } else if (/дхарм/.test(text)) {
    description = 'Занятие «Основы Дхармы» входит в регулярное расписание школы. Подробная программа и тема конкретной встречи на сайте пока не указаны.';
  }
  return { online, inPerson, location, description, source,
    format: online && inPerson ? 'Онлайн и очно' : online ? 'Онлайн' : inPerson ? 'Очно' : 'Формат уточняется',
    title: title.replace(/\(([^)]*(?:Парк|Аркави)[^)]*)\)/gi, '').replace(/\+?\s*онлайн/gi, '').replace(/\s+/g, ' ').trim() };
}

export function matchesFormat(title: string, filter: FormatFilter) {
  const info = classInfo(title);
  return filter === 'all' || (filter === 'online' ? info.online : info.inPerson);
}
