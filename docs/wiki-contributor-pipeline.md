# Протокол участника · v1

Результат для одного ресурса: 2–4 предложения и 3 точные цитаты,
статус `source_checked_draft`. [Процесс](wiki-production-pipeline.md)
· [Назначения](wiki-team-pipeline.md).

## Пакет

Координатор резервирует batch_id и 3 resource_id, проверяет прежние назначения
и однозначную связь с карточкой. Участник получает:

- `assignment.json`: protocol_version, batch_id, index_sha256, ID и hashes;
- полные TXT/SRT, `segments.json` с clip_id, индексами и start/end_seconds;
- `production-review-queue.json`: запрещённые clips;
- диагностику и зафиксированную версию инструментов.

Не менять исходные тексты или таймкоды. Аудио выдаётся отдельно проверяющему;
admin credentials не нужны.

## Редактура и проверка

Прочитать весь текст назначенных ресурсов. Не добавлять догадочные определения,
точные указания движения или медицинские выводы.
Проверить фактический язык текста, не полагаясь только на metadata.
Конспект писать на русском, цитаты сохранять на языке источника без перевода.
Цитаты выбираются из последовательных исходных сегментов вне quarantine.
Если чистых доказательств недостаточно — blocked с причиной.

```json
{
  "records": [{
    "resource_id": "<assigned ID>",
    "summary": "Два–четыре предложения по полному источнику.",
    "evidence": [
      {"clip_id": "<A>", "segment_indexes": [2, 3]},
      {"clip_id": "<B>", "segment_indexes": [4, 5]},
      {"clip_id": "<C>", "segment_indexes": [0, 1]}
    ],
    "review_notes": "Спорные термины, исключения и ограничения."
  }]
}
```

Вернуть `editorial.json` только с назначенными ID.
Другой проверяющий сопоставляет каждое утверждение с полным источником
и возвращает `review.json`: pass / needs_changes / blocked.
Непроверенные спорные слова исключаются или направляются на слушание.
Не присваивать одобрение преподавателя.

## Команды координатора

Рабочие пути и Python-окружения задаются локальной конфигурацией.
Основной ASR использует MLX/Apple Silicon; Qwen — отдельное окружение.
Пример после подготовки WAV и каталожной привязки:

```sh
python -m scripts.wiki_asr_batch --root "$WIKI_BATCH_ROOT/asr" \
  --python "$WIKI_ASR_PY" --hf-cache "$WIKI_HF_CACHE" --timeout-seconds 600
python -m scripts.wiki_real_batch report --root "$WIKI_BATCH_ROOT/asr"
python -m scripts.wiki_asr_export --root "$WIKI_BATCH_ROOT/asr" \
  --output "$WIKI_BATCH_ROOT/transcripts" --index "$WIKI_INDEX"
python -m scripts.wiki_asr_enrichment_batch \
  --provenance "$WIKI_BATCH_ROOT/transcripts/provenance.json" \
  --editorial "$WIKI_EDITORIAL_ROOT/editorial.json" \
  --review "$WIKI_BATCH_ROOT/asr/production-review-queue.json" \
  --output "$WIKI_EDITORIAL_ROOT/batch.json" --batch-id "$WIKI_BATCH_ID"
python -m scripts.wiki_enrichment_import --batch "$WIKI_EDITORIAL_ROOT/batch.json"
```

До экспорта сформировать production-review-queue из расхождений и всех
флагов `wiki_asr_gate.reasons` для Turbo/Parakeet. Спорные clips остаются
запрещёнными даже после коротких повторов. Диагностика:
`wiki_asr_diagnostics prepare|run|report --help`.

Импорт с `--apply --password-file <local-secret-file>` выполняет координатор
после review pass и валидации. Endpoint `/api/admin/wiki/content`
защищён admin session, Origin и CSRF. Сборщик проверяет hashes,
цитаты, таймкоды и quarantine.

## Завершение партии

Проверить все annotation payload, неизменность исходных полей,
повторный импорт и anonymous 401/no-store. Сохранить batch/provenance,
evidence-audit, validation и receipt вне Git. Проверить новые карточки
в авторизованном UI; непроверенные пути указать отдельно.

Правка опубликованного конспекта получает новую revision и batch_id.
Обновить реестр и [прогресс](wiki-work-plan.md), фактическое время и доступный usage.
