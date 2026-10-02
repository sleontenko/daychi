# Историческая mobile QA

## Расписание build 5 · 2026-09-18

Референс `design/approved/schedule-option1.png`;
iPhone 17 Pro / iOS 26.5 Release Simulator, 402×874 pt.
Кадры: `docs/qa-build5/schedule-ios.png`,
`class-detail-ios.png`, `large-type-ios.png`.

Исправлены clipping переключателей при XXXL и повтор места/формата.
Проверены normal/XXXL, фильтры, детали, выбор/отмена, сохранение после restart
и pending reminder. TypeScript/lint, 14 JS прошли.
Нативные отличия: системный шрифт, safe areas и реальные данные.
В проверенном объёме открытых существенных расхождений нет.
Физическая доставка, все accessibility размеры и другие iPhone не проверены.

## Вики build 6–7 · 2026-09-19

Референс `apps/practice-app/design-reference-wiki.jpg`.
Восстановлены заголовок, поиск, один ряд фильтров и badge/date/title иерархия.
Реальные разделы/подтемы заменяют mock-типизацию; системный шрифт сохранён.

Web: login, поиск, category/subtopic, детали/Back и saved-only.
Build 6: Debug/Release iOS 27 Simulator, default size,
сессия после restart, закладка/детали; production HTTPS вход проверен.
Build 7: тот же каталог без login/logout, локальные 1145 материалов,
прежняя закладка и offline provider.
Приватные runtime кадры остаются вне Git.
Физическое устройство, extreme Dynamic Type и доставка не проверены.

## Zoom build 8 · 2026-09-19

Release iOS 27 Simulator: детали, время Asia/Jerusalem, пароль и outline-кнопка.
Сверено с прежними деталями и токенами.
Физическое устройство и handoff установленного Zoom не проверены.

Эти результаты относятся к указанным версиям.
Текущие правила и референсы — [DESIGN](docs/DESIGN.md).
