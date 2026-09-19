import classes from './generated/zoom.json';
import type { Occurrence, Schedule } from './model';
import { zoomForOccurrence, applyTelegramTimes } from './zoom-model';

export const classZoom = (event: Occurrence) => zoomForOccurrence(event, classes);

export const telegramSchedule = (schedule: Schedule) => applyTelegramTimes(schedule, classes);
