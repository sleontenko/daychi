# Архитектура

| Компонент | Код | Конфигурация |
|---|---|---|
| Клиент Expo | `apps/practice-app/src/` | `EXPO_PUBLIC_SCHEDULE_API_URL`, `EXPO_PUBLIC_DAYCHEE_API_URL` |
| Основной FastAPI | `practice_api/daychee_app.py` | `DAYCHEE_*` |
| Публичное расписание | `practice_api/schedule_app.py` | Источник школы, Asia/Jerusalem |
| Приглашения и заявки | `invitations.py`, `access_requests.py`, `access_request_api.py` | `DAYCHEE_ACCESS_DATABASE`, флаги функций |
| Вики и Zoom | `wiki_app.py`, `wiki_content.py` | `WIKI_INDEX`, `WIKI_DATABASE`, `DAYCHEE_ZOOM` |
| Админка | `admin.py`, `admin_web/` | Отдельная административная сессия |
| Веб-вики | `apps/wiki-graph/src/`, `wiki_graph.py`, `public_wiki.py` | Авторизованные API |
| Старый corpus API | `practice_api/app.py` | Отдельная закрытая система |

Серверные пути в таблице относительны к `practice_api/`.
Клиент хранит выбор, напоминания, закладки и навигацию на устройстве;
сессии — в SecureStore. Рабочие индексы и SQLite подключаются отдельно.
В актуальную мобильную сборку каталог и Zoom-реквизиты не встроены.

## Локальная работа

```sh
python -m uvicorn practice_api.schedule_app:app --host 127.0.0.1 --port 8001
# Основной сервис:
python -m uvicorn practice_api.daychee_app:app --host 127.0.0.1 --port 8768 --no-access-log
```

Без индекса закрытые материалы недоступны. API-тесты используют
`create_daychee_app`, `create_wiki_app`, временные SQLite и fixtures из `tests/`.
Они не требуют реального Telegram или корпуса. Native integration персонального
доступа требует HTTPS с тестовыми данными.

## Сборка и сервер

`npm run build` в `apps/wiki-graph/` сохраняет bundle в
`practice_api/wiki_graph_web/`; сервер запускается без Node.js.
При изменении исходников обновляйте bundle.

Конфигурация Railway/Docker — `deploy/daychee/`.
`scripts/daychee-stage.py` собирает allowlist-каталог без данных и секретов.
Текущие in-memory лимиты и сессии требуют одного worker; масштабирование
требует отдельной проверки. SQLite переносится через согласованную backup-копию.

Timezone устройства не меняет timezone расписания. Legacy ID, URL-схема,
ключи хранения и `DAYCHEE_*` сохраняют [совместимость](daychi-rename.md).
Флаги и release tags определяют поведение конкретной версии; main может
содержать более поздние изменения, чем опубликованный бинарник.

Legacy schedule launch: `scripts/run_schedule_service.sh` требует
`SCHEDULE_PRIVATE_DB`; опциональный `DAYCHI_SERVICE_ENV` подключает приватный
config с `export APNS_*`. LaunchAgent plist — шаблон абсолютных путей,
подставляемых перед установкой. Настройки машины в Git не входят.
