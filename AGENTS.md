# Daychi

20October2026 authorized isolated native-material staging is prepared on
codex/native-materials-staging-20261020 from published PR18 bb7295f.
Product modules are unchanged; deployment/bootstrap/tests are separate and
synthetic. [Runtime scope and checks](deploy/native-materials-staging/README.md).
Only dedicated staging service bdb1c01d is authorized; no production or current
TestFlight change, account/grant/status/outage mutation or reader release.
Runtime follow-up: published f8c28dc fixes first bootstrap failure;296 backend
tests pass. Native Debug PR18 client is built/installed and ordinary signed-out
gate verified. Railway pauses deploys, so corrected API is offline/not queued;
do not claim joint readiness. [Actual deployment/client status](docs/qa-native-materials-staging-2026-10-20/README.md).
Retain f8c28dc source pin rather than following docs pushes; use exact staging
service after capacity returns, preserving browser staging d8f2d41d.

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

Existing boundaries: Daychi native app (apps/practice-app) and web wiki
(apps/wiki-graph) ↔ Daychi backend (practice_api); Knowledge supplies reviewed
editorial/import inputs. Daychi owns content and its client/API transport;
Cabinet owns account/session validity. Existing native/owner/import/meeting access
and content v1 remain fulfilled until their independently coordinated transition.

Accepted schedule/native-account targets remain governed by the
[target contracts](https://github.com/dveyarangi/xuanxue-workshop/blob/a07f08747aa7d97e4d3496e87e1d8319db413698/docs/boundaries.md#target-connections) and
[native account profile](https://github.com/dveyarangi/xuanxue-workshop/blob/a07f08747aa7d97e4d3496e87e1d8319db413698/docs/contracts/native-account-session.md). Native sign-in,
renewal, secure storage and installation-scoped sign-out remain their own scope.

Accepted native content connection: each protected Cabinet-authenticated native
read forwards the presented bearer to the fixed matching Cabinet GET me. Its
current native grant/account decision is sufficient; no additional reader role,
invitation, account replica or positive cache is used. Daychi owns explicit
coexistence with legacy native transport, downstream protected delivery and
failure/recovery. Cabinet isolates validated GET me capacity per native grant.
The [native content contract](https://github.com/dveyarangi/xuanxue-workshop/blob/a07f08747aa7d97e4d3496e87e1d8319db413698/docs/contracts/native-content-session.md) owns exact
wire, capacity, compatibility and common cases; activation and joint proof remain work.

Accepted browser-wiki target remains separate under the
[web-wiki contract](https://github.com/dveyarangi/xuanxue-workshop/blob/a07f08747aa7d97e4d3496e87e1d8319db413698/docs/contracts/web-wiki-session.md): shared Cabinet browser cookie,
per-request authoritative check, fixed matching environment, renewal/return/logout,
protected reader delivery and coordinated origin/path/cache transition. The
limited public homepage graph overview remains its canonical exception. Native
bearers do not replace this browser policy. Knowledge's editorial/import ownership
and structured-article compatibility remain unchanged.

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

Operator follow-up authorization (2026-10-14): regularly inspect Cabinet/Workshop
updates and autonomously process ordinary technical tasks/comments, replying in
the original assignment and reporting meaningful changes. Ask for new product
decisions; preserve explicit release/publication/destructive approval boundaries.
Requested cadence preparation is hourly, quiet while unchanged. A saved prompt
does not establish an active schedule; verify task creation/enabled state before
claiming unattended execution. Main handoff: docs/handoffs/cabinet-workshop-recurring-check.md.

Cabinet follow-up (2026-10-14 evening): active shared web authority is d689c24;
public homepage preview exception accepted, not implementation/release acceptance.
Current staging e0e823c guest entry/login/logout page verified read-only; production
check still404, staging wiki ConnectError at16:31UTC. Isolated candidate incorporates
current published c7af6f6 archive changes; 237 backend/23 web tests,61-file stage,
no push/deployment. Automation is prepared but NOT activated: scheduling tool absent
and Codex UI access disabled. [QA](docs/qa-cabinet-followup-2026-10-14/README.md).

Published-source review (2026-10-14): Workshop resolved source access at bdc3cf7/
draft PR13 and found no contract defect in the inspected source/test scope. Local
Windows cp1252 HTML-read finding is fixed with explicit UTF-8; four emulated-default
regressions and 43 boundary / 241 backend tests pass. Frontend/design unchanged.
No merge/deployment; actual hosting/account/cutover proof remains outstanding.
[Review/fix QA](docs/qa-cabinet-followup-2026-10-14/README.md).


## Consolidated source baseline · 17 October 2026

The operator requested a Git/source audit and synchronization before the next design version.
Use this isolated `codex/sync-cabinet-baseline-20261017` checkout for that candidate;
root main is occupied by preserved historical WIP. Do not clean/reset/stash it.
[Source/status inventory](docs/qa-git-sync-2026-10-17/README.md) governs current readiness.
Historical pending/release statements above retain their dated scope.

Native Cabinet sign-in and full joint #8 were accepted at Workshop baaf00ed under
full profile18cfe41, tested d1a85fe. [Acceptance](https://github.com/dveyarangi/xuanxue-workshop/issues/8#issuecomment-6234027930).
Reuse accepted evidence; no successful-case replay or role removal is requested.
Operator requires retaining the staging Teacher/Developer roles for further testing.

Web #12/13 still needs canonical staging DNS/TLS, authorized two-site session proof,
reader/cache transition and separately authorized rollout. Native content #15/16 is
separate: its occupied worktree is `/Users/mac-mini-server/projects/worktrees/daychi-native-content-20261016`.
Preserve its uncommitted candidate; no common-content activation is included here.
Public lessons #6 remains a separate read-only source, with partial live evidence;
shared selections/reminders are pending the full contract requested in Workshop #17.
Do not invent a shared sync wire or conflate Cabinet account sign-in with content access.

For Workshop reads/comments prefer the available GitHub connector. A recurring
prompt alone does not establish an active schedule. Release audience remains
internal TestFlight/staging; current build18 availability is recorded separately.
A next changed binary needs an unused build number, affected-state visual/native QA,
source pin and explicit release authorization. This source sync does not release it.


Publication blocker for the17October source-sync candidate: local source4ad34ed is
committed, but push has no valid terminal authentication and GitHub connector Git
writes returned403. No remote sync branch/PR was created. Restore authorized write
access before publishing; do not bypass the connector permission denial. Track the
[publication receipt](docs/qa-git-sync-2026-10-17/publication-status.json).


17October publication follow-up: after explicit operator repository reauthorization,
the previously denied connector Git-blob write succeeds. The preceding block is a
historical receipt, not a current permission denial. Continue this branch's prepared
publication through the connector; verify final source-tree identity and CI.


Consolidated source published after reauthorization: [draft PR16](https://github.com/sleontenko/daychi/pull/16),
source883f5d6 and complete tree f31b643b2ced4f9c4e7206043f450e333e49218f. Local/remote
source trees match; original local authoring commits are preserved on
codex/sync-cabinet-local-before-connector-20261017. Earlier access-denial statements
are historical. No main merge/deployment/new release. Use the source-sync receipt
for current CI and preserve the separate native-content WIP and root historical WIP.


Cabinet completion follow-up (2026-10-17): source reconciliation PR16 and native
bootstrap PR17 are merged; main c146326. Native-account Workshop8 is explicitly
accepted/closed at baaf00ed (profile18cfe41, tested d1a85fe); do not repeat passed
account evidence. Existing TestFlight1.0.0(18) is now operator-authorized for
external testing: Apple APPROVED / IN_BETA_TESTING, public group assignment and
unchanged join/GW9GB7mS link verified. See docs/qa-external-testflight18-2026-10-17.
Current native content preparation is draft Daychi PR18, source cdd11a55, isolated
at data/worktrees/cabinet-content-current-20261017. 292 backend/134 app tests,
typecheck/lint pass; default-off server/session/transport only, current WebView
mount/lifecycle/UI proof remains Daychi work. Provider15 capacity/deployment and
joint proof remain dependencies; browser13 temporary-origin and shared sync17
wire/clock/migration are requested in the original assignments. No new native
binary, protected-content activation or production deployment. Old occupied
native-content36 files and root WIP remain preserved.

Native reader mounting continuation (2026-10-17): PR18 now connects the current
shared native wiki through a separate default-off Cabinet host. Private WebView
generations are destroyed on account/lifecycle/failure changes; same-account
navigation metadata and existing saved-ID keys survive revalidation. Source URLs
are freshly rechecked; Zoom remains independently legacy-authorized. 292 backend /
141 app /31 wiki tests, typecheck/lint and normal iOS/Hermes exports with content
off/on pass. Actual synthetic WKWebView phone/iPad checks and their limits are in
docs/qa-native-content-ui-2026-10-17/README.md. Provider15 deployed capacity and
real joint16 proof remain pending. Full-parent/Android QA remains before a new
binary; no production activation, new release or design-reference promotion.
QA overrides/services were removed/stopped, normal Expo entry restored. Historical
root520 and occupied old native-content36 inventories remain hash-identical
apart from intentional root handoff updates.


Native navigation preparation (2026-10-17): PR18 full-parent follow-up is documented
in docs/qa-native-navigation-2026-10-17/README.md. Installed synthetic iPhone/iPad
portrait+landscape/Android Back checks cover actual Router/ScheduleScreen/Settings.
Fixed async initial-fit camera overwrite and WKWebView history.state scroll loss;
Cabinet-enabled native privacy introduction corrected. Exact camera equality on
three devices and article offsets377/1988/443.4285583496094 recorded. 292backend/
141app/31wiki, typecheck/lint and normal off/on iOS Hermes exports pass; QA overrides
restored. Workshop16 mounted-source review6238564666 supports source progress;
provider15 deployed capacity and authorized joint proof remain. No activation,
PR merge, production change or new native upload. Existing external18 unchanged.
