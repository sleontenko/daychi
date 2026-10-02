# Участие в разработке

Начните с [README](README.md), [архитектуры](docs/ARCHITECTURE.md)
и [AGENTS](AGENTS.md). Создайте ветку для одной задачи; используйте
`npm ci` и зафиксированные зависимости.

## Проверки

```sh
# Из корня
.venv/bin/python -m pytest -q
python3 scripts/check_repository.py --staged

# apps/practice-app
npm run typecheck
npm run lint
npm test

# apps/wiki-graph
npm ci
npm test
npm run build
```

Запускайте проверки затронутых компонентов. Изменения веб-вики включают
обновлённый bundle в `practice_api/wiki_graph_web/`.

UI проверяется по [дизайн-референсам](docs/DESIGN.md): затронутые состояния,
back/close, Android Back, сохранение выбора, прокрутки и черновика.
В PR укажите результат и непроверенные сценарии; CI не заменяет native QA.

## Pull request

Опишите проблему, результат и выполненные проверки. Перед commit/push просмотрите
git status и staged diff; не включайте чужую незавершённую работу.
Не меняйте публичные идентификаторы, версии зависимостей или release metadata
попутно с другой задачей.

Используйте синтетические fixtures. Корпус, рабочие базы, сессии, коды приглашений,
Zoom-реквизиты и ключи остаются вне Git; см. [SECURITY](SECURITY.md).
Исходники релиза фиксируются отдельным commit/tag. Выпуск и deploy согласуются отдельно.
