from scripts.wiki_asr_gate import audit, reasons


def test_quarantines_observed_failure_modes():
    assert 'unknown_token' in reasons({'text': 'текст <unk>', 'seconds': 20})
    assert 'repetition_loop' in reasons({'text': 'пам ' * 100, 'seconds': 20})
    assert 'repetition_loop' in reasons({'text': 'и так далее ' * 9, 'seconds': 20})
    assert 'generation_limit' in reasons({'text': 'обычный текст', 'generation_tokens': 512,
                                        'settings': {'max_tokens': 512}})
    assert 'character_run' in reasons({'text': 'говорит «'+'а'*150+'»', 'seconds': 20})
    assert 'subtitle_boilerplate_candidate' in reasons({'text': 'Продолжение следует...', 'seconds': 20})


def test_normal_repetition_is_not_a_loop_and_pass_is_not_approval(tmp_path):
    import json
    p = tmp_path / 'response.json'
    p.write_text(json.dumps({'clip_id': 'a', 'text': 'Вдох, выдох. Вдох, выдох.', 'seconds': 10}))
    report = audit([p])
    assert report['quarantined'] == 0
    assert report['items'][0]['content_approved'] is False


def test_flags_low_confidence_and_invalid_timecodes():
    flags = reasons({'text': 'обычный текст', 'seconds': 10,
                     'segments': [{'start': 12, 'end': 13, 'avg_logprob': -1.5}]})
    assert 'low_confidence_or_compression' in flags
    assert 'timestamp_out_of_bounds' in flags
