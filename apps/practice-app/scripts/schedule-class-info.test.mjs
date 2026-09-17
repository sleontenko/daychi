import test from 'node:test';
import assert from 'node:assert/strict';
import { classInfo, matchesFormat } from '../src/features/schedule/class-info.ts';

test('hybrid classes appear in both filters; unknown format is not guessed', () => {
  const hybrid = 'Нейгун (Парк Вольфсон, Тель-Авив) + онлайн';
  assert.equal(matchesFormat(hybrid, 'online'), true);
  assert.equal(matchesFormat(hybrid, 'in-person'), true);
  assert.equal(matchesFormat('Тайцзицюань онлайн', 'in-person'), false);
  assert.equal(matchesFormat('Цигун для глаз (Парк Гонда, Тель-Авив)', 'online'), false);
  assert.equal(matchesFormat('Новое занятие', 'in-person'), false);
  assert.equal(matchesFormat('Новое занятие', 'all'), true);
});

test('detail separates metadata and supplies attributed descriptions without promises', () => {
  const info = classInfo('Медитация чжи-гуань (Аркави 3, Тель-Авив) + онлайн');
  assert.equal(info.title, 'Медитация чжи-гуань');
  assert.equal(info.location, 'Аркави 3, Тель-Авив');
  assert.equal(info.format, 'Онлайн и очно');
  assert.match(info.source, /\/meditation$/);
  assert.match(info.description, /внимательности/);
  assert.match(classInfo('Основы Дхармы онлайн').description, /не указаны/);
  assert.match(classInfo('Новое занятие').description, /не опубликована/);
  assert.match(classInfo('Парная работа тайцзицюань и илицюань').source, /iliqchuan$/);
});
