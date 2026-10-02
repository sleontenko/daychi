# Контент: QA · 2026-09-30

Импортированы 39 конспектов-черновиков и 117 цитат из существующих TXT/SRT.
Проверены hashes, YouTube ID/названия, исходные сегменты и таймкоды.
Все 39 локальных annotation payload совпали с пакетом.
Первый/повторный production импорт подтверждены; исходный каталог неизменен.

27 Python + 1 тест rolling captions, 1 Node; frontend build и 3 stage content tests.
Публичные оболочки/health — 200; закрытые API — 401/no-store.
Локальный UI: чтение, сосед без аннотации, Back/query, viewport 390 без переполнения.

Статус `source_checked_draft` не подтверждает ASR-точность или одобрение.
Production participant UI, физические устройства, accessibility и полная
парная визуальная проверка не выполнены. Независимый backup content DB
на эту дату не настроен. [Процесс](../wiki-production-pipeline.md).
