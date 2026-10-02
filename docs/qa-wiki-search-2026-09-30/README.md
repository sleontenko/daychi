# Поиск: QA · 2026-09-30

Debounce больше не заменяет search input: обновляется только выдача
и URL через replaceState. Сохраняются фокус, курсор, выделение;
учтены composition events и отмена pending поиска при переходе.

Локально проверены вставка/удаление в середине строки, диапазон выделения
и debounce на desktop/390×844. Build, 27 Python и 1 Node test прошли.
Опубликованный JS совпал по hash; health/wiki — 200, закрытые API — 401.

Физические устройства, настоящая IME-клавиатура и production participant UI
не проверены.
