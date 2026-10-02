# Дейчи: внешний TestFlight и App Store — 2 октября 2026

Проверка готовности и план работ, не запись о выпуске. Новые бинарники,
отправка на Review, публикация ссылки и настройки Apple в этой задаче не менялись.

## Решения владельца

- Первая внешняя бета: **публичная ссылка, максимум 50 тестировщиков**.
- Оператор пока — владелец лично; возможная передача школе — отдельный этап.
- Распространение приложения не открывает wiki/Zoom всем: сохраняется одобрение
  организатором. Не возвращать приватный bundled snapshot старой беты.
- Публичный контакт поддержки и приватности: **dev@mypraxis.ai**.
- Wiki бесплатна; **онлайн-занятия оплачиваются**, ссылки на них требуют запроса
  доступа. Позднейшее уточнение владельца заменяет ответ «оплачиваются только
  очные занятия». Требуется отдельно определить, сохраняется ли одобрение для
  самой бесплатной wiki. Пока текущие gate не менялись.
- Страны App Store, сроки хранения и права на контент ещё уточняются.

## Вывод

Build 13 подходит как исходная база, но **не готов к внешнему распространению**.
Нужны приватность/удаление данных, пригодный для Apple review-доступ, физическая QA
и новая загрузка без Internal Only. App Store требует ещё заполнения карточки,
деклараций и выбора коммерческих/региональных настроек. Одобрение Beta App Review
не заменяет проверку App Store; внешняя бета — выбранный нами этап, а не обязательное
требование Apple перед App Store.

## Проверенные факты

Источник release: `testflight/ios-1.0.0-13` → `e57c482`. Общий HEAD `e505400`
и большой dirty worktree не равны выпущенному snapshot. Перед новой сборкой
изолировать только относящиеся к ней изменения; не коммитить весь worktree.
История выпуска: [changelog](TESTFLIGHT_CHANGELOG.md),
[артефакты и QA build 13](release-preparation-2026-10-01/README.md).

App Store Connect проверен через существующую вкладку Chrome после входа владельца:

| Поверхность | Наблюдение 2 октября |
|---|---|
| TestFlight | 1.0.0 (13), **Internal**, **Testing**, «Личное тестирование», 4 приглашения; install/session/crash metrics показаны как «–», не как доказанный ноль |
| Внешняя группа | «Внешнее тестирование», ID `cfd6b93e-ea26-45e5-9950-10c453c5c26c`; 1 tester, **0 builds**, public link ещё не создана |
| App Store | Версия **1.0**, **Prepare for Submission**; build не выбран |
| Скриншоты | 6.5-inch: 0/10; previews: 0/3 |
| Карточка | Description, Keywords, Support URL, Copyright пусты; subtitle пуст |
| App Information | Имя «Дейчи», Russian, bundle ID `ai.mypraxis.quietpractice`; category не выбрана, age rating и content rights не настроены |
| App Privacy | Privacy Policy URL отсутствует, декларация ещё на Get Started |
| Test Information | Старое описание «Тихая практика», Feedback Email заполнен; Privacy Policy URL пуст |
| Beta review | Контактные имя/фамилия/телефон/email и notes пусты; Sign-in required выключен, хотя wiki/Zoom закрыты |
| Store review | Контакты, credentials и notes пусты; Sign-in required включён |
| Store release | Сейчас выбрано **Automatically release after approval**; рекомендован ручной выпуск, настройка пока не менялась |

В исходниках `export-options.plist` содержит `testFlightInternalTestingOnly=true`.
Уже загруженный Internal build нельзя просто назначить внешней группе.
Новая сборка должна загружаться через обычный App Store Connect и иметь новый
уникальный build number (следующий кандидат — 14, сверить перед использованием).
[Правила внешнего TestFlight](https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers/).

Read-only проверка финального archive 13: Xcode 27 / `27A266a`, SDK iPhoneOS 27.0,
minimum iOS 16.4, UIDeviceFamily `[1]` (iPhone). Apple принимает Xcode 27 / iOS 27
для Store и внешнего TestFlight с 14 сентября; смена SDK сейчас не нужна.
[Apple release notes](https://developer.apple.com/help/app-store-connect/release-notes/).
В архиве 13 privacy manifests, включая основной; это не замена App Privacy и
проверке того, какие данные отправляет собственный backend.

Публичные HTTPS GET без credentials: `/health` и `/api/v1/schedule` → 200;
`/api/access/session`, `/api/wiki/materials`, `/api/access/zoom` → 401.
Во всех этих ответах `Cache-Control: no-store`. `/privacy` → 404.
Origin `https://daychee-api-production.up.railway.app`. Это проверка с Mac,
не подтверждение работы на пользовательском iPhone.

## До отправки первой внешней беты

1. **Политика приватности.** Подтвердить имя оператора и публичный контакт,
   фактические сроки/поставщиков; подготовить публичную HTTPS-страницу и доступную
   ссылку в приложении. Сейчас в «О приложении» такой ссылки нет.
   [Требования App Privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/).
2. **Удаление заявки и персональных данных.** В заявке сохраняются имя, фамилия,
   необязательный Telegram и серверная идентичность. Logout удаляет сессию, но
   оставляет эти записи. По характеру сценария это вероятно создание учётной
   записи, даже без пароля. Консервативный путь: доступное из приложения удаление
   данных pending/approved/rejected/revoked заявителя с отзывом доступа и понятным
   результатом. Не подменять удаление выходом или письмом в поддержку.
   [Apple: account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/).
3. **Доступ ревьюера.** Подготовить действующий способ проверки wiki и Zoom,
   не требующий ожидания организатора. Обычный код одноразовый, один телефон,
   срок активации 7 дней: заранее активированный или истекающий код ненадёжен
   для очереди и повторной проверки Apple. Определить review-доступ без обхода
   авторизации для обычных пользователей; хранить credentials вне Git и текста
   публичных документов, передать только Apple в закрытых review-полях.
   [App Review](https://developer.apple.com/app-store/review/).
4. **Релизные маршруты и разрешения.** `src/app/prototype.tsx` и `explore.tsx`
   входят в router; prototype показывает mock UX, explore использует старый API
   с fallback localhost. Проверить внешние entry points и исключить случайную
   доступность демонстрационных/legacy экранов в public binary. В архиве есть
   английское `NSCalendarsFullAccessUsageDescription`; локализовать точное объяснение,
   проверить iOS 16.4 permission и системный editor на iOS 17+.
5. **Физическая QA и дизайн.** Пройти матрицу ниже, сохранить фактические результаты.
   Прошлая симуляторная QA не доказывает доставку напоминаний на телефоне.
   Known visual/navigation mismatch по AGENTS.md блокирует приёмку.
6. **Пакет Beta Review.** Обновить название/описание, заполнить contact и notes,
   What to Test, policy URL, sign-in instructions. Приватный телефон вводить
   непосредственно в Apple, не в repo. Первый внешний build проходит полную
   Beta App Review. Согласовать готовый release candidate перед upload/review,
   затем назначить внутреннюю группу и после одобрения открыть ссылку с лимитом 50.
   [Test Information](https://developer.apple.com/help/app-store-connect/test-a-beta-version/provide-test-information/).

Недостающие UX удаления/приватности сначала передать Claude Design отдельным
кандидатом по AGENTS.md: entry/exit, confirmation, loading, offline, server error,
retry, completion и таблица переходов. Настройки → Приватность; Настройки → Доступ →
Удалить мои данные; pending/rejected/revoked тоже должны иметь путь удаления.
При неопределённом результате запроса не показывать ложный успех. Back сохраняет
исходный экран и черновик; удаление затрагивает только собственную идентичность.
Не включать в design prompt реальные wiki-тексты, приглашения или Zoom.
Этот абзац — подготовленный brief, он ещё не отправлен дизайнеру и не одобрен.

## Инвентаризация данных для политики и деклараций

| Данные | Фактическое поведение исходников | Что завершить |
|---|---|---|
| Имя, фамилия, Telegram заявки | SQLite сервера; доступны owner admin | Срок хранения, удаление, Name / Other User Contact Info |
| Заявка/доступ/сессия | Связанные server IDs и hashes; токен на телефоне в SecureStore | User ID, связь с личностью, удаление и восстановление из backup |
| Антиспам | Hash IP и временные записи; request-limit записи очищаются при следующей submit после часа | Учесть реальные edge/provider logs; hash не означает анонимность |
| Feedback | Текст, контакт и версия идут через сервер в Telegram организатору; SQLite хранит digest/operation/status/hash IP, не текст | Customer Support и явно запрашиваемые контакты; срок Telegram-хранения неизвестен; SQLite записи старше 30 дней очищаются при новой отправке |
| Выбор занятий, закладки, feedback draft | На устройстве | Не декларировать как server collection без обнаружения отправки |
| Wiki search | Поисковый запрос передаётся защищённому API | Проверить server/provider logs; Search History, если хранится дольше обслуживания запроса |
| Напоминания и календарь | Локальные уведомления; system calendar editor/Google Calendar URL | Описать разрешения и внешнюю передачу параметров события в Google по действию пользователя |
| Оригиналы материалов | Внешние URL открываются отдельно | Права на контент и собственные правила внешних сервисов |

Предварительный вариант App Privacy: данные для App Functionality, связанные с
пользователем — имя, контакт/Telegram, User ID, support content/контакты. Это проект
ответов, не сохранённая декларация. Tracking/рекламных SDK в изученном составе
не обнаружено; проверить итоговую сборку и поставщиков. Не выбирать «данные не
собираются». Не применять исключение для редкого feedback без сверки всех условий
Apple. Локальные данные отличаются от отправляемых; network request сам по себе
не доказывает длительное хранение поисковой истории.
[Определения Apple App Privacy](https://developer.apple.com/app-store/app-privacy-details/).

## Дополнительно до App Store

- Владелец подтвердил бесплатную wiki и платные онлайн-занятия. Бесплатная цена
  приложения не решает вопрос оплачиваемого цифрового доступа. Для текущих
  групповых онлайн-занятий есть существенный риск требований IAP: правило Apple
  3.1.3(d) различает one-to-one и one-to-many; нельзя автоматически применять
  исключение очных услуг 3.1.3(e). Проверить точный сценарий: приложение продаёт
  услугу или только даёт ссылку участнику с уже существующим школьным доступом,
  где проводится оплата и какой entitlement реально открывается. Не добавлять
  платёжный механизм и не скрывать платность в review notes до решения. Это
  оценка риска по правилам, не предсказание решения ревьюера и не утверждение,
  что любой Zoom URL автоматически требует IAP.
  [Review guidelines](https://developer.apple.com/app-store/review/guidelines/).
- Заполнить Description, Keywords, Support URL, Copyright, Category (кандидат
  Education), Content Rights и актуальную age-rating анкету. Subtitle рекомендуется;
  promotional text, marketing URL и app preview необязательны. Не заявлять
  медицинские эффекты, синхронизацию выбора между устройствами или готовность mock функций.
- Подготовить чистые runtime-скриншоты текущей версии без credentials, персональных
  данных и закрытых ссылок. Достаточен согласованный набор iPhone 6.9-inch или
  допустимый 6.5-inch; например 1320×2868 или 1242×2688. iPad native support сейчас
  не заявлен архивом; не расширять его автоматически из-за наличия iPad tab в ASC.
  [Apple screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/).
- Заполнить App Privacy, перепроверить export compliance с учётом фактической crypto
  (в архиве `ITSAppUsesNonExemptEncryption=false`), review notes и рабочие контакты.
- Выбрать страны и цену. Для EU App Store требуется самооценка trader и, при
  необходимости, проверенные контакты; статус нельзя вывести из «я физлицо».
  TestFlight сам по себе не требует решать EU Store-distribution trader вопрос.
  [DSA у Apple](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/).
- Проверить действующие Apple agreements/account status без автоматического
  принятия юридических документов. Выбрать manual release после одобрения;
  Mac/Apple Vision Pro availability проверить отдельно, не обещать непроверенные платформы.
- Проверить права школы/авторов на контент и бренд, поддержку внешних пользователей,
  нагрузку в пределах существующего Railway бюджета и восстановление backup.
  Это задачи готовности, не повод создавать новую оплачиваемую инфраструктуру.

## Матрица финальной iPhone QA

| Сценарий | Критерий |
|---|---|
| Clean install, Wi-Fi и mobile data, Tailscale выключен | Расписание/заявка доступны, правильное время Asia/Jerusalem |
| Upgrade с build 13 | Выбор, серии, закладки, сессия и черновик сохраняются |
| Доступ | Pending → approved → restart; rejection, revoke, invitation и review entry; без доступа wiki/Zoom закрыты |
| Напоминания | Permission allow/deny, доставка на lock screen при закрытом app, отмена/перепланирование без дублей |
| «Мои занятия» | Empty, регулярная серия/next date, skip/restore, one-off, серия вне загруженного окна |
| Календарь | Save/cancel/denied, разовая дата/серия, Jerusalem DST и другой device timezone |
| Back/close | Все entry points, вкладки, вложенные screens, filters/scroll/draft сохраняются |
| Ошибки и приватность | Offline/503/429/retry; policy link доступна без входа; удаление всех состояний собственного доступа |
| Экран и accessibility | Парные кадры по DESIGN.md; малый/большой iPhone, Dynamic Type, базовый VoiceOver |

Новый candidate после privacy/UX изменений требует повторной QA соответствующих
экранов. Не переписывать старую QA как проверку новой версии.

## Проверки, выполненные в этом аудите

Текущий worktree: `npx tsc --noEmit`, `npm run lint` — exit 0;
`node --test scripts/*.test.mjs` — **42 passed**;
`.venv/bin/pytest tests/test_daychee_access.py tests/test_access_requests.py
tests/test_access_request_api.py tests/test_access_request_notifications.py
tests/test_feedback.py tests/test_admin.py tests/test_daychee_proxy_limits.py -q`
— **34 passed**, одно существующее предупреждение Starlette/anyio.
JS сообщает существующее MODULE_TYPELESS_PACKAGE_JSON warning. Эти тесты не
подтверждают отсутствие runtime/design/notification ошибок.

Также прочитаны подписанный archive 13, export config, исходники access/feedback/
settings/calendar/wiki/router; проверены публичные GET и живые поля ASC. Новый
archive не создавался; физический iPhone, review-доступ и новый privacy UX ещё не
проверены. dSYM восьми frameworks остаются известным ограничением диагностики.

## Порядок следующей работы

1. Дособрать owner-факты: gate бесплатной wiki, точный путь оплаты онлайн-занятий,
   целевые страны, сроки хранения и полномочия на контент. Email и базовая платность
   уже подтверждены; не запрашивать повторно.
2. Утвердить недостающий privacy/delete UX; реализовать backend/client и политику,
   подготовить review-доступ и убрать legacy production entry points.
3. Пройти физическую и парную визуальную QA; собрать изолированный candidate
   1.0.0 (следующий свободный build) без Internal Only, подготовить release facts.
4. После разрешения конкретной сборки: upload → internal group Testing →
   Beta App Review → external Testing → public link с лимитом 50.
5. По результатам внешней беты закрыть существенные проблемы, закончить Store
   metadata/декларации → App Review → отдельно подтверждённый ручной App Store release.

Ожидание Apple не прогнозируется как гарантированный срок. Передача приложения
школе потребует подходящего Developer account и проверки условий transfer;
в этом этапе владелец/Apple team/bundle ID не меняются.
