import pytest
from scripts.wiki_real_batch import windows


def test_keeps_offsets_and_never_joins_long_silence():
    spans=[{'start':10,'end':20},{'start':22,'end':30},{'start':80,'end':90}]
    assert windows(spans, max_samples=100,gap_samples=5)==[{'start':10,'end':30},{'start':80,'end':90}]
    assert spans[0]['end']==20


def test_respects_limit_and_rejects_overlap():
    assert windows([{'start':0,'end':60},{'start':61,'end':120}],max_samples=100,gap_samples=5)==[{'start':0,'end':60},{'start':61,'end':120}]
    with pytest.raises(ValueError):windows([{'start':0,'end':10},{'start':9,'end':20}])
    assert windows([])==[]
