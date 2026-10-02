import hashlib
import json

import pytest

from scripts.wiki_asr_score import errors, score, words


def test_counts_and_normalization():
    assert errors(words('Он не идёт'), words('он идёт'))['deletions'] == 1
    assert errors(words('Ёлка, ещё!'), words('елка еще'))['wer'] == 0
    assert errors(['а', 'б'], ['в', 'б', 'г'])['errors'] == 2
    assert errors([], ['выдумка'])['wer'] is None
    assert errors([], ['выдумка'])['insertions'] == 1


def fixture_files(root, verified=True):
    audio = root / 'audio.wav'
    audio.write_bytes(b'fixture audio identity')
    digest = hashlib.sha256(audio.read_bytes()).hexdigest()
    (root / 'manifest.json').write_text(json.dumps({'clips': [{'id': 'one', 'path': str(audio), 'sha256': digest}]}))
    reference = root / 'reference.json'
    reference.write_text(json.dumps({'clips': [{'id': 'one', 'audio_sha256': digest,
        'text': 'не надо', 'reviewer': 'test', 'verified_by_listener': verified}]}))
    for model in ['large', 'turbo', 'parakeet']:
        (root / model).mkdir()
        (root / model / 'one.json').write_text(json.dumps({'clip_id': 'one', 'audio_sha256': digest, 'text': 'надо'}))
    return reference


def test_unverified_reference_cannot_produce_quality_score(tmp_path):
    result = score(tmp_path, fixture_files(tmp_path, False))
    assert result['status'] == 'awaiting_listened_reference'
    assert all(row['wer'] is None for row in result['models'])


def test_listened_reference_and_audio_integrity(tmp_path):
    reference = fixture_files(tmp_path)
    result = score(tmp_path, reference)
    assert all(row['wer'] == 0.5 for row in result['models'])
    (tmp_path / 'audio.wav').write_bytes(b'changed')
    with pytest.raises(ValueError, match='hash mismatch'):
        score(tmp_path, reference)


def test_missing_model_clip_cannot_silently_change_subset(tmp_path):
    reference = fixture_files(tmp_path)
    (tmp_path / 'turbo' / 'one.json').unlink()
    with pytest.raises(FileNotFoundError):
        score(tmp_path, reference)
