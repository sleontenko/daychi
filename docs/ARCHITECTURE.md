# Архитектура Daychi

## Компоненты и данные

Мобильный клиент Expo хранит выбор занятий, настройки напоминаний, закладки
и состояние навигации на устройстве. Приглашения/заявки и персональные сессии
обрабатывает основной FastAPI `practice_api.daychee_app`.
Вики и Zoom требуют авторизованного доступа; каталог в новой сборке не встроен.
Сайт, страницы приглашения, админка и веб-вики обслуживаются этим же сервисом.

| Компонент | Источник | Конфигурация |
|---|---|---|
| Расписание клиента | `src/features/schedule/` | `EXPO_PUBLIC_SCHEDULE_API_URL`; на iOS также прямое чтение публичного сайта школы |
| Персональный доступ | `src/features/access/`, `access_request_api.py`, `invitations.py` | `EXPO_PUBLIC_DAYCHEE_API_URL`, серверная `DAYCHEE_ACCESS_DATABASE` |
| Заявки и Telegram | `access_requests.py`, `access_request_notifications.py` | `DAYCHEE_ACCESS_REQUESTS_ENABLED=1`; секреты доставки только на сервере |
| Закрытая вики / Zoom | `wiki_app.py`, `wiki_content.py`, `daychee_app.py` | `WIKI_INDEX`, `WIKI_DATABASE`, `DAYCHEE_ZOOM` |
| Веб-библиотека | `apps/wiki-graph/src/`, `public_wiki.py`, `wiki_graph.py` | Авторизованные серверные маршруты; сборка graph.js |
| Админка | `admin.py`, `admin_web/` | Собственная admin-сессия; production-секреты выдаются отдельно |
| Старый corpus API | `practice_api.app` | `PRACTICE_*`, AWS/Gemini; отдельная закрытая система |

Все `src/` пути в таблице относительны к apps/practice-app.
Точное поведение и активные флаги сверяйте с кодом и отчётом конкретного выпуска.
Кандидат удаления данных находится за отдельным флагом и не означает выпуск.

## Локальная работа без production-данных

Публичное расписание:
`python -m uvicorn practice_api.schedule_app:app --host 127.0.0.1 --port 8001`.
Для isolated API-тестов используйте фабрики `create_daychee_app` /
`create_wiki_app`, временные SQLite и fixtures из tests. Они не вызывают
реальный Telegram и не требуют реального каталога.

Основной сервис можно запустить на loopback:
`python -m uvicorn practice_api.daychee_app:app --host 127.0.0.1 --port 8768 --no-access-log`.
Без локального индекса закрытые материалы недоступны; ошибка не заменяется
скрытым подключением к production-корпусу.
Полный локальный сценарий требует отдельного разрешённого синтетического индекса
или доступа к приватным источникам по задаче. Не копируйте реальные базы.

Клиентский API персонального доступа требует HTTPS. Для native integration
используйте согласованный staging HTTPS с тестовыми данными; unit-тесты
передают mock transport. Не отключайте проверку сертификата.

## Сборка веб-библиотеки

`npm ci && npm run build` в apps/wiki-graph собирает graph.js
в practice_api/wiki_graph_web. library.js содержит UI чтения/поиска и попадает
в bundle через graph.js. Сохранённый bundle нужен серверу без Node.js.
После изменения источников проверьте тесты и соответствие bundle.

## Production и релизы

Конфигурация текущего сервиса расположена в deploy/daychee. Private volume
и переменные окружения подключаются отдельно; секретов в Git нет.
Имя Railway-сервиса и `DAYCHEE_*` являются действующими интерфейсами,
а не текущим латинским брендингом.
Production работает одним worker; это требуется существующими in-memory
лимитами и сессиями. Не меняйте масштабирование без отдельного анализа.

GitHub Actions выполняет проверки без publish, deploy или Apple upload.
Выпуск требует разрешения владельца, неизменного source snapshot,
полной применимой QA и записи в TESTFLIGHT_CHANGELOG.
Источники iOS 13 / Android 3 фиксируются release tags и
docs/release-preparation-2026-10-01/mobile-source-manifest.json.
Текущий main включает более поздние серверные/контентные работы и не равен
содержимому уже опубликованного бинарника.

## Инварианты

Расписание использует Asia/Jerusalem, timezone устройства учитывается отдельно.
Bundle ID, URL-схема и ключи хранения сохраняются при смене имени проекта.
Прототип, дизайн-кандидат и shipped behavior разделяются явно.
Контент импортируется координатором через существующий pipeline и quality gates.
