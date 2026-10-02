"""Render local benchmark measurements; quality is unscored without listened references."""
import argparse
import json
from pathlib import Path
import statistics


def build(root):
    manifest = json.loads((root/'manifest.json').read_text())
    clips = manifest['clips']
    results = {}
    rows = []
    for name in ['turbo','large','parakeet']:
        run_dir = root/name
        if not run_dir.exists():
            continue
        records = []
        for clip in clips:
            path = run_dir/(clip['id']+'.json')
            if not path.exists():
                continue
            record = json.loads(path.read_text())
            assert record['audio_sha256'] == clip['sha256'], 'Mismatched audio'
            assert record['seconds'] == clip['seconds']
            records.append(record)
        results[name] = {r['clip_id']:r for r in records}
        speech = [r for r in records if r['clip_id'] != 'control-silence']
        if not speech:
            continue
        seconds = sum(r['elapsed_seconds'] for r in speech)
        duration = sum(r['seconds'] for r in speech)
        silence = results[name].get('control-silence')
        timestamp_warnings = []
        for record in records:
            for segment in record['segments']:
                if not (0 <= float(segment['start']) <= float(segment['end']) <= record['seconds'] + 1):
                    timestamp_warnings.append({'clip':record['clip_id'], 'start':segment['start'], 'end':segment['end']})
        rows.append({'model':name, 'clips':len(speech),'audio_seconds':duration,
                     'elapsed_seconds':seconds, 'rtf':seconds/duration,
                     'times_realtime':duration/seconds,
                     'median_clip_seconds':statistics.median(r['elapsed_seconds'] for r in speech),
                     'peak_mlx_gib':max(r['peak_mlx_bytes'] for r in speech)/1024**3,
                     'silence_output':silence['text'].strip() if silence else None,
                     'timestamp_range_warnings':timestamp_warnings,
                     'wer':None,'quality_status':'awaiting_listened_reference'})
    payload = {'measurements':rows, 'note':manifest['note'],
               'scope':'Measured ASR time only, excludes download/setup and human review',
               'quality':'No accuracy ranking: references have not been verified by listening.'}
    reference = root/'listening-reference.json'
    if not reference.exists():
        reference.write_text(json.dumps({'instructions':'Fill only after listening. Do not copy an ASR output as ground truth.',
           'clips':[{'id':c['id'],'audio_sha256':c['sha256'],'audio_path':c['path'],
                     'text':None,'verified_by_listener':False,'reviewer':None,
                     'terminology_notes':[]} for c in clips if c['id']!='control-silence']},
           ensure_ascii=False,indent=2)+'\n')
    (root/'summary.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n')
    lines = ['# ASR: техническое сравнение', '', manifest['note'], '',
             'Время ниже не включает скачивание/загрузку модели. WER и точность терминов не оценены:',
             'нет эталона, проверенного прослушиванием. Совпадение моделей не является эталоном.', '',
             '| Модель | Фрагменты | Аудио, сек | ASR, сек | RTF | Быстрее real-time | Peak MLX, GiB |',
             '| --- | ---: | ---: | ---: | ---: | ---: | ---: |']
    for r in rows:
        lines.append(f"| {r['model']} | {r['clips']} | {r['audio_seconds']:.0f} | {r['elapsed_seconds']:.1f} | {r['rtf']:.3f} | {r['times_realtime']:.1f} | {r['peak_mlx_gib']:.2f} |")
    lines += ['', '## Контроль цифровой тишины', '']
    for r in rows:
        lines.append(f"- {r['model']}: {r['silence_output']!r}")
    lines += ['', '## Тексты для независимого прослушивания', '']
    for clip in clips:
        if clip['id']=='control-silence':continue
        lines += [f"### {clip['id']}", '', f"[Аудиофрагмент]({clip['path']})", '',
                  f"Смещение в исходнике: {clip['source_offset_seconds']:.2f} сек.", '']
        for name, items in results.items():
            if clip['id'] in items:
                lines += [f'**{name}**', '', items[clip['id']]['text'], '']
        lines += ['Проверенный на слух эталон: **не заполнен**.', '']
    (root/'comparison.md').write_text('\n'.join(lines)+'\n')
    print(json.dumps(payload,ensure_ascii=False,indent=2))


if __name__ == '__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--output',required=True)
    args=p.parse_args()
    build(Path(args.output))
