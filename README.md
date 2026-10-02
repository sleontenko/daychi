# Daychi · Дейчи

[![Checks](https://github.com/sleontenko/daychi/actions/workflows/checks.yml/badge.svg)](https://github.com/sleontenko/daychi/actions/workflows/checks.yml)

Приложение и веб-библиотека школы тайцзи: расписание, выбранные занятия,
напоминания и персональный доступ к вики и Zoom. Ранее проект назывался
Quiet Practice; актуальное латинское имя — **Daychi**, русское — **Дейчи**.

Приватный репозиторий для совместной разработки. Здесь находятся исходники,
дизайн-референсы, тесты и отчёты; закрытый корпус и рабочие базы подключаются отдельно.

## Текущий статус

По зафиксированному [журналу выпуска](docs/TESTFLIGHT_CHANGELOG.md):
**iOS 1.0.0 (13)** — TestFlight Internal Only, группа «Личное тестирование»;
**Android 1.0.0 (3)** — APK. Это статус выпуска 1 октября 2026,
а не новая проверка Apple. Установка и доставка напоминаний на физических
устройствах ещё требуют подтверждения.

В текущих исходниках: еженедельный и разовый выбор, пропуск/восстановление даты,
экспорт календаря, заявки на доступ и решение организатора, обратная связь,
авторизованная веб-вики с чтением, поиском, недавними публикациями и графом.
Контент и его редакционная готовность описаны в [плане вики](docs/wiki-work-plan.md).
Наличие исходника или дизайн-кандидата не означает выпуск и приёмку.

## Начать работу

1. Прочитать [CONTRIBUTING](CONTRIBUTING.md), [AGENTS](AGENTS.md),
   [правила безопасности](SECURITY.md) и [архитектуру](docs/ARCHITECTURE.md).
2. Выбрать задачу, создать ветку `codex/<task>` или свою рабочую ветку.
3. Запустить компонент по инструкции ниже. Для тестов реальные приглашения,
   каталог школы и Apple-ключи не нужны.
4. Перед PR выполнить проверки и указать фактические ограничения QA.

## Структура

| Путь | Назначение |
|---|---|
| `apps/practice-app/` | Expo SDK 57 / TypeScript, iOS, Android, web; npm-пакет `daychi-app` |
| `practice_api/` | FastAPI: расписание, доступ, админка, вики, сайт и обратная связь |
| `apps/wiki-graph/` | Исходники веб-библиотеки и графа; сборка в `practice_api/wiki_graph_web/` |
| `deploy/daychee/` | Существующая конфигурация Railway/Fly и Docker, без автоматического deploy |
| `scripts/` | Запуск сервисов, приглашения, контент/ASR-инструменты |
| `tests/` | Серверные и контентные тесты на синтетических данных |
| `design/` | Неизменные экспорты, утверждённые референсы и отдельные кандидаты |
| `docs/` | Продуктовые решения, планы, история и фактическая QA |

Старые имена папок и технических интерфейсов сохраняют совместимость;
см. [границы переименования](docs/daychi-rename.md).

## Мобильное приложение

Нужны Node.js 22.13+ и npm. Для native iOS — macOS/Xcode, для Android — JDK/SDK.
Версии пакетов зафиксированы в `package-lock.json`; используйте `npm ci`.

```sh
git clone https://github.com/sleontenko/daychi.git
cd daychi/apps/practice-app
npm ci
cp .env.example .env.local
npm run web
# Нативная development-сборка; создаёт игнорируемый native-проект:
npm run ios
# или npm run android
```

В `.env.local` задайте только публичные URL. Расписание использует
`EXPO_PUBLIC_SCHEDULE_API_URL`, персональный доступ —
`EXPO_PUBLIC_DAYCHEE_API_URL` (HTTPS).
`EXPO_PUBLIC_API_URL` относится к отдельному старому library API.
Для production-конфигурации обратитесь к владельцу; не копируйте его приватные
настройки. Тестирование интерфейса не требует доступа к реальному корпусу.
Локальные уведомления и exact alarms требуют native development build;
веб-просмотр не доказывает их доставку.

## Backend

Нужен Python 3.12+. Лёгкое окружение для серверных тестов не устанавливает ASR-модели:

```sh
python3.12 -m venv .venv
.venv/bin/python -m pip install -r scripts/dev-requirements.txt
.venv/bin/python -m uvicorn practice_api.schedule_app:app --host 127.0.0.1 --port 8001
```

Это сервис публичного расписания. Основной сервис —
`practice_api.daychee_app:app`; конфигурация и границы данных описаны в
[архитектуре](docs/ARCHITECTURE.md). Закрытый `practice_api.app` нельзя
публиковать без отдельной авторизации. Для контентной работы сначала прочитайте
[production pipeline](docs/wiki-production-pipeline.md) и
[правила контрибьюторов](docs/wiki-contributor-pipeline.md).

## Проверки

```sh
# Из корня:
.venv/bin/python -m pytest -q
python3 scripts/check_repository.py

cd apps/practice-app
npm run typecheck
npm run lint
npm test

cd ../wiki-graph
npm ci
npm test
npm run build
```

[GitHub Actions](.github/workflows/checks.yml) проверяет исходники и синтетические
тесты без секретов и deploy. Перед каждым push проверяйте staged diff и
`python3 scripts/check_repository.py --staged`.
Поэкранная дизайн-сверка, возвраты, Android Back и реальное устройство —
отдельные проверки; зелёный CI их не заменяет.

## Документация

- [Навигатор материалов для коллабораторов](docs/README.md)
- [Продукт](docs/PRODUCT.md), [roadmap](docs/ROADMAP.md), [дизайн](docs/DESIGN.md)
- [TestFlight changelog](docs/TESTFLIGHT_CHANGELOG.md)
- [Последняя mobile QA и source manifests](docs/release-preparation-2026-10-01/README.md)
- [Доступ и приглашения](docs/daychee-public-access.md), [заявки](docs/access-requests-2026-09-28.md)
- [Веб-сайт](docs/daychee-website.md), [веб-вики](docs/qa-wiki-notion-2026-10-01/README.md)
- [Внешний TestFlight / App Store: незакрытые условия](docs/ios-public-release-readiness-2026-10-02.md)
- [План контента](docs/wiki-work-plan.md), [Google Play](docs/google-play-preparation.md)

## История и распространение

История начинается со снимка исходников после build 3. Тег
`testflight/ios-1.0.0-3` фиксирует импортированный код и не является
ретроспективной привязкой первоначального Xcode-архива.
Исторические записи и теги сохраняются без переписывания.
`/prototype` содержит mock-экраны и не обозначает готовые функции.
Снимки закрытой беты build 7–9 остаются приватными и исключены из Git.
Любой выпуск, deploy или расширение распространения требует разрешения владельца.

Репозиторий не предоставляет новую open-source лицензию. Права на сторонние
компоненты и дизайн сохраняются; см. файлы LICENSE/OFL рядом с ними.
