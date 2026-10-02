# Заявки: QA · 2026-09-30

Локальная проверка до включения production и выпуска.
Референс: `design/approved/access-requests-2026-09-30.html`.

40 Python, 42 JS, TypeScript/lint; Release iOS 27 Simulator и Android API36 QA APK.
Проверены: заявка → одобрение → доступ → restart, отказ/повторная заявка,
выход/отзыв, сохранение черновика, network retry без дубля,
вложенный/прямой Back и возврат к занятию. Android проверял валидацию и Back;
валидные production-заявки не отправлялись.

Парные кадры в этом каталоге: form, pending, approved, rejected, network-error,
validation, invitation и admin-pending. Исправлены размеры/отступы и вложенный Back.
Нативные отличия: symbols, safe areas, реальные даты; QA-имена синтетические.
Файлы `*-before-final-style` — промежуточные состояния.

Не проверены все loading/server/revoked состояния, длинные списки,
Dynamic Type, VoiceOver/TalkBack и физические устройства.
Локальный browser adapter не подтверждает production Secure cookie/TLS.
Исходники: `e505400` + локальные изменения, hashes в `source-sha256.txt`;
отдельного release tag нет. Последующие результаты — в [changelog](../TESTFLIGHT_CHANGELOG.md).
