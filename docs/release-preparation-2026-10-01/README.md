# Подготовка iOS 13 и Android 3 — 1 октября 2026

Владелец разрешил API/Telegram QA и выпуск обоих билдов после финальных проверок.
API заявок уже включён, обе синтетические QA-заявки прошли одобрение/доступ/отзыв,
Telegram подтвердил доставку (`sent`). Финальные мобильные артефакты пересобраны
после исправления прямой новой заявки при отзыве. iOS 13 загружен Apple Internal Only; назначение группе/Testing ожидает входа
в App Store Connect. APK 3 уже опубликован и проверен полным HTTPS скачиванием.
Разделы первоначальной подготовки ниже сохранены как история; актуальны факты
в разделе «Финальная проверка и пересборка».

## Артефакты

- iOS 1.0.0 (13), `ai.mypraxis.quietpractice`, team `92HWGZCSS4`:
  `data/releases/2026-10-01/daychee-1.0.0-13.xcarchive` и
  `data/releases/2026-10-01/ios-export/Dejchi.ipa`.
- Android 1.0.0 (versionCode 3), ARM64, Android 7+, target SDK 36:
  `data/releases/2026-10-01/daychee-1.0.0-3.apk`.
  Постоянный RSA3072 сертификат совпадает с публичным APK 2:
  `8efac25f5d4282c74d8c3f7a5b146e70527adb7b91d357e1576114139f9c1063`.
- SHA256 артефактов: [artifact-sha256.txt](artifact-sha256.txt).
  IPA: `56233fdff332b2f3879b5a82b150cdb97500b0c029dad61b0a2a45ff1be03980`.
  APK: `ec4f4e7836be25c2d4a5c63e5de0cff0a04be74d0078ef2d7a579670afdd46d9`.

Ключ/пароль Android сохраняются в существующем игнорируемом owner-каталоге и
не входят в артефакты/пакет сервера. Внешняя резервная копия ключа остаётся задачей
владельца; новый ключ не создавался. Локальные прежние debug APK имеют иную подпись.

## Состав

В мобильных файлах: утверждённые заявки с именем/фамилией, необязательным Telegram,
одобрение без кода, совместимость с приглашениями; исправления Back, сохранения
сессии и понятной ошибки сети; серверная обратная связь. Дизайн веб-вики Minimal
остаётся отдельным кандидатом и в мобильное приложение не переносился.

Все рабочие публичные API настроены на Railway. Бинарники не используют QA origin
8879. Статический поиск не нашёл известных Zoom meeting URL, Tailscale, Telegram
токенов, private-key headers и файлов SQLite/keystore. Это проверка известных
признаков, не формальный аудит всех возможных секретов. В Android Hermes есть
`http://localhost:8081` из React Native Devtools, это не configured Daychee API.

Expo prebuild пересоздал ignored native projects с актуальным именем `Dejchi`.
Bundle identifier и отображаемое имя «Дейчи» сохранены. Источник номеров — app.json;
в итоговых APK/архиве/IPA сверены 3/13. CocoaPods установлены; зависимости не обновлялись.

## Фактические проверки

- 40 Python и 42 JS tests passed; TypeScript, Expo lint, node check admin.js,
  git diff --check. Логи: [Python](python-tests.txt), [JS](js-tests.txt).
- Android Gradle assembleRelease успешен. apksigner v2/v3 verify успешен;
  сертификат совпал с APK 2. aapt подтвердил package/version/SDK/ARM64.
- На одноразовом read-only Pixel9/API36: установлен публичный APK 2 → создан
  синтетический feedback-черновик `ReleaseQA3` → install -r APK 3 → тот же черновик
  сохранился. Android Back вернул в расписание. На APK 3 закрытая вики, форма,
  пустая отправка с inline validation и Back проверены. Валидных заявок в
  production не отправляли. [Обновление](android-update-draft.png),
  [валидация](android-request-validation.png).
- iOS Simulator Release собран с production URL. «Мои занятия»: пустое состояние,
  серия Тайцзицигун с ближайшей датой 2 октября, пропуск → ближайшая 9 октября,
  восстановление → снова 2 октября, разовая дата 1 октября — проверены нативно.
  Кадры: `ios-mine-empty.jpg`, `ios-mine-regular.jpg`, `ios-mine-skipped.jpg`,
  `ios-mine-restored.jpg`, `ios-mine-one-off.jpg`.
- CLI archive остановился на Keychain `errSecInternalComponent`. Xcode GUI создал
  подписанный iOS App Archive 1.0.0 (13); codesign deep/strict успешен.
  Локальный exportArchive успешен: app-store-connect, destination export,
  testFlightInternalTestingOnly=true. main.jsbundle архив/IPA идентичен:
  `159fe8a83633765d1850bfc948e3f8f9eb70c8c24a8bb5847a585c27335e7494`.
  [Organizer](xcode-archive-13.png). Apple validation/upload ещё не выполнялись.
- Подготовленный server stage: изолированный HTTP E2E заявка → admin approve →
  claim → session; прежняя сессия сохранилась. Закрытые API без входа 401;
  скачивание полного APK совпадает по hash, Range 206, имя `daychee-1.0.0-3.apk`.
  Реальная SQLite backup прошла integrity_check, обе сессии сохранены, режим 0600.
  [Результат](stage-qa.txt).
- Chrome desktop и mobile 390: инструкции сайта отражают утверждённые заявки,
  горизонтального overflow нет (390/390). Кнопка скачала новый APK в Downloads;
  SHA256 совпадает с подписанным файлом. [Доступ](site-access-mobile.png),
  [установка](site-install-mobile.png), [desktop](site-install-desktop.png).

## Дизайн и пределы приёмки

Источники: архив 24 сентября в DESIGN.md, неизменный
`qa-design-repair/01-reference-mine.png`; сохранённая итерация расписания build 5;
заявки — утверждённый `design/approved/access-requests-2026-09-30.html`.
Парные кадры заявок и результаты предыдущего E2E:
[QA 30 сентября](../qa-access-requests-2026-09-30/README.md).
Новые кадры My Classes просмотрены относительно исходной композиции регулярной
карточки; реальные названия/даты/число серий, SF Symbols и safe areas отличаются
от демонстрационного телефона. Новых визуальных решений не введено.

Не засчитаны как пройденные: отдельная серия отсутствует в загруженном окне,
все loading/ошибки сервера/отзыв с парными кадрами, точная позиция scroll для всех
entry points, Dynamic Type/VoiceOver/TalkBack, физические телефоны. Полную
визуальную приёмку по нескольким успешным сценариям не объявлять. До выпуска
закончить обязательные состояния и устранить выявленные расхождения.

## Пакет сервера и порядок публикации

`data/releases/2026-10-01/server-stage`, 44 allowlisted файла.
[deploy-manifest.json](deploy-manifest.json). База — опубликованный поиск вики
`0c05adfa-9f33-4f01-9698-a64900e36101`, все 40 файлов исходного stage проверены по
его manifest. Сохраняются конспекты/вики/поиск из этой версии. Включены только
заявки/API/admin, новый APK, текстовые инструкции сайта и их упаковка/backup.
Docker COPY и dockerignore дополнены тремя request-модулями. Docker daemon
здесь отсутствует, контейнерная сборка ещё не проверена Railway.

На момент проверки production `/health` 200, `/api/access/request` 404.
Новым мобильным версиям требуется включение `DAYCHEE_ACCESS_REQUESTS_ENABLED=1`.
Перед первым запуском launcher делает volume-local копию существующей базы
доступа с integrity_check; это не внешняя disaster-recovery backup.

Для первой проверки подготовлен отдельный `data/releases/2026-10-01/api-stage`
([api-deploy-manifest.json](api-deploy-manifest.json)): тот же backend, но прежние
публичные APK 2 и инструкции сайта. Новый APK не появится до завершения QA.
Полный `server-stage` предназначен для итогового выпуска.

После разрешения обновить существующий сервис (без новой инфраструктуры),
сохранив env/volume и существующие bot token/chat ID. Проверить request API,
старые сессии, одну помеченную QA-заявку и реальную доставку нейтрального уведомления
существующим ботом. Реальная доставка в этой подготовке не проверена. После QA
отозвать только созданный QA-доступ. При неудаче не распространять новые бинарники;
отключить флаг/вернуть прежний stage, сохранив базу и резервную копию.

Когда обязательная QA завершена и выпуск разрешён: загрузить IPA Internal Only,
дождаться Apple processing, назначить «Личное тестирование»
`ed8a05aa-a6db-41e9-93e6-299c8f36c7c2` всем её участникам и проверить Testing.
APK должен заменяться вместе с поддержкой заявок; после публикации повторно
скачать полный HTTPS файл и проверить hash, MIME, attachment, кнопку и Range.

После QA остановлены локальный preview API и read-only Android-эмулятор;
Chrome viewport сброшен. Созданные для iOS QA серия и разовая дата удалены через UI.

## Происхождение

HEAD `e505400ac14e518591a667aa29deb1a9746957d0` + незакоммиченные исходники нескольких
параллельных задач. Отдельного release commit/tag ещё нет. Точный мобильный состав:
[mobile-source-manifest.json](mobile-source-manifest.json); игнорируемая копия
`data/releases/2026-10-01/mobile-source.tar.gz` содержит только перечисленные файлы,
без .env, ключей, generated private corpus и node_modules. Не коммитить весь грязный
worktree перед выпуском. Итоговый release commit/tag должен фиксировать именно
проверенный набор, а не включать посторонние исследовательские задачи.

## Финальная проверка и пересборка — 1 октября 2026

Исправлен обнаруженный при парной сверке переход: после отзыва доступа кнопка
«Подать заявку» сразу открывает новую форму, сохраняя имя/фамилию, как в референсе.
До исправления был лишний экран «Подробнее». Финальные archive/IPA созданы в Xcode
в 11:54 по часовому поясу машины (08:54 UTC); старый архив 10:14 не распространять.

Финальные артефакты:
- `data/releases/2026-10-01/daychee-1.0.0-13-final.xcarchive`
- `data/releases/2026-10-01/ios-export-final/Dejchi.ipa`, SHA256
  `72f4fdfdb8c7704ee3c9e82db26978795692ec095db55b53792d213d5848720b`.
- `data/releases/2026-10-01/daychee-1.0.0-3.apk`, SHA256
  `5b12ff8991f20767c32124f84b246c6b68755e7574bcf3ce8f52d211b7909844`.
- Final iOS main.jsbundle archive/IPA идентичен: 
  `a9601d078fd8f14013ed345aab71cfc5108a286bec04911af7ca4d6354a1714d`.

Подписи проверены: codesign deep/strict с системным trust store; APK v2/v3,
прежний release сертификат. Production URL присутствует, QA localhost:8879
отсутствует в обоих финальных бинарниках. После исправления TypeScript/lint,
11 request/session JS tests, 11 Python requests/API/notifications tests прошли;
дополнительно проверено, что notification_status доступен только owner admin.
Staged E2E и реальная SQLite backup проверены повторно на финальном stage.

Дополнительная нативная QA:
- «Мои занятия»: временная отсутствующая серия в данных симулятора сохранилась
  с пояснением; референс исходного My Classes из DESIGN.md. Исходные preferences
  сохранены/восстановлены; shipped код/данные расписания для fixture не менялись.
- Загрузка проверки/отправки, 503 при проверке/отправке, 429, восстановление
  отправки с теми же credentials — iOS + изолированный synthetic API. Парные
  `reference-check-loading` / `ios-request-check-loading`,
  `reference-check-server-error` / `ios-request-check-server-error`,
  `reference-submit-loading` / `ios-request-submit-loading`,
  `reference-submit-server-error` / `ios-request-submit-server-error`,
  `reference-submit-limit` / `ios-request-submit-limit`.
- Отзыв: `reference-revoked-wiki.png` / `ios-request-revoked-fixed.jpg`;
  нажатие сразу открывает форму `ios-request-revoked-new-form.jpg`. Проверено
  после rebuild, profile QA Applicant сохранён.
- Фильтр «Онлайн», scrolled список 5–7 октября → занятие 6 октября → заявка Zoom
  → верхний Back → то же занятие → верхний Back → та же позиция списка.
  `ios-scroll-before.jpg` / `ios-scroll-after.jpg`: одинаковая композиция и позиции.
  Настройки → Доступ → Back → Настройки → Back и переключение Wiki/Schedule
  также сохранили scrolled список/фильтр. Ранее проверенные прямой gate invitation,
  вложенный invitation, черновик, табы и Zoom описаны в QA 30 сентября.
- Финальный signed APK установлен в отдельном read-only API36 эмуляторе.
  Вложенный invitation → Android Back сохраняет ReleaseQA3; прямой invitation
  → Back возвращает в gate. Production заявка ReleaseQA3 AndroidQA → owner approve
  → автоматический «Доступ открыт» → wiki → отзыв собственного QA grant →
  restart → gate → «Подать заявку» → новая форма → Android Back.
  Screenshot открытого private catalog остаётся только в ignored release data.

Сверка: сохранён утверждённый HTML SHA256 из DESIGN.md, к нему локально подключены
исходные support.js/organic assets без изменения HTML. Форма/status/error layouts,
иконки, поля и safe areas сверены. Различия: реальные часы/имена, нативные символы,
три существующие вкладки; тексты backend ошибок конкретнее демонстрационного
макета. После неизвестного результата отправки поля блокируются, кнопка «Отправить
ещё раз» использует прежнюю заявку — это ранее зафиксированное предотвращение
дубликатов. Найденное лишнее действие после отзыва исправлено и перепроверено.

Production API deployment: `572ef6df-7ea2-4c62-ac0a-97d230917564`, SUCCESS.
Owner-only delivery status добавлен следующим API stage
`8d57ead6-41a6-4f1a-a02e-1cadb7d6b252`; через защищённый API обе собственные
QA строки получили notification_status=sent. Это подтверждение успешного
sendMessage от Telegram, не доказательство прочтения сообщения на телефоне.
Обе QA-сессии отозваны; аудит сохранён. Старые приглашения/сессии не изменялись.
Без входа request/admin/wiki защищены 401. Volume, env и private corpus сохранены.

Backup hook проверен локально; успешный startup production прошёл после него.
Прямая read-only SSH проверка production backup не удалась: ключ требует привязки
к Railway account; новый SSH доступ не создавался. Это не внешняя backup.
Физические iPhone/Android, Dynamic Type, VoiceOver/TalkBack остаются непроверенными.
Пиксельная проверка всех возможных длин имен/языков не выполнялась.

## Публикация — фактическое состояние

- Android 3 опубликован на deployment `cee85c18-f212-4d23-b77c-c60d09594598`,
  SUCCESS. HTTPS GET скачал 45 104 905 байт, SHA256 совпал с финальным APK.
  MIME `application/vnd.android.package-archive`, attachment `daychee-1.0.0-3.apk`,
  Range 206. Инструкции заявок и href кнопки проверены в Chrome production.
- iOS 13 загружен через Xcode **TestFlight Internal Only**, Organizer показывает
  Uploaded to Apple в 09:10 UTC. Это не подтверждение Testing/доставки на iPhone.
  Apple выдал только Upload Symbols Failed для prebuilt ExpoImage, React,
  ReactNativeDependencies, SDWebImage и трёх image coders, hermesvm: native crashes
  внутри этих библиотек могут остаться без символов. App upload успешно завершён.
- App Store Connect требует повторного входа. Группа «Личное тестирование»
  `ed8a05aa-a6db-41e9-93e6-299c8f36c7c2`, все её участники, What to Test и статус
  Testing пока не проверены для 13. Выпуск iOS не считать завершённым до этого.
- Source snapshot будет сохранён независимо от общего рабочего HEAD на
  `codex/release-ios13-android3`; source tags `testflight/ios-1.0.0-13` и
  `android/1.0.0-3`. Общий worktree/ветка не переключаются, чужие изменения
  не добавляются в index основной ветки.
- QA servers/Android emulator остановлены; .env.local и установленный iOS
  Simulator app восстановлены на production URL.
