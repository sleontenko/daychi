# Дизайн

Уточнение главной 14 октября: публичный граф сохраняет опубликованное оформление,
нажатие/Enter ведёт к Cabinet entry. [Состояния](../design/candidates/site-public-graph-2026-10-14/README.md),
[парные reference/runtime](qa-site-public-graph-2026-10-14/README.md). Это заменяет
скрытие графа в кандидате 13 октября; новый референс или выпуск не утверждён.

## Актуальные референсы

| Область | Источник |
|---|---|
| Исходный прототип | `design/source/Форма карты практики.zip`; `apps/practice-app/design-reference-*.jpg` |
| Расписание build 5 | `design/approved/schedule-option1.png` |
| Основное приложение и «Мои занятия» | `design/source/daychee-design-2026-09-24.zip` |
| Доступ к вики/Zoom | `docs/qa-design-repair/access-preview/01.png`–`06.png`; уточнения в `design/source/daychee-design-2026-09-28.zip` |
| Заявки | `design/approved/access-requests-2026-09-30.html` |
| Сайт и установка | `design/source/daychee-site-apk-2026-09-28.zip` |
| Wiki / reader / graph UI | Owner-selected Claude Design iteration 3, 9 October; supersedes the earlier Notion/Quartz reader reference. Existing production graph interaction/topology retained. |
| Adaptive iPad app | Existing 12 October build18 candidate; retained phone references and schedule build5. |

HTML основного экспорта 24 сентября: SHA-256
`756d187f031083e6154bcc1b9d9c9cb378d9e2c20e3920b0b68041bf4185c81d`.
Архивы и исходные изображения неизменны. Дизайн-кандидаты сохраняются отдельно;
Minimal-кандидат веб-вики не заменяет опубликованный Notion / Quartz.

## Правила

Кремовый фон `#F5EAD8`, текст `#201E1D`, терракота `#C67139`/`#8C491A`,
шалфей `#7A8A5E`. Рабочие iOS-экраны используют системный шрифт;
Caprasimo/Figtree относятся к исходному прототипу.

Расписание: светлые группы дней, колонка времени, отдельные название и место,
спокойное выделение выбора; отступы 16 pt, радиус 14 pt, нативные символы.
Day/Week/Calendar находятся в настройках. Safe areas нативные;
статус-бар и островок не рисуются поверх приложения.

Реальные даты, разделы и подтемы заменяют демонстрационные данные.
Не добавлять вымышленные определения и программы встреч.
`/prototype` не обозначает готовые карту, плеер или прогресс.

## Проверка изменений

Сравнивать **каждый** затронутый экран и состояние с соответствующим источником.
Сохранять парные reference/runtime кадры; перечислять и исправлять расхождения.
Нативные и обусловленные данными отличия объяснять отдельно.
Новый визуальный вариант требует принятого референса до переноса.

«Мои занятия»: пусто, серия, ближайшая дата, пропуск/возврат,
разовые даты и серия вне окна. Проверять loading, offline, ошибку и восстановление.

Проверять back/close и Android Back из всех входов, вложенные экраны, вкладки,
прокрутку и сохранение фильтров, выбора и черновика. Кнопки остаются в safe areas.
Build/CI и один совпавший кадр не заменяют UI QA.
Известные визуальные и навигационные расхождения блокируют приёмку.

Новый UX сначала описывается отдельным кандидатом с состояниями и таблицей
переходов. Дизайн-примеры используют синтетические данные.
Историческая проверка: [mobile QA](../design-qa.md).

## Темы и словарь · кандидат 5 октября

[Кандидат](../design/candidates/wiki-semantics-2026-10-05/README.md): список понятий,
страницы с подтверждениями, обратные ссылки из уроков и смысловой слой графа.
Синтетический desktop/mobile QA сохранён отдельно. Кандидат не принят и не
опубликован; он дополняет существующий Notion/Quartz, не заменяет референс.

## Cabinet web login · кандидат 13 октября

[Состояния и переходы](../design/candidates/cabinet-web-session-2026-10-13/README.md),
[парные опубликованные/runtime снимки и ограничения](qa-web-wiki-cabinet-2026-10-13/README.md).
Существующие экраны библиотеки, статей и графа сохранены; новый вход/выход
описан отдельно. Кандидат не заменяет принятый референс и не означает выпуск.

### Website Cabinet-entry follow-up · 13 October

The latest published homepage/Android4 styling is retained in the isolated
[site-entry candidate](../design/candidates/site-cabinet-links-2026-10-13/README.md).
[Paired QA and fixed-origin redirects](qa-site-cabinet-links-2026-10-13/README.md)
cover the protected homepage graph state. This is a candidate, not a promoted reference.


## Source reconciliation · 17 October 2026

Source synchronization restores the existing build18 privacy/delete screens,
settings, native shared-reader host and adaptive iPad configuration from sanitized
archive da55703. [Parity and current limits](qa-git-sync-2026-10-17/README.md).
This introduces no newly selected design. Claude Design iteration3 was selected
by the owner on9October, with its decorative flourish omitted; preserve Sigma,
Graphology/d3-force, existing content identities, stable hover/selection and camera/
scroll on return. Schedule build5 and existing phone references remain authoritative.

The native HTML UI is regenerated from the newer shared reader, preserving structured
articles, browser safeguards and archive labels. The consolidated candidate still
needs fresh affected-state phone/iPad/Android navigation and reference/runtime pairs
before binary acceptance; source parity and automation do not replace those checks.
Do not publish private corpus frames to fill that evidence gap.

## Native Cabinet reader · кандидат 17 октября

[Состояния и переходы](../design/candidates/native-cabinet-reader-2026-10-17/README.md)
сохраняют текущую библиотеку/статьи/понятия/Sigma и добавляют отдельные состояния
входа, отказа и восстановления. [Установленный synthetic iPhone/iPad QA](qa-native-content-ui-2026-10-17/README.md)
содержит снимки только тестовых данных; парные принятые референсы с корпусом
остаются локальными. Новый референс не принят автоматически. Полная навигация
родительского экрана и Android Back остаются проверками перед новым бинарником.


## Native navigation follow-up · 17 October

[Full installed-parent QA](qa-native-navigation-2026-10-17/README.md) covers iPhone,
iPad portrait/landscape and Android system Back. Graph camera and WKWebView scroll
restoration defects found there are fixed; native Cabinet privacy access text is
corrected conditionally. Synthetic captures and exact numeric receipts are linked.
Earlier statements about the missing full-parent/Android checks are historical;
this does not promote a new design reference or establish live content activation.
