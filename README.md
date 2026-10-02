# Daychi · Дейчи

[![Checks](https://github.com/sleontenko/daychi/actions/workflows/checks.yml/badge.svg)](https://github.com/sleontenko/daychi/actions/workflows/checks.yml)

Приложение школы тайцзи: расписание, выбранные занятия, напоминания
и персональный доступ к материалам и Zoom. Веб-вики поддерживает поиск,
чтение, недавние публикации и граф связей.

## Структура

| Путь | Назначение |
|---|---|
| `apps/practice-app/` | Expo / TypeScript: iOS, Android и web |
| `practice_api/` | FastAPI: расписание, доступ, админка, сайт и вики |
| `apps/wiki-graph/` | Веб-библиотека и граф |
| `deploy/daychee/` | Конфигурация сервера и Docker |
| `scripts/`, `tests/` | Инструменты и тесты |
| `design/`, `docs/` | Дизайн-референсы и документация |

Корпус материалов, рабочие базы и секреты подключаются отдельно и не входят в Git.
Название проекта — Daychi; [совместимость старых идентификаторов](docs/daychi-rename.md) сохраняется.

## Запуск

Клиент: Node.js 22.13+ и npm; для native-сборок нужны Xcode или Android SDK/JDK.

```sh
git clone https://github.com/sleontenko/daychi.git
cd daychi/apps/practice-app
npm ci
cp .env.example .env.local
npm run web
# Native: npm run ios или npm run android
```

Публичные URL задаются в `.env.local`: `EXPO_PUBLIC_SCHEDULE_API_URL`
и `EXPO_PUBLIC_DAYCHEE_API_URL`. Персональный доступ требует HTTPS.
Уведомления и exact alarms проверяются в native-сборке.

Backend: Python 3.12+.

```sh
python3.12 -m venv .venv
.venv/bin/python -m pip install -r scripts/dev-requirements.txt
.venv/bin/python -m uvicorn practice_api.schedule_app:app --host 127.0.0.1 --port 8001
```

Это публичное расписание. Основной сервис и синтетические fixtures описаны
в [архитектуре](docs/ARCHITECTURE.md).

## Проверки и документация

Команды проверок и порядок PR — в [CONTRIBUTING](CONTRIBUTING.md).
CI запускает тесты без production-данных и секретов.

- [Продукт](docs/PRODUCT.md) и [план развития](docs/ROADMAP.md)
- [Архитектура](docs/ARCHITECTURE.md) и [дизайн](docs/DESIGN.md)
- [История выпусков](docs/TESTFLIGHT_CHANGELOG.md)
- [Работа с контентом](docs/wiki-production-pipeline.md)
- [Все документы](docs/README.md) и [безопасность](SECURITY.md)

`/prototype` содержит демонстрационные экраны. Статусы выпусков и ограничения
проверок указаны в changelog. Права на сторонние компоненты и дизайн сохраняются;
репозиторий не предоставляет новую open-source лицензию.
