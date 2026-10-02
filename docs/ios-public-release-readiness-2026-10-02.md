# Внешний TestFlight и App Store · 2026-10-02

План первой внешней беты: публичная ссылка с лимитом 50 участников.
Целевая модель: бесплатная вики без заявки; закрытые онлайн-ссылки —
после одобрения. Оплата проводится школой вне приложения.
Telegram в заявке необязателен и не удостоверяет членство.
Контакт: dev@mypraxis.ai. Страны, сроки хранения и права на контент уточняются.

## Опубликованная версия

iOS 1.0.0 (13): Internal Only, Testing; нативный каталог/поиск/закладки
без нового web reader, графа и отображения аннотаций.
Внешняя группа без сборки/публичной ссылки.
App Store 1.0: Prepare for Submission; metadata, скриншоты,
App Privacy и review contact/access не завершены.
Automatic release выбран; переключение на Manual не выполнено.

Archive 13: Xcode 27, iPhoneOS 27.0, minimum iOS 16.4, iPhone.
dSYM восьми frameworks отсутствуют. Privacy manifests не заменяют App Privacy.
Production веб-вики имеет reader, recent, аннотации/цитаты и Sigma/d3-граф.
45 черновиков / 135 цитат не являются одобренными преподавателем статьями.

## Локальная следующая версия

Подготовлены функции за выключенными по умолчанию флагами; сервер/Apple
ещё не обновлены:

| Функция | Конфигурация / граница |
|---|---|
| Публичные wiki DTO | `DAYCHEE_PUBLIC_WIKI_ENABLED`; allowlist исключает Zoom/credentials/raw fields |
| Удаление собственной идентичности | `DAYCHEE_DATA_DELETION_ENABLED`; proof, отзыв grants/sessions, идемпотентный receipt |
| Privacy/support страницы | `DAYCHEE_PUBLIC_PAGES_ENABLED`; текст пока черновой |
| Native privacy/access/delete | Референс `design/approved/privacy-delete-2026-10-02.html`; синхронизация текста `scripts/sync-public-privacy.py` |
| External export | `export-options-external.plist`, без Internal Only и автоматического upload; build number пока 13 |

Нативный публичный каталог запрашивается отдельно от защищённых деталей.
Выход/отзыв не закрывает бесплатный текст. Граф/аннотации native не добавлены.
Web frontend пока использует protected API; публичный DTO не означает
открытый production сайт. Prototype/explore закрываются production guard.
Удаление сохраняет выбор/напоминания/закладки; network/5xx не означают успех,
deletion proof/receipt сохраняются до завершения локальной очистки.
Новая runtime/design QA, retention/backup restore и review-доступ ещё нужны.

## До отправки

1. Завершить политику, сроки/поставщиков и удаление для всех состояний доступа.
2. Подготовить review-доступ без ручного ожидания и истекающего одноразового кода.
3. Проверить маршруты, календарные permissions и новую UI/runtime реализацию.
4. Пройти physical-device QA: clean install/upgrade, Wi-Fi/mobile data без VPN,
   timezone, заявка/отказ/отзыв/restart, все «Мои занятия»,
   Calendar save/cancel/denied, lock-screen reminders/отмена,
   Back/scroll/draft, offline/503/429/retry, privacy/delete,
   Dynamic Type и базовый VoiceOver.
5. Собрать новый уникальный build без Internal Only;
   заполнить Beta Review contact/notes/sign-in/What to Test.
6. Для Store завершить metadata, rights, age rating, Privacy/compliance,
   страны, screenshots и manual release.

## Данные

Заявки (имя/фамилия/Telegram), IDs и hashes хранятся на сервере;
токен — SecureStore. Feedback текст/контакт передаётся в Telegram,
SQLite хранит digest/status, не текст. Выбор, закладки и draft локальны.
Поиск отправляется API; длительное хранение запросов не подтверждено.
Provider logs, сроки и backup удалённых данных требуют отдельной проверки.

Платные групповые онлайн-занятия требуют проверки purchase rules:
companion-модель и бесплатная цена app сами по себе не гарантируют исключение.
Аудит первоначальной подготовки: TypeScript/lint, 42 JS и 34 Python прошли.
Это не QA последующих правок или подтверждение физических устройств.

[External TestFlight](https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers/)
· [App Privacy](https://developer.apple.com/app-store/app-privacy-details/)
· [Account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
· [Review guidelines](https://developer.apple.com/app-store/review/guidelines/).
