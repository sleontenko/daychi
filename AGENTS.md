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

Existing boundaries: native Daychi (`apps/practice-app`) and shared wiki reader
(`apps/wiki-graph`) ↔ Daychi content backend (`practice_api`). Native schedule
also retains its school-HTML and Telegram-correction path. Native/private reader,
Zoom and owner/import access remain Daychi-owned; Cabinet web authentication does
not replace them. [Current scope/evidence](https://github.com/dveyarangi/xuanxue-workshop/blob/25def59e25fc847764cc43de8d963bf62a16512e/docs/current-system.md#daychi).

Knowledge→Daychi editorial/owner import and shared reader→Daychi article/concept/
graph projections remain existing content boundaries. [Original article issue 9](https://github.com/dveyarangi/xuanxue-workshop/issues/9)
and Daychi's provider-owned content definitions govern active v1, projection,
identity/redaction and source consistency. Authentication work does not retire v1
or change editorial authority.

Accepted target boundaries, joint integration not established: Daychi clients ↔
Cabinet backend for schedule/account capabilities; Daychi backend ↔ Cabinet backend
for authoritative access checks. [Target contracts](https://github.com/dveyarangi/xuanxue-workshop/blob/25def59e25fc847764cc43de8d963bf62a16512e/docs/boundaries.md#target-connections)
and [native account-session profile](https://github.com/dveyarangi/xuanxue-workshop/blob/3c98d4a5201710f8f777183dd7b61caefe47e2d5/docs/contracts/native-account-session.md) own
their distinct scopes.

Accepted web-wiki target: Cabinet owns the shared browser session and current-account
validation; Daychi owns protected web delivery and calls Cabinet for each protected
read. All and only valid Cabinet-authenticated web readers receive the same content,
without extra wiki eligibility or persisted reader credentials/accounts.
[Web-wiki session contract](https://github.com/dveyarangi/xuanxue-workshop/blob/25def59e25fc847764cc43de8d963bf62a16512e/docs/contracts/web-wiki-session.md) owns common cookie,
entry/return, renewal/logout, environment separation and failure guarantees. Coordinated anonymous-access
cutover, recipient implementation and deployed proof are separate from acceptance.

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

Coexisting structured article layer deployed and pilot verified 2026-10-12: Knowledge→Daychi owner
article import; shared reader→Daychi opt-in article/concept/graph projections.
[Provider contract](docs/contracts/wiki-articles-v1.md) and
[Workshop9](https://github.com/dveyarangi/xuanxue-workshop/issues/9) preserve activev1
and admission. Recording IDs remain authorized-only under the11October protection.
[Runtime QA](docs/qa-wiki-articles-2026-10-11/README.md); no native release implied.

Local prepared web boundary (2026-10-13): isolated candidate implements Workshop #13
contract 25def59e with fixed production/staging profiles, per-read cookie validation,
recording protection, Cabinet entry/logout and reader teardown. 180 backend / 21 web
tests and synthetic Chrome pairs; default off, no deployment/release. Both real check
URLs returned 404; staging wiki HTTPS, aliases/caches and actual two-site lifecycle
remain unverified. Native public-reader migration needs #9 coordination; native/private
API and owner/import/Zoom authority are retained. [QA/cutover](docs/qa-web-wiki-cabinet-2026-10-13/README.md).

Website follow-up (2026-10-13): operator supplied app.xuanxue.su / app.xuanxue.su/wiki.
Prepared site links use that origin; enabled wiki entry aliases redirect to the
contract-fixed wiki origin while retaining query/browser hash. Public homepage
contains no corpus fetch. Candidate now carries hash-verified published c964041f
site/Android4/native privacy/session/retention/restore source; 198 backend tests and
59-file stage. Cabinet checks still 404 at 11:08 UTC, so activation/publication and
joint acceptance remain outstanding. [QA](docs/qa-site-cabinet-links-2026-10-13/README.md).

Operator graph clarification (2026-10-14): public homepage overview remains visible;
click/Enter offers Cabinet entry for the full reader. Separate minimal public
/api/site/wiki-graph exposes sections/counts and anonymous structure only; existing
reader APIs, material titles/text and recording IDs/URLs stay protected. Local
201 backend / 21 web tests, Chrome pairs, 59-file stage; no push/deployment/release.
Workshop exposure reconciliation and inspectable-source/joint proof still pending.
[QA](docs/qa-site-public-graph-2026-10-14/README.md).
