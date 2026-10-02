# Поиск: курсор сохраняется, 30 сентября 2026

Причина: `input` через 220 мс вызывал router/renderCatalog, заменял всю разметку,
а затем focus() нового input. Курсор/выделение и IME терялись, повторный фокус
мог также перехватить ввод у другого элемента.

Исправление: поле поиска остаётся тем же DOM-элементом; debounce обновляет только
`catalog-content` и параметры адреса через replaceState. Нет принудительного
focus(). Учтены compositionstart/end, отмена pending поиска при переходе,
фильтр раздела читает актуальный запрос. Оформление и навигация не менялись.

Проверено в Chrome через CUA на локальном backend с настоящим каталогом:
«веер» → Home, Right×2, вставка X → «веXер», selection=3; после debounce
selection=3 и фокус сохранены; Backspace → «веер», selection=2. На 390×844
«веер для новичков», selection 15–16, после debounce тот же диапазон; Backspace
удаляет выбранный символ, не первый. Изменение результатов/пустое состояние
срабатывают. Реальные iPhone/Android и настоящая IME-клавиатура не проверялись.

Build успешен, 27 Python tests passed (content/wiki/graph/access/admin),
1 Node test passed (экранирование конспекта и таймкод). diff --check чистый.

База публикации: enriched production `ee3ea542-c861-4c41-8b73-63b98ae95985`,
все 40 файлов проверены по `qa-wiki-enrichment-2026-09-30/deploy-manifest-2.json`.
Stage `/tmp/daychee-wiki-search-20260930` меняет только graph.js; конспекты,
базы, backend, админка и граф не откатываются. Манифест: deploy-manifest.json.
Railway выдал deployment `0c05adfa-9f33-4f01-9698-a64900e36101`.
Новая визуальная концепция находится в отдельном кандидате Claude Design.

Production: Railway SUCCESS; опубликованный JS совпал с локальным по SHA-256;
`/health` и `/wiki` — 200, закрытые graph/materials API — 401 без входа.
Production-сессия участника не создавалась и не использовалась; проверка курсора
выполнена локально на том же опубликованном файле.
