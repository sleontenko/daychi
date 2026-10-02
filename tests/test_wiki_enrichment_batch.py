from scripts.wiki_enrichment_batch import source_sentences


def test_rolling_caption_overlap_keeps_words_and_source_interval(tmp_path):
    path=tmp_path/'captions.srt'
    path.write_text('1\n00:00:01,000 --> 00:00:03,000\nНачинаем движение\n\n2\n00:00:03,000 --> 00:00:05,000\nНачинаем движение\nчерез расслабление. Следующая\n\n3\n00:00:05,000 --> 00:00:07,000\nчерез расслабление. Следующая\nчасть формы.\n')
    assert source_sentences(path)==[
        {'text':'Начинаем движение через расслабление.','start_seconds':1.0,'end_seconds':5.0},
        {'text':'Следующая часть формы.','start_seconds':3.0,'end_seconds':7.0}]
