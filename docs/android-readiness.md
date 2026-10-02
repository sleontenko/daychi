# Android

Expo SDK 57, package `ai.mypraxis.quietpractice`.
APK: ARM64, Android 7+, target SDK 36. Generated `android/` остаётся вне Git.

## Native особенности

Android-only модуль `daychee-exact-alarms` проверяет special access
для exact alarms и перепланирует напоминания после grant/revoke.
Без разрешения не показывается фиктивное подтверждение расписанных уведомлений.
Лишние permissions исключаются через `android.blockedPermissions`.

Локальные debug APK имеют другую подпись, чем публичная release-линия.
Обновления требуют прежнего release-ключа; ключ и пароль не входят в Git.
Внешняя резервная копия ключа остаётся задачей.

## Подтверждённая версия · 2026-10-01

APK 1.0.0 (3), source tag `android/1.0.0-3`.
SHA-256 `5b12ff8991f20767c32124f84b246c6b68755e7574bcf3ce8f52d211b7909844`,
45 104 905 байт. Это финальная пересборка, заменившая подготовительный APK.

Проверены подпись v2/v3 и соответствие APK 2, полная HTTPS загрузка,
hash/attachment/Range. На API36 эмуляторе: update 2 → 3 с сохранением
feedback draft, production заявка → одобрение → вики → отзыв → новая форма,
валидация и Android Back.

Ранние эмуляторные проверки exact alarms и календаря относятся к прежним
сборкам, а не доказывают доставку в APK 3.
Физическое устройство, браузерная установка на телефоне, напоминания,
accessibility и полная UI QA не подтверждены.

Прямая загрузка не является Google Play выпуском.
[Mobile QA](release-preparation-2026-10-01/README.md)
· [Подготовка Play](google-play-preparation.md).
