# Вики: воспроизводимая работа участников — protocol v1

[Таблица прогресса и оценки](wiki-work-plan.md) · [Выбранный процесс](wiki-production-pipeline.md).
Один результат: 2–4 предложения и 3 точные цитаты на запись,
`source_checked_draft`. Словарь, статьи и одобрение преподавателем — другие задачи.

Эти команды экспорта/импорта сейчас предназначены для YouTube ID.
Drive/Zoom/Facebook требуют отдельного адаптера привязки источника к карточке;
их реальный объём и следующий шаг указаны в таблице прогресса.

## Граница воспроизводимости

ASR-команды уже проверены на нашем Mac mini M4 Pro / 48 ГБ. Они используют MLX
и не являются готовой установкой для Windows/Linux. Базовый путь сотрудничества:
ASR/сборка/импорт на Mac mini, редактура на любом компьютере с агентом,
которому владелец разрешил обрабатывать выданный приватный текст.
Новое развёртывание моделей на другом Mac требует отдельного smoke-test.
Одинаковый протокол означает одинаковые источники, параметры, проверки и формат,
а не гарантированно одинаковый текст от разных агентов.

Координатор фиксирует версию скриптов, lock-файлы окружений и model revisions
из `run.json` в пакете. Рабочее дерево сейчас содержит сторонние изменения;
одного git HEAD недостаточно для воспроизведения. Передавать снимок нужных
скриптов с хешами, а не весь dirty-проект и не его секреты.

## 1. Назначение и пакет

Координатор резервирует batch_id и три resource_id в общем приватном реестре.
Проверяет пересечение с imported/assigned и уникальное совпадение в каталоге.
Если один ресурс относится к нескольким карточкам, останавливает его назначение.
Два ресурса одной карточки нельзя независимо импортировать с одной revision.

Пакет участника содержит только назначенную партию:

- `assignment.json`: protocol_version=1, batch_id, index_sha256,
  resource_id/catalog_id/title, SHA-256 TXT/SRT и исходного аудио;
- полные TXT/SRT всех назначенных записей;
- `segments.json`: resource_id, clip_id, segment_index, текст, абсолютные
  start/end_seconds; выбранный контекст Parakeet для сопоставления;
- `production-review-queue.json`: запрещённые для цитат clip_id;
- `diagnostic-report.json`: неопределённости, не сертификат точности;
- исходники скриптов/инструкция без приватных данных и credentials, если нужны.

Аудио передаётся отдельно только слушающему проверяющему. Большой provenance
с абсолютными путями остаётся на Mac mini. Участник возвращает ссылки на сегменты,
а сборка выполняется по оригиналам: редактирование TXT/SRT/таймкодов запрещено.
Пакет и assignment — формат передачи, не уже созданные назначения.

## 2. Готовое задание агенту участника

Скопировать вместе с выданной партией; координатор подставляет ID и пути:

> Ты редактор назначенной партии вики protocol v1. Обработай только ресурсы из
> assignment.json. Проверь SHA-256 выданных файлов. Прочитай полный текст каждого
> занятия; если контекст не помещается, читай последовательно с журналом диапазонов.
> Напиши для каждого 2–4 содержательных предложения на русском, объясняющие тему
> и работу на занятии. Не сочиняй определения, термины, медицинские выводы или
> точные инструкции о движениях, которые нельзя подтвердить по источнику.
> Выбери три короткие законченные цитаты по segments.json вне запрещённых clip_id.
> Верни editorial.json: records с resource_id, summary, evidence (clip_id,
> segment_indexes — последовательные индексы) и review_notes. Цитаты не переписывай:
> сборщик возьмёт исходный текст сам. В review_notes перечисли прочитанные файлы,
> исключённые утверждения, спорные термины и ограничения. Отдельно верни вопросы
> и фактическое время/usage, если доступен. Статус только source_checked_draft;
> не утверждай, что слушал запись или получил одобрение, если этого не было.
> Не меняй каталог, приложение, права доступа и сервер. Не загружай корпус
> в дополнительные сервисы. Не выбирай новые ресурсы вне назначения.

Формат возвращаемого файла (идентификаторы/номера здесь условные):

```json
{
  "records": [{
    "resource_id": "<assigned YouTube ID>",
    "summary": "Два–четыре предложения по полному тексту.",
    "evidence": [
      {"clip_id": "<clean clip A>", "segment_indexes": [2, 3]},
      {"clip_id": "<clean clip B>", "segment_indexes": [4, 5]},
      {"clip_id": "<clean clip C>", "segment_indexes": [0, 1]}
    ],
    "review_notes": "Полные тексты прочитаны; исключения и ограничения."
  }]
}
```

В records должны быть все и только назначенные ресурсы. Если нет трёх чистых
цитат или тема зависит от спорного фрагмента — вернуть blocked с причиной,
не подбирать выдуманное подтверждение и не снижать проверки.

## 3. Отдельная проверка другим участником/агентом

> Получи то же assignment, исходные тексты, segments, очередь и editorial.
> Независимо проверь каждое предложение по полному источнику, не только три цитаты.
> Сверь evidence с исходными сегментами и запретами. Отметь добавленные выводы,
> неверный контекст, испорченные термины и незаконченные цитаты. Верни review.json
> с resource_id, verdict pass/needs_changes/blocked, замечаниями и ограничениями.
> Совпадение моделей не считать истинным эталоном. Не присваивай одобрение учителя.

Редактор исправляет needs_changes; проверяющий повторяет только изменившиеся
места и затронутый контекст. Неясное слово можно исключить; если оно определяет
смысл, назначить слушание с таймкодом. Координатор не импортирует без pass,
валидного файла и реальных доказательств. Это новый рекомендуемый этап;
независимая проверка прежних 45 конспектов ещё не подтверждена.

## 4. Команды координатора на текущем Mac mini

Из корня репозитория. Значения переменных подставляются из назначения;
новая партия всегда получает новый каталог. Не копировать batch-03 как новую.

```sh
export WIKI_BATCH_ROOT="data/wiki-pipeline/<date>/<new-batch>"
export WIKI_BATCH_ID="wiki-enrichment-<unique-id>"
export WIKI_EDITORIAL_ROOT="data/wiki-enrichment/<date>/<new-batch>"
export WIKI_INDEX="data/nikita-archive/2026-09-19/index.json"
export WIKI_HF_CACHE="$PWD/data/wiki-pipeline/2026-09-28/hf-cache"
export WIKI_ASR_PY="$PWD/data/wiki-pipeline/2026-09-28/venv/bin/python"
export WIKI_QWEN_PY="$PWD/data/wiki-pipeline/2026-09-28/qwen-venv/bin/python"
umask 077
mkdir -p "$WIKI_BATCH_ROOT/source" "$WIKI_EDITORIAL_ROOT"
```

Окружение: основной repo `.venv`; ASR/Qwen — отдельные уже установленные venv.
Замороженные зависимости находятся в `data/wiki-pipeline/2026-09-28/`:
`real-batch-requirements.lock.txt` и `qwen-requirements.lock.txt`.
Offline-кеш должен содержать модели до запуска; не обновлять их посреди партии.

**Аудио.** Координатор создаёт `urls.txt` только из назначенных YouTube-ссылок.

```sh
yt-dlp --batch-file "$WIKI_BATCH_ROOT/urls.txt" -f ba -x --audio-format wav \
  --postprocessor-args 'ExtractAudio+ffmpeg:-ar 16000 -ac 1' \
  -o "$WIKI_BATCH_ROOT/source/%(id)s.%(ext)s"
HF_HOME="$WIKI_HF_CACHE" HF_HUB_OFFLINE=1 "$WIKI_ASR_PY" \
  -m scripts.wiki_real_batch prepare --root "$WIKI_BATCH_ROOT/asr" \
  --source "$WIKI_BATCH_ROOT/source"
```

Не использовать произвольные публичные видео вместо недоступного источника.
В `asr/catalog-labels.json` связать recording ID из manifest с точной карточкой:

```json
{
  "recording-01": [{
    "catalog_id": "<exact catalog id>",
    "title": "<exact title>",
    "resource_id": "<YouTube ID from source filename>"
  }]
}
```

Порядок recording ID задаётся сортировкой WAV, не порядком URLs.
Все источники должны быть связаны, хеш индекса совпадать с assignment.

**Основные проходы и единая очередь запретов.**

```sh
.venv/bin/python -m scripts.wiki_asr_batch --root "$WIKI_BATCH_ROOT/asr" \
  --python "$WIKI_ASR_PY" --hf-cache "$WIKI_HF_CACHE" --timeout-seconds 600
.venv/bin/python -m scripts.wiki_real_batch report --root "$WIKI_BATCH_ROOT/asr"
.venv/bin/python - <<'PY'
import os, json
from pathlib import Path
from scripts.wiki_asr_gate import reasons
r = Path(os.environ['WIKI_BATCH_ROOT']) / 'asr'
q = json.loads((r/'review-queue.json').read_text())
items = {i['clip_id']: i for i in q['items']}
clips = {c['id']: c for c in json.loads((r/'manifest.json').read_text())['clips']}
for model in ['turbo', 'parakeet']:
    for p in sorted((r/model).glob('*.json')):
        d = json.loads(p.read_text())
        if 'clip_id' not in d:
            continue
        flags = reasons(d)
        if flags:
            cid = d['clip_id']; c = clips[cid]
            i = items.setdefault(cid, {**c, 'clip_id': cid, 'audio_path': c['path'], 'reasons': []})
            i['reasons'] = sorted(set(i['reasons'] + [model+':'+f for f in flags]))
q['items'] = [items[k] for k in sorted(items)]
p = r/'production-review-queue.json'
p.write_text(json.dumps(q, ensure_ascii=False, indent=2)+'\n'); p.chmod(0o600)
print('blocked clips:', len(items))
PY
```

**Короткие повторы.** Если очередь пуста, этот этап пропустить.

```sh
.venv/bin/python -m scripts.wiki_asr_diagnostics prepare \
  --root "$WIKI_BATCH_ROOT/disputes" --source "$WIKI_BATCH_ROOT/asr" \
  --review "$WIKI_BATCH_ROOT/asr/production-review-queue.json"
.venv/bin/python -m scripts.wiki_asr_diagnostics run \
  --root "$WIKI_BATCH_ROOT/disputes" --python "$WIKI_ASR_PY" \
  --qwen-python "$WIKI_QWEN_PY" --models turbo parakeet qwen \
  --hf-cache "$WIKI_HF_CACHE" --timeout-seconds 180
.venv/bin/python -m scripts.wiki_asr_diagnostics report --root "$WIKI_BATCH_ROOT/disputes"
.venv/bin/python -m scripts.wiki_asr_export --root "$WIKI_BATCH_ROOT/asr" \
  --output "$WIKI_BATCH_ROOT/transcripts" --index "$WIKI_INDEX"
```

Экспорт выполняется и при пустой очереди. Спорные клипы остаются запрещёнными
для цитат даже при согласии повторов. Выдать пакет редактору и проверяющему.
Проверить отсутствующее/оборванное ASR, пропуски SRT, исходные хеши и elapsed.

**Сборка после возврата editorial и pass.**

```sh
.venv/bin/python -m scripts.wiki_asr_enrichment_batch \
  --provenance "$WIKI_BATCH_ROOT/transcripts/provenance.json" \
  --editorial "$WIKI_EDITORIAL_ROOT/editorial.json" \
  --review "$WIKI_BATCH_ROOT/asr/production-review-queue.json" \
  --output "$WIKI_EDITORIAL_ROOT/batch.json" --batch-id "$WIKI_BATCH_ID"
.venv/bin/python -m scripts.wiki_enrichment_import --batch "$WIKI_EDITORIAL_ROOT/batch.json"
.venv/bin/pytest -q tests/test_wiki_asr_diagnostics.py tests/test_wiki_asr_gate.py \
  tests/test_wiki_asr_queue.py tests/test_wiki_asr_export.py \
  tests/test_wiki_asr_enrichment_batch.py tests/test_wiki_content.py
```

Сборщик отвергает подмену хешей/цитат/таймкодов и запрещённые clips. Проверить
локальный participant API на реальном индексе: annotation совпадает с batch,
исходные поля сохранены. Код такого QA уже выполнялся в партиях; отдельного
универсального one-command QA пока нет. Это обязательная проверка координатора.

**Импорт только координатором через существующий доступ.**

```sh
.venv/bin/python -m scripts.wiki_enrichment_import \
  --batch "$WIKI_EDITORIAL_ROOT/batch.json" \
  --password-file data/daychee-owner/admin-password --apply \
  > "$WIKI_EDITORIAL_ROOT/production-verification.txt"
```

Раннер сам проверяет повторный импорт и получает итоговый count, затем выходит
из owner-сессии. Не выдавать этот пароль участникам. Не создавать QA-приглашений
в рамках обработки контента. Проверить `/health`, `/wiki`: 200;
materials/graph/admin content анонимно: 401/no-store. Участник с существующим
доступом проверяет новые карточки/таймкоды в браузере. Если просмотра не было,
явно записать ограничение, не объявлять полную UI QA.

## 5. Когда партия завершена

Все назначенные источники обработаны либо явно blocked; чужие ресурсы не вошли.
Есть editorial, review pass, batch, provenance, evidence-audit, validation,
production receipt и отчёт ограничений. Исходные данные сохранены вне Git.
Изменения опубликованного текста требуют увеличения revision и нового batch_id;
не перезаписывать уже импортированную партию. Обновить общий реестр и
[таблицу прогресса](wiki-work-plan.md), записать фактическое время/usage.

Первые три распределённые партии — проверка самого протокола. Принимать их
по тем же gates, измерить возвраты/время и только затем увеличивать параллелизм.
Пакеты, реестр и права конкретных участников ещё предстоит организовать;
эта инструкция не утверждает, что они уже получили задания или доступ.
