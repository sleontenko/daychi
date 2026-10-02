# iOS 13 / Android 3: QA · 2026-10-01

iOS 1.0.0 (13): Internal Only, Testing, внутренняя группа; What to Test сохранено.
Android 1.0.0 (3): ARM64, Android 7+, target SDK 36; подписанный APK опубликован.
Source tags: `testflight/ios-1.0.0-13`, `android/1.0.0-3`.
[Исходники](mobile-source-manifest.json) · [Hashes артефактов](artifact-sha256.txt).

Включены заявки/одобрение, приглашения, серверная обратная связь,
исправления Back/сессии и прямой переход к новой заявке после отзыва.
API использует HTTPS; закрытый каталог и Zoom-реквизиты не встроены.

## Проверено

- Первоначально 40 Python + 42 JS, TypeScript/lint; после правок
  11 JS request/session и Python requests/API/notification tests.
- Signed iOS archive/IPA: версия, build, ID, подпись и API-конфигурация.
- Signed APK: v2/v3, прежний сертификат, package/version/SDK/ABI.
- Android update APK 2 → 3 сохраняет feedback draft; валидация и Back.
- iOS Simulator: «Мои занятия» empty/series/next/skip/restore/one-off,
  серия вне окна; вложенные/прямые возвраты и сохранение прокрутки.
- Production HTTP и signed Android E2E:
  заявка, одобрение, сессия, restart, отзыв; две Telegram-доставки.
- Дополнительные парные loading/server/limit/revoked состояния.
- Полная HTTPS загрузка APK, hash/MIME/attachment/Range.

Android release подпись отличается от исторической debug-подписи.
Резервная копия release-ключа остаётся задачей.
Физические устройства, доставка напоминаний, accessibility и полный набор
Calendar permission сценариев не проверены. dSYM восьми frameworks отсутствуют.
Скриншоты этого каталога фиксируют проверенные состояния, а не QA текущего main.
