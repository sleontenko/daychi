# Веб-вики и граф

Клиент: `apps/wiki-graph/src/library.js`, `graph.js`.
Сервер: `practice_api/wiki_graph.py`, `public_wiki.py`.
Сборка: `npm ci && npm run build` в `apps/wiki-graph/`;
bundle сохраняется в `practice_api/wiki_graph_web/`.

`/wiki` — каталог/читатель, `/wiki/graph` — граф.
HTML-оболочки не содержат закрытых данных; API требует сессию.
Общий/локальный граф построен на Sigma/d3: физика, drag,
подсветка соседей, zoom, фильтры и поиск.

Связи детерминированы структурой каталога и сериями;
это не редакционно подтверждённые смысловые связи.
Browser Back сохраняет выбранный узел/режим, читатель — query/scroll.
На touch drag узлов ограничен, чтобы не перехватывать прокрутку страницы.

[Reader QA](qa-wiki-reader-2026-09-30/README.md)
· [Поиск](qa-wiki-search-2026-09-30/README.md)
· [Актуальное оформление](qa-wiki-notion-2026-10-01/README.md).

## Смысловой слой · кандидат 05.10.2026

Отдельный feature flag `DAYCHEE_WIKI_SEMANTICS_ENABLED` по умолчанию выключен.
[Кандидат](../design/candidates/wiki-semantics-2026-10-05/README.md) добавляет узлы
терминов/тем и связи `semantic` только после независимого review и проверки точных
опубликованных цитат. Пояснения и таймкоды доступны на странице понятия и в уроке.
Устаревшая привязка скрывает страницу/узел/обратные ссылки до новой проверки.
Локально подготовлено 10 страниц/16 связей; production пока использует прежний граф.
[Протокол](wiki-semantic-pipeline.md) · [QA](qa-wiki-semantics-2026-10-05/README.md).
