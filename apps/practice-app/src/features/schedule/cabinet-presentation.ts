import type { PublicLesson } from './cabinet-pilot.ts';
import type { FormatFilter } from './class-info.ts';

export function cabinetMatchesFormat(lesson: PublicLesson, filter: FormatFilter) {
  return filter === 'all' || lesson.format === 'both' ||
    lesson.format === (filter === 'online' ? 'online' : 'offline');
}

export function cabinetPresentation(lesson: PublicLesson) {
  const format = lesson.format === 'both' ? 'Онлайн и очно' : lesson.format === 'online' ? 'Онлайн' : 'Очно';
  const end = Date.parse(lesson.startsAt) + lesson.durationMin * 60000;
  return { title: lesson.classTitle,
    meta: [lesson.location, format].filter(Boolean).join(' · '),
    description: [lesson.groupLabel, lesson.topic].filter(Boolean).join(' · '),
    // The wire contract permits any finite duration; a display must not crash on overflow.
    endsAt: Number.isFinite(end) && Math.abs(end) <= 8.64e15 ? new Date(end).toISOString() : null };
}
