# История мобильных выпусков

Подготовка сайта 14 октября, без выпуска: по уточнению оператора вернули публичный
граф на главной; клик предлагает вход через кабинет. Отдельное минимальное превью
не раскрывает YouTube URL/ID, тексты и названия материалов. 201 backend / 21 web
tests, Chrome 390/1440 и состояния загрузки/ошибки/повтора/пустого графа проверены.
59-file stage подготовлен локально. Source branch codex/cabinet-web-wiki после
4e9f68e; без push/deployment/Apple upload/status change.
[QA и оставшаяся совместная проверка](qa-site-public-graph-2026-10-14/README.md).

Версия приложения — `1.0.0`; номер сборки указан в скобках.
Записи фиксируют состояние на указанную дату. Уточнения добавляются отдельно;
source tag не заменяет архив, статус Apple или проверку на устройстве.

## Серверная веб-вики — 2026-10-12 (11 октября UTC)

Добавлен совместимый слой структурированных статей: разделы и абзацы,
ссылки из текста на полные страницы понятий и подтверждённые переходы между
статьями. Railway `4605687f-4299-4eda-ac05-307ca29599b2` — SUCCESS;
source `151cbdf73560cc94d1019873326d5efab721e1ae`.
150 backend / 15 shared-web / 114 Knowledge tests; production assets, health и
защита доступа проверены. Приватный preview трёх статей и пяти понятий прошёл
DOM и Chrome QA. Импорт содержимого и production reader QA ещё ожидаются.
Мобильного выпуска и нового Apple upload в этой записи нет.
[Подробности и ограничения](qa-wiki-articles-2026-10-11/README.md).

Уточнение 2026-10-12: после явной приёмки точного hash опубликованы те же три
статьи и пять полных страниц понятий; первый receipt и идемпотентный повтор
подтверждены. Все восемь private/public DTO и production Chrome 1920×817 прошли
сверку текста, заголовков, ссылок и возвратов; восемь обновлений видны в recent.
Исходные конспекты/цитаты и поля каталога неизменны. Реестр объединён с сохранением
истории, временный QA-доступ отозван, обе задачи закрыты как verified.
Responsive и controlled error QA относятся к локальному кандидату с теми же
production assets; production mobile viewport и физический телефон не подтверждены.

## iOS (13), Android (3) — 2026-10-01

iOS: **Internal Only, Testing**; назначена внутренняя группа, What to Test сохранено.
Android: подписанный APK опубликован; HTTPS hash/MIME/attachment/Range проверены.
Source tags: `testflight/ios-1.0.0-13`, `android/1.0.0-3`.

Заявки и одобрение без кода, Telegram-уведомления, возвраты и сессии.
После отзыва «Подать заявку» открывает форму сразу.
QA: первоначально 40 Python + 42 JS; после правок TypeScript/lint,
11 JS request/session и Python requests/API/notification tests.
Production HTTP E2E и signed Android E2E прошли; две Telegram-доставки подтверждены.
Проверены дополнительные loading/server/limit/revoked состояния,
серия вне окна, Back и scroll.

Установка на физическом iPhone, physical-device напоминания и accessibility
не подтверждены. dSYM восьми prebuilt frameworks отсутствуют.
[Краткий QA и source manifests](release-preparation-2026-10-01/README.md).

## Подготовительные изменения — 2026-09-30

Заявки: имя/фамилия, необязательный Telegram, ожидание и получение доступа
после одобрения; admin принимает/отклоняет. Исправлены вложенный Back
и гонки сохранения сессии. 40 Python + 42 JS, TypeScript/lint;
локальный iPhone/API/admin E2E, отказ, рестарт и возврат прошли.
Release Simulator и Android QA APK собраны.
На эту дату полная UI QA и реальная доставка ещё не завершены;
отдельного выпуска нет. Изменения вошли в последующую подготовку build 13.

## Подготовительные изменения — 2026-09-28

Обратная связь переведена на серверную отправку без перехода в Telegram.
Ошибка сохраняет черновик и operation ID; успех — после подтверждения доставки.
TypeScript/lint, Release Simulator, валидация, возврат и реальная серверная
отправка проверены. На эту дату новый мобильный бинарник не загружен.

## iOS (12) — 2026-09-28 — Testing

Railway HTTPS API; уточнён экран доступа, возврат после ошибки приглашения,
копирование Zoom-пароля и сохранение позиции вики при перепроверке доступа.
Source commit `eefbcc4`; tag `testflight/ios-1.0.0-12`.

TypeScript/lint, 31 JS; E2E нового API, приглашение, каталог, сессия,
Zoom-пароль и отзыв. Release Simulator: invalid/401 и возврат.
Подписанный архив загружен, processing Complete, внутренняя группа назначена,
What to Test сохранено. dSYM восьми сторонних frameworks отсутствуют.
Установка на физическом iPhone и проверка без Tailscale не подтверждены.

## Локально после build 11 — 2026-09-25

«Мои занятия»: регулярные карточки, ближайшая дата, возврат пропуска,
компактные даты, пустое состояние и отмена. Исправлены вложенные/прямые возвраты,
стрелки и сохранение вкладок/позиций списков.
TypeScript/lint, 30 JS, Release iOS 27 Simulator прошли.
На эту дату полная приёмка не завершена; нового архива/upload нет.

## iOS (11) — 2026-09-24 — Testing

Новый дизайн, имя Дейчи, три вкладки и настройки; персональный HTTPS-доступ
к вики/Zoom вместо bundled-каталога. Приглашения: 7 дней на активацию,
доступ до отзыва. Старый выбор и закладки сохранены.
Source commit `9358e17`; tag `testflight/ios-1.0.0-11`.

Подготовка первоначально называлась build 10: 27 JS, 45 backend,
TypeScript/lint; iOS 27 Simulator — cold/warm вход, сессия, каталог, закладки,
отзыв, offline/recovery, Zoom и Calendar. Android Metro export прошёл;
APK/native Android QA тогда отсутствовали.
Подписанный архив 11 загружен; processing Complete, внутренняя группа,
What to Test и Testing подтверждены. dSYM сторонних frameworks отсутствуют.

Уточнение 2026-09-24: на физическом iPhone ссылка открыла экран приглашения,
но вход завершился TLS-ошибкой. Успешный вход, Telegram feedback,
реальная доставка уведомлений и сохранение в календарный аккаунт
на эту дату не подтверждены.

## iOS (10) — 2026-09-24 — Processing

Загружен прежний архив build 9 с submission number 10.
Это закрытая бета прежнего кода, а не реализация Дейчи из build 11.
Upload completed with warnings; назначение группе в этой проверке не выполнено.

## iOS (9) — 2026-09-24 — загружен

Еженедельные серии, пропуск/возврат даты, управление выбором;
экспорт даты/серии в iPhone/iCloud и Google Calendar; меню 13 категорий вики.
Source commit `cb56207`; отдельный source tag не зафиксирован.

TypeScript/lint, 25 JS; iOS 27 Release Simulator — подписка, рестарт,
пропуск/возврат, отмена pending reminders, разовый выбор, Calendar и фильтры.
Подписанный архив и Internal Only upload успешны; dSYM warnings.
Processing, назначение группе и Testing на эту дату не подтверждены.

Напоминания ограничены загруженными 14 днями. Calendar — отдельная копия;
повторный экспорт может создать дубликат. Физический iPhone, реальный календарь,
iOS 16 denied permission и большой Dynamic Type не проверены.

## iOS (8) — 2026-09-19 — Testing

Zoom для 18 серий недели и три исправления времени окончания.
Привязка проверяет ID, день и начало по Asia/Jerusalem;
отменённые/прошедшие занятия не предлагают подключение.
Source commit `dc46f6b`; tag `testflight/ios-1.0.0-8`.

TypeScript/lint, 18 JS; все 18 серий совпали с HTML,
36 Zoom-встреч на 14 дней, 24 встречи без чужих ссылок.
Release iOS 27 Simulator: детали, пароль и Zoom-кнопка.
Подписанный архив/upload, Complete, внутренняя группа и What to Test подтверждены.
Физический iPhone, установленный Zoom и реальная доставка не проверены.
Приватные ссылки встроены только в эту историческую закрытую бету.

## iOS (7) — 2026-09-19 — Testing

Вход/выход вики убран для закрытой беты; 1145 материалов встроены локально.
ID и закладки сохранены; исходные ссылки требуют сети.
Source commit `d9d6945`; tag `testflight/ios-1.0.0-7`.

TypeScript/lint, 16 JS, 41 backend; iOS 27 Release Simulator:
каталог без входа и прежняя закладка. Подписанный архив и Internal Only upload,
Complete, внутренняя группа и What to Test подтверждены.
Физический iPhone и доставка не проверены; TLS-проблема build 6
не объявлена исправленной. Снимок остаётся приватным и не публикуется.

## iOS (6) — 2026-09-19 — Testing

Вики с общим защищённым входом: каталог, поиск, разделы, детали и закладки.
Expo 57 / UIScene для Xcode 27.
Source commit `8fd46ff`; tag `testflight/ios-1.0.0-6`.

TypeScript/lint, 14 JS, 40 backend; Debug и Release iOS 27 Simulator:
вход, каталог, сессия, закладка и возврат. HTTPS: anonymous 401,
1145 записей после входа, поиск/детали/no-store/logout.
Подписанный архив/upload, Complete, What to Test и внутренняя Testing подтверждены.
Большой Dynamic Type, физический iPhone и доставка не проверены.

## iOS (5) — 2026-09-18 — Testing

Светлые группы дней, колонка времени, отдельные метаданные,
мягкое выделение выбора и сегодняшней даты, системная iOS-типографика.
Source commit `9761ea5573858805fc2d983bd5e7d78e6ea9d198`;
tag `testflight/ios-1.0.0-5`.

TypeScript/lint, 14 JS, native Simulator QA.
Подписанный архив/upload, Complete, внутренняя Testing и What to Test подтверждены.
Экспорт допускает external review, но внешняя проверка не отправлена:
review contact не заполнен, внешняя группа без доступной сборки.
Реальная доставка не проверена.

## iOS (4) — 2026-09-17 — Testing

Контрастная дата, «Я иду», фильтры онлайн/очно и полноценные детали занятия.
Прошедшая встреча показывает статус вместо выбора.
Source commit `a43c55e534e1c255ad5df873d58386d50e1c6ed6`;
tag `testflight/ios-1.0.0-4`.

TypeScript/lint, 14 JS; iPhone 17 Pro Release Simulator:
расписание/детали, фильтры, выбор/отмена и pending reminder.
Архив/upload, Complete, внутренняя Testing и What to Test подтверждены.
Установка и доставка на физическом iPhone не подтверждены; dSYM warnings.

## iOS (3) — 2026-09-17 — Testing

Рабочие «Сегодня / Расписание / Мои занятия»; локальный выбор,
кэш и уведомления 0/15/30/60 минут. Прямой HTTPS-импорт сайта
как резервный путь. Старые серверные напоминания отключаются перед локальными.

12 JS, 36 backend, TypeScript/lint; iOS 26.5 Release Simulator:
загрузка, выбор, рестарт, смена времени, отмена и lock-screen доставка.
При недоступном сервере прямой импорт работал; сайт и API совпали по 60 встречам.
Архив/upload и внутренняя Testing подтверждены; physical-device доставка нет.
Выбор тогда ограничен разовыми датами на 14 дней.
Тег `testflight/ios-1.0.0-3` — поздний импорт исходников,
не ретроспективная привязка первоначального архива.

## iOS (2) — 2026-09-17 — установленная бета

Серверное расписание, preferences и APNs с ручным подключением, иконка.
Архив/upload, Testing и установка на телефоне подтверждены.
На телефоне обнаружены TLS-ошибка и недоступное расписание;
APNs-доставка не подтверждена. Исправление основного сценария — build 3.

Доступный TestFlight build 1 не подтверждён.

## Запись следующего выпуска

Указать дату, версию/build, commit/tag, статус Apple/распространения,
добавлено/исправлено/изменено, реально выполненные тесты,
устройства и ограничения. Новые результаты добавлять с датой.
dSYM warnings ограничивают символикацию сторонних библиотек;
успешный upload не подтверждает работу на телефоне.

## Подготовка веб-вики с Cabinet — 2026-10-13, без выпуска

Локальный кандидат: серверная проверка каждой сессии, Cabinet entry/logout,
защита ссылок на записи, очистка состояния при отказе и независимые staging/production
профили по контракту 25def59e. 180 backend / 21 web tests, web build и синтетический
Chrome QA; парные reference/runtime кадры сохранены. Source base
`d2cde6b93ef79734e4de0438ddc2e138698214af`, branch `codex/cabinet-web-wiki`.
Оба реальных session-check endpoint отвечают 404; staging wiki HTTPS не подтверждён.
Нет deployment, DNS/cache изменений, нового Apple upload, release tag или изменения
Apple status; предыдущие мобильные факты этой записью не подтверждаются заново.
[Проверки, исходники и оставшаяся совместная проверка](qa-web-wiki-cabinet-2026-10-13/README.md).

Уточнение веб-кандидата 13 октября: ссылки сайта и alias app/wiki подготовлены
на основе последнего опубликованного c964041f пакета, сохраняя Android4, native
session-details, retention/restore и текущие public pages. Главная не читает корпус
анонимно; вход ведёт к закреплённому wiki origin с исходным hash/query.
198 backend tests, public-pages recheck, Chrome 360/390/768/1440 и 59-file stage.
Оба endpoint кабинета снова вернули 404 в 11:08 UTC. Deployment и Apple status
не менялись. [Новая проверка сайта](qa-site-cabinet-links-2026-10-13/README.md).

Уточнение 14 октября вечером, без выпуска: Workshop принял публичный обзор графа
в контракте d689c24. В локальный Cabinet-кандидат перенесён опубликованный main
c7af6f6, сохраняя архив и private/public redaction. 237 backend / 23 web tests,
61-file stage. Реальный совместный вход и публикация не подтверждены; регулярная
проверка подготовлена, но расписание ещё не создано. [Проверка](qa-cabinet-followup-2026-10-14/README.md).

Уточнение ревью 14 октября, без выпуска: Workshop проверил опубликованный PR13 и
не нашёл дефекта общего контракта в исследованном объёме. Локальную ошибку Windows
cp1252 исправили явным UTF-8 при чтении HTML; четыре регрессионных случая сначала
воспроизвели отказ, затем прошли. 43 boundary / 241 backend tests; native Windows
запуск не выполнялся. HTML, frontend bundle, дизайн и Apple status неизменны.
[Проверка и ограничения](qa-cabinet-followup-2026-10-14/README.md).


## 2026-10-17 · consolidated source only, no new release

Operator-requested Git synchronization combines PR12/13/15 and restores omitted
historical build18 privacy/settings/native-reader/iPad source. Native account #8 is
accepted; web SSO, native Cabinet content and shared selection/reminder sync retain
their separate outstanding work. [Source/checks/current limits](qa-git-sync-2026-10-17/README.md).
241 backend /125 app /30 wiki tests, TypeScript/lint and iOS JS/Hermes export passed.
No Apple query/upload/group change, source-main merge, production activation or
new release occurred in this source task. The preceding internal TestFlight18 receipt
remains the latest Apple evidence; new consolidated native visual/release QA remains.
