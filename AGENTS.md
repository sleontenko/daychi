# Daychi

Перед продуктовыми изменениями прочитать README.md, docs/PRODUCT.md,
docs/DESIGN.md и docs/TESTFLIGHT_CHANGELOG.md. Для Expo действуют также
apps/practice-app/AGENTS.md.

- Сохранять принятый дизайн. `/prototype` — демонстрационные данные.
- Не публиковать корпус, рабочие базы, приглашения, Zoom-реквизиты и credentials.
- Расписание использует Asia/Jerusalem отдельно от timezone устройства.
- Сохранять bundle ID, URL-схему, ключи хранения и действующие API-интерфейсы.
- Названия и описания PR писать на английском.

## Дизайн и навигация

Каждый затронутый экран и состояние сверять с актуальным референсом из
docs/DESIGN.md. Сохранять парные reference/runtime снимки, исправлять расхождения.
Новый кандидат не заменяет принятый референс автоматически.

Для «Моих занятий» проверять пустой список, регулярную серию, ближайшую дату,
пропуск/восстановление, разовые даты и серию вне загруженного окна.
Проверять back/close и Android Back через реальные входы: вложенные экраны,
прямые переходы, смену вкладок и прокрутку. Выбор, фильтры, позиция и черновик
сохраняются; кнопки доступны внутри safe areas.

Неизвестный UX сначала описывается отдельным дизайн-кандидатом: вход/выход,
loading/offline/error/recovery и переходы. Использовать синтетические данные.
Известные визуальные или навигационные расхождения блокируют приёмку и выпуск.

## Выпуски

Выпуск требует явного разрешения в задаче. Для разрешённой TestFlight-сборки
назначить всех участников существующей внутренней группы тестирования без
повторного запроса и проверить назначение и статус Testing.

Обновлять changelog: поведение, фактически выполненные тесты, ограничения,
Apple status, source commit/tag. Не переписывать прошлые факты.
Simulator не подтверждает установку или доставку уведомлений на телефоне.
Перед выпуском сверять все затронутые состояния с дизайн-референсами;
сохранять принятую итерацию расписания build 5.
Исторические bundled-снимки закрытой беты не публиковать; новые версии
получают закрытый контент через авторизованный сервер.

## Вики и база знаний

Подготовка знаний, ASR, редактура, реестр и план ведутся в приватном
[sleontenko/daychi-knowledge](https://github.com/sleontenko/daychi-knowledge).
Локальный путь: `/Users/mac-mini-server/projects/daychi-knowledge`.
Перед продолжением старых задач читать его AGENTS.md и README.md;
подробности — docs/knowledge-repository.md. Не добавлять новые инструменты
редакционного пайплайна обратно в Daychi.

Здесь остаются приложение, сайт, wiki UI, сервер и действующие content/import API.
Стабильные ID, revisions, payload и доступ сохраняются. Runtime/API и UI QA
ведутся здесь; редакционные тесты и QA партий — в daychi-knowledge.
Рабочие данные остаются вне Git по прежним физическим путям; новый checkout подключает их ссылками.

## Workshop collaboration

Existing boundaries: Daychi app (`apps/practice-app`) and web wiki (`apps/wiki-graph`)
↔ Daychi backend (`practice_api`); the native schedule also reads the school's public HTML
(`apps/practice-app/src/features/schedule/load.ts`, `source.ts`). Schedule loading
applies Telegram corrections (`zoom.ts`); wiki and access clients use Daychi APIs
(`apps/practice-app/src/features/wiki/api.ts`,
`apps/practice-app/src/features/access/request-client.ts`, `apps/wiki-graph/src/library.js`).
Target boundaries, integration unverified: Daychi clients ↔ Cabinet backend;
Daychi backend ↔ Cabinet backend. The content API remains in Daychi.
See [current source evidence](https://github.com/dveyarangi/xuanxue-workshop/blob/HEAD/docs/current-system.md#daychi)
and [target contracts](https://github.com/dveyarangi/xuanxue-workshop/blob/HEAD/docs/boundaries.md#target-connections).

Use the [/collaborate skill](.agents/skills/collaborate/SKILL.md) at the start of every session,
before work affecting any boundary described above, and whenever coordinating
across projects or communicating with Workshop.

### Automatic continuation after Workshop onboarding

Operator authorization (2026-10-06): once Workshop explicitly acknowledges Daychi
installation acceptance in issue #2 and closes it as completed, proceed with issue
#6 under the project's existing rules without asking again whether to start.
Check the original issue and its discussion; closure alone is not acceptance.
Read current #6 dependencies and the shared contract before implementation.
Issue #5 provider conformance and controlled fixtures are required to finish the
actual native integration proof, not to begin client development after #2 acceptance.
Preserve unrelated work and use an isolated checkout when needed. This authorization
does not authorize publishing, deployment, TestFlight releases or fixture mutations.
While waiting, notify only on meaningful changes or a required operator action.
This instruction is durable authorization, not a configured background schedule.
