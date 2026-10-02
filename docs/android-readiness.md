# Android — подготовка и фактическая проверка

24 сентября 2026. Работа по поручению владельца параллельно iPhone. Ничего не
загружено в Google Play и не распространено тестировщикам.

## Подготовлено

- Expo 57 Android native project сгенерирован из `app.json`; `android/` остаётся
  ignored. Application ID `ai.mypraxis.quietpractice`, имя «Дейчи», version 1.0.0,
  Android versionCode пока 1, target/compile SDK 36, minSdk 24.
- Шаблонный синий Expo adaptive icon заменён существующей согласованной иконкой
  приложения; шаблонные background/monochrome assets больше не подключаются.
- Ошибка проверки напоминаний говорит «Телефон», вместо «iPhone».
- Владелец отдельно разрешил принять Android SDK License Agreement и установить
  SDK. Java Temurin 17.0.20.1+1, Gradle 9.3.1, SDK 36, Build Tools 36.0.0,
  NDK 27.1.12297006, CMake 3.30.5 установлены в ignored `data/android-toolchain/`.
  Gradle дополнительно установил Build Tools 35.0.0 по зависимостям.
- Android Emulator 37.1.11 для Apple Silicon и Google APIs Android 36 ARM64
  (revision 7), AVD `Daychee_API36` / Pixel 9. Данные AVD в `data/android-toolchain/avd/`.
  Android CLI также создаёт служебные файлы в `~/.android/`; это не секреты
  приложения. При последующих командах CLI используется `--no-metrics`.

## Проверки

- `expo prebuild --platform android --no-install`: успешно.
- `expo export --platform android`: успешно, 1379 модулей, Hermes bundle.
- TypeScript: успешно. Lint: успешно. 23 schedule JS tests: успешно.
- `git diff --check`: успешно.
- `:app:assembleRelease -PreactNativeArchitectures=arm64-v8a`: **BUILD SUCCESSFUL**,
  4m11s, 532 tasks. APK установлен в Pixel9 / Android36 ARM64 и запущен.
- Production расписание загрузилось, правильные название/навигация/Israel time.
  Публичный снимок: `data/android-qa/start.png`. Визуально сохранены принятые
  композиция расписания, цвета и типографика; Android использует свои системные
  status/navigation bars и Material Symbols. Полной screen-by-screen QA нет.
- Отдельное временное QA-приглашение успешно открылось в работающем приложении;
  «Получить доступ» вернул «Доступ открыт» через production HTTPS API. TLS-ошибка
  iPhone здесь не воспроизвелась. Пользовательское приглашение не использовалось.
- QA-приглашение отозвано после проверки; экран вики показывает gate
  «Проверить доступ». Полная вики/content QA не выполнялась. Эмулятор остановлен
  после smoke-теста, данные AVD сохранены.
- Поздние локальные правки access-screen/session (пояснение пустого входа и
  network error) сделаны после bundling и в этом APK отсутствуют.

## Ограничения перед распространением

- Сгенерированный Gradle release использует debug signing key. Такой локальный
  APK подходит для эмулятора, но не является подписанным store release. Перед
  Google Play нужны отдельный upload key, резервное хранение ключа, AAB,
  выбранный versionCode и финальная проверка состава AAB.
- Лишние Android permissions удалены и проверены в merged Release manifest;
  подробности повторной QA ниже.
- Первый native smoke дополнен проверками ниже. Физический Android, поведение
  OEM-энергосбережения и сохранение события в реальный календарный аккаунт
  остаются непроверенными. iPhone не доказывает их корректность на Android.
- Пользователь сообщает TLS-ошибку доступа на физическом iPhone. Успешная
  компиляция Android не доказывает доступность production API из внешних сетей.
- Аккаунт Google Play и его оставшаяся верификация описаны отдельно в
  [google-play-preparation.md](google-play-preparation.md); этот отчёт их не меняет.

## Источники

Перед работой прочитана [документация Expo SDK57](https://docs.expo.dev/versions/v57.0.0/),
[локальная сборка Expo](https://docs.expo.dev/guides/local-app-development/),
[официальная загрузка Android SDK и условия](https://developer.android.com/studio).

## Локальный артефакт и повторный запуск

Первый smoke APK имел SHA-256
`1dd7cea45fd81ae695bc707f5d3494f651309b03016ba7847c35c706b4b4c4e9`.
Он был заменён следующими локальными сборками; актуальный QA-артефакт ниже.
`apksigner verify` проходит; сертификат CN=Android Debug, не production upload key.
Это локальный QA-артефакт, не распространять как store-ready сборку.

Из корня репозитория:

```sh
export JAVA_HOME="$PWD/data/android-toolchain/jdk-17.0.20.1+1/Contents/Home"
export ANDROID_HOME="$PWD/data/android-toolchain/sdk"
export ANDROID_AVD_HOME="$PWD/data/android-toolchain/avd"
export GRADLE_USER_HOME="$PWD/data/android-toolchain/gradle-home"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
cd apps/practice-app/android
./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a --console=plain
```

Для store AAB нельзя использовать текущую debug подпись. До внешнего тестирования
нужны решение по upload key, аудит разрешений и нативные сценарии уведомлений,
календаря, холодного входа, восстановления/отзыва сессии и отсутствия сети.

## Вторая итерация: permissions и настоящие Android напоминания

Всё проверено на Pixel 9 / Android 36 ARM64 Emulator. Это не доказательство
доставки на физический телефон и не новый выпуск.

### Изменения

- `android.blockedPermissions` исключает READ_CALENDAR, WRITE_CALENDAR,
  READ_EXTERNAL_STORAGE, WRITE_EXTERNAL_STORAGE, SYSTEM_ALERT_WINDOW,
  USE_BIOMETRIC, USE_FINGERPRINT. В итоговом merged Release manifest все семь
  отсутствуют. Приложение запускает календарную форму через ACTION_INSERT,
  не читает календари, не использует shared storage/overlays/biometric auth.
  POST_NOTIFICATIONS, SCHEDULE_EXACT_ALARM и нужные библиотечные разрешения
  уведомлений сохранены. iOS permissions не менялись.
- Реальный дефект: без Android special access библиотека планировала занятия
  с `window=+1h` вместо точного времени. Короткий десятисекундный тест сам по себе
  этот дефект не выявляет.
- Добавлен небольшой локальный Android-only Expo module: проверка exact-alarm
  доступа и переход на системный экран «Alarms & reminders». В настройках
  напоминаний при отсутствии разрешения есть одно действие и предупреждение
  о задержке. Приложение не выдаёт разрешение автоматически.
- Grant/revoke отражается на возврате и при запуске. Старые pending reminders
  пересоздаются с новой точностью; метаданные точности предотвращают дубли.
  При отсутствии разрешения тест не обещает доставку через 10 секунд.

### Фактические результаты

1. POST_NOTIFICATIONS: системный запрос → отказ → интерфейс остаётся выключенным;
   повторный запрос → разрешение → управление доступно.
2. Реальное тестовое уведомление доставлено в фоне: NotificationRecord с
   `tag=quiet-test`, channel `practice-reminders`, title «Дейчи». Видно в шторке.
3. Недельный выбор сохранился после обновления APK. Созданы два Android alarms:
   25 сентября и 2 октября, 08:30 Asia/Jerusalem, за 30 минут до занятия.
4. Возврат из exact settings без grant: предупреждение остаётся, pending alarms
   не теряются, inexact fallback не выдается за точный.
5. Grant: оба существующих alarms заменены на `window=0`,
   `exactAllowReason=permission`; в UI по-прежнему два напоминания, предупреждение
   исчезло. Повторный reconcile не создаёт дубликаты.
6. Отмена всей подписки с подтверждением: число class alarms 2 → 0.
7. Повторный weekly выбор → revoke exact permission в Android Settings → запуск:
   оба alarms восстановлены как inexact, предупреждение снова видно.
8. Выключение напоминаний удаляет оба class alarms. Отдельный запущенный
   тест `quiet-test` не считается напоминанием занятия.
9. Native Calendar ACTION_INSERT запускает Google Calendar без READ/WRITE_CALENDAR
   permissions, без SecurityException. Чистый AVD требует вход в Google, поэтому
   реальное сохранение и native form dates/repetition не проверены. Вход не
   выполнялся. После отмены приложение корректно предлагает проверить сохранение,
   не утверждает, что событие создано.

TypeScript, lint, 24 schedule JS tests (включая регрессию перепланирования при
смене precision), Android Release native build — прошли. Модуль autolinked,
последняя сборка 16s / 569 tasks. Android-only UI проверен по снимкам;
базовые цвета/типографика/отступы сохранены, native permission screen системный.

Актуальный локальный APK: `data/android-qa/daychee-exact-alarms.apk`.
SHA-256: `6ee7a9e0f72759c58a7bbf73d6073063570c4a19ba5e3d2666666b6c6fc509b2`.
Это Release runtime с Android Debug certificate, не store AAB. Разработка нового
code/HTTPS доступа и нового хостинга идёт отдельно: этот APK не является его итоговой QA.

Доказательства в ignored `data/android-qa/`: `notification-delivered.png`,
`notification-test.txt`, `weekly-alarms.txt`, `exact-granted-alarms.txt`,
`exact-revoked-alarms.txt`, `weekly-cancelled-alarms.txt`,
`exact-granted.png`, `exact-revoked.png`. Приватного каталога в снимках нет.

Ссылки: [Expo permissions](https://docs.expo.dev/guides/permissions/),
[Android exact alarms](https://developer.android.com/develop/background-work/services/alarms),
[локальные Expo modules](https://docs.expo.dev/modules/get-started/).

Дополнительно iOS Metro export прошёл после добавления Android-only модуля;
это проверка совместимости JS bundling, не новый native iOS запуск.

## Дополнительный bounded тест нового поля доступа

В уже собранном `daychee-exact-alarms.apk` присутствовала новая форма кода.
Пустая строка и `ABC` дают локальную ошибку «Проверьте код ... 12 букв и цифр»;
валидные коды в старый production API не отправлялись. Ввод и показ клавиатуры
на Android подтверждены. Снимки: `data/android-qa/access-empty-code.png`,
`access-code-keyboard.png`, `access-error-scroll-keyboard.png`.

После ошибки и повторного фокуса поля кнопка «Войти» оказывается ниже верхней
границы клавиатуры. Надёжная прокрутка в этом состоянии не подтверждена: один
жест начался внутри TextInput и мог быть обработан как выделение текста.
Обязательно повторить keyboard/scroll QA следующей итоговой сборки; это не
подтверждение отсутствия UX-дефекта. Полная новая авторизация и новый HTTPS
endpoint здесь не проверялись. Эмулятор остановлен после проверки.

## Следующий APK — 28 сентября 2026

Собран локальный arm64 Release runtime с новым UX доступа:
`data/android-qa/daychee-access-2026-09-28.apk`.
SHA-256 `c618390de4dc46df8f493d6aa7c6cfb395eeec184c8628abb38df5089d42f549`.
Подписан debug certificate; для внешнего распространения ещё не готов.
Новая нативная QA и публичный API остаются открытыми, см.
[отчёт доступа](access-implementation-2026-09-28.md).

План распространения: сначала закончить QA и настроить постоянный release/upload
ключ с безопасной резервной копией, затем закрытое тестирование через Google Play
после завершения проверки аккаунта. Альтернатива для одного Android-тестировщика —
подписанный APK по приватной ссылке с ручной установкой/обновлением. Публичного
релиза сейчас нет; владелец в первую очередь проверяет TestFlight. Наличие
собранного APK не заменяет тест на физическом Android.

### Пересборка 28 сентября, 01:11

Тот же локальный путь `data/android-qa/daychee-access-2026-09-28.apk` обновлён:
Railway endpoint, Expo Clipboard, исправление возврата при ошибке приглашения
и восстановление прокрутки вики. Gradle: BUILD SUCCESSFUL, 21s, 569 tasks.
SHA-256 `1b6b0353345cc706faf971ae7a05f9caaad9d6d1ea971ab10f082cf1ba41ba37`.
Это по-прежнему локальный Release runtime с debug certificate. Нативная QA
этой конкретной копии и проверка на физическом Android не выполнены.

### Итоговая копия 28 сентября, 14:14

После визуальной правки выбора занятия: BUILD SUCCESSFUL, 31s / 569 tasks.
Тот же APK обновлён, SHA-256
`16e043813cfccc245de00b7c6e04b077f8a47c7658aeca5dbd45772675716e73`.
Установка последней копии и Android Back не проверены; внешнее распространение
не начато, debug certificate сохраняется.

## APK для сайта — 28 сентября 2026

По запросу владельца подготовлена свежая arm64-v8a APK 1.0.0 (versionCode 2), Android 7+ (minSdk 24), targetSdk 36. Содержит серверную обратную связь; iOS/TestFlight build 12 этой операцией не меняется.

Артефакт: `data/android-qa/daychee-1.0.0-2.apk`, 45 047 561 байт (~43 MiB). SHA-256: `0596cc28071d43978fdc2575e38e2e797283481fff2733322fcc6b7a119eba94`. Подпись v2/v3 проверена, постоянный локальный RSA3072 ключ Daychee (сертификат SHA-256 `8efac25f5d4282c74d8c3f7a5b146e70527adb7b91d357e1576114139f9c1063`). Это уже не прежняя Android Debug подпись. Старые локальные debug APK не обновляются поверх новой подписи; текущая публичная линия должна сохранять этот ключ. Ключ/пароль лежат только в игнорируемом owner-каталоге с правами 0600; резервная копия ключа вне Mac ещё не создана.

Проверено: Gradle assembleRelease успешен; aapt версия/ABI/разрешения; apksigner verify; нет sqlite/db/ключей/каталога среди файлов APK, в JS bundle отсутствуют имя Dev-бота и адреса .ts.net, присутствуют публичный Railway и /api/feedback. API вики использует серверную авторизацию.

Pixel 9 Android 36 ARM64 Emulator запущен с `-read-only -no-snapshot-save`: смена тестовой подписи не меняет сохранённый AVD. Чистая установка новой APK успешна; расписание загружено; форма обратной связи открыта; пустая отправка отклонена; черновик переживает Android Back и повторное открытие; одно явно помеченное QA-сообщение отправлено через Railway, показано подтверждение и очищен текст. AndroidRuntime/ReactNativeJS ошибок при запуске не показали. Снимки — `qa-android-apk2-2026-09-28/`. UI-окно эмулятора недоступно cua, использованы штатные Android debugging tools.

Это тестовая прямая загрузка, не Google Play. Физический Android, установка через Chrome на устройстве и доставка напоминаний на физических устройствах не проверены. Предыдущие результаты уведомлений/календаря выше относятся к старым сборкам и не заменяют проверку нового APK. Полная приёмка всех мобильных экранов/состояний относительно дизайна ещё не завершена.

Публичное скачивание включено на Railway deployment `7d82b3e2-8e5f-4e0c-872c-8d092093fe96`: https://daychee-api-production.up.railway.app/downloads/daychee-android.apk . Полный файл после публикации проверен по SHA-256. На чистой установке вкладка Вики показывает закрытый доступ без каталога. Дополнительный статический поиск по JS bundle не нашёл шаблонов Telegram-токена, private-key header, Zoom meeting URL и старого имени bundled archive. Это проверка известных признаков, не формальный аудит всех возможных секретов.

## Подготовка APK 3 — 1 октября 2026

Подписан локальный `data/releases/2026-10-01/daychee-1.0.0-3.apk` постоянным
сертификатом публичной версии 2. Обновление 2 → 3 с сохранением feedback-черновика,
форма заявок/валидация/Android Back проверены на read-only Pixel9 API36.
SHA256 `ec4f4e7836be25c2d4a5c63e5de0cff0a04be74d0078ef2d7a579670afdd46d9`.
Сайт локально скачал точный файл; в production версия 2 сохраняется.
До публикации: рабочий API заявок и реальная доставка Telegram, оставшаяся
дизайн/навигационная приёмка. [Полный отчёт](release-preparation-2026-10-01/README.md).

## APK 3 опубликован — 1 октября 2026

Финальный файл пересобран после исправления прямой заявки при отзыве доступа.
SHA256 `5b12ff8991f20767c32124f84b246c6b68755e7574bcf3ce8f52d211b7909844`,
45 104 905 байт, versionCode 3, Android 7+, ARM64, прежний RSA3072 release ключ.
Предварительный APK с hash ec4f… выше заменён финальным перед публикацией.

Публичная ссылка: https://daychee-api-production.up.railway.app/downloads/daychee-android.apk
Сайт и файл опубликованы на Railway `cee85c18-f212-4d23-b77c-c60d09594598`;
полное HTTPS скачивание/подпись/hash/attachment/Range проверены. Финальный signed
APK на read-only эмуляторе прошёл production заявку → одобрение без кода → wiki →
отзыв QA grant → новую форму, Android Back и сохранение черновика. Реального
Android устройства нет. Новый API содержит заявки и совместим с прежними сессиями.

Первому тестеру можно передать эту ссылку или скачанный APK. Обновление APK2→3
сохраняет данные при установке поверх приложения; удаление приложения очистит
локальные данные и потребует нового одобрения. Установка/обновления пока ручные,
через браузер, не Google Play. Для Play далее: аккаунт владельца, проверка текущих
требований в Console, AAB/Play App Signing, privacy/Data Safety и внутренний трек
тестирования; отдельный Play выпуск в этой задаче не выполнялся. Хранить внешнюю
резервную копию существующего release key; не менять подпись между обновлениями.
Source tag `android/1.0.0-3`.
