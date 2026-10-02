# Веб-вики: QA · 2026-10-01

Notion / Quartz — первая опубликованная версия:
главная, поиск, недавние, разделы, каталог и статья с оглавлением/источниками.
Sigma/d3-граф сохранён. [Дизайн](DESIGN.md).

Frontend build, 1 Node test и Python wiki/content/graph tests прошли.
Локально проверены курсор после debounce, Back после pending search,
recent → article → Back, article → graph → browser Back,
мобильная главная 390 px без переполнения.
Опубликованные HTML/CSS/JS совпали с проверенными файлами по hash.

Референсы: `screenshots/reference-*.jpg`.
Runtime с закрытым содержимым не входит в Git.
Production participant UX, реальные устройства, полный accessibility,
offline/auth-expiry, задержанный API и пустой recent не проверены.
Проверка отдельных состояний не означает полную приёмку всех экранов.
