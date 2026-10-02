import json
from pathlib import Path
import sys
import wave

import pytest

from scripts.wiki_asr_pilot import sha256
from scripts.wiki_asr_gate import write_sidecar
from scripts.wiki_asr_queue import bounded_process, split_audio, run, validate_job


def test_partition_has_no_missing_or_duplicated_frames_and_keeps_offsets(tmp_path):
    source = tmp_path/'source.wav'
    raw = bytes(range(256))*4
    with wave.open(str(source), 'wb') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(100)
        f.writeframes(raw)
    clip = {'id': 'sample', 'path': str(source), 'sha256': sha256(source),
            'source_offset_seconds': 81.25}
    pieces = split_audio(clip, tmp_path/'parts', 2)
    assert [p['frame_count'] for p in pieces] == [200, 200, 112]
    assert [p['source_offset_seconds'] for p in pieces] == [81.25, 83.25, 85.25]
    rebuilt = b''
    for p in pieces:
        with wave.open(p['path']) as f:
            rebuilt += f.readframes(f.getnframes())
    assert rebuilt == raw
    clip['sha256'] = 'wrong'
    with pytest.raises(ValueError, match='changed'):
        split_audio(clip, tmp_path/'other', 2)


def test_timeout_terminates_worker_and_keeps_log(tmp_path):
    result = bounded_process([sys.executable, '-u', '-c',
        "import time; print('started'); time.sleep(30)"], tmp_path/'worker.log', .3)
    assert result['status'] == 'timeout'
    assert result['returncode'] != 0
    assert 'started' in (tmp_path/'worker.log').read_text()


def test_sidecar_binds_current_response_without_rewriting_it(tmp_path):
    response = tmp_path/'raw.json'
    response.write_text(json.dumps({'clip_id': 'a', 'audio_sha256': 'audio',
                                   'text': 'пам '*10, 'seconds': 10}))
    before = response.read_bytes()
    gate = write_sidecar(response, tmp_path/'quality.json')
    assert gate['status'] == 'quarantined'
    assert gate['result_sha256'] == sha256(response)
    assert response.read_bytes() == before
    assert gate['content_approved'] is False


def test_resume_skips_complete_job_and_detects_changed_response(tmp_path, monkeypatch):
    import scripts.wiki_asr_queue as queue_module
    source = tmp_path/'sample.wav'
    with wave.open(str(source), 'wb') as f:
        f.setnchannels(1); f.setsampwidth(2); f.setframerate(100)
        f.writeframes(b'\x00\x00'*100)
    jobroot = tmp_path/'jobs'/'a'
    jobroot.mkdir(parents=True)
    manifest = jobroot/'manifest.json'
    manifest.write_text(json.dumps({'clips': [{'id':'a', 'path':str(source), 'sha256':sha256(source)}]}))
    job = {'id':'a', 'manifest_path':str(manifest), 'manifest_sha256':sha256(manifest)}
    assert validate_job(job) is None
    response = jobroot/'large'/'a.json'
    response.parent.mkdir()
    response.write_text(json.dumps({'clip_id':'a', 'audio_sha256':sha256(source), 'seconds':1,
        'text':'Привет', 'settings':{'model':'mlx-community/whisper-large-v3-mlx'}}))
    (tmp_path/'queue.json').write_text(json.dumps({'jobs':[job], 'config':{'source_root':str(tmp_path/'original')}}))
    monkeypatch.setattr(queue_module.subprocess, 'run', lambda *a, **k: None)  # preflight only
    def unexpected(*a, **k): raise AssertionError('Complete cached job relaunched')
    monkeypatch.setattr(queue_module, 'bounded_process', unexpected)
    run(tmp_path, Path(sys.executable))
    state = json.loads((tmp_path/'state.json').read_text())
    assert state['jobs']['a']['status'] == 'processed'
    run(tmp_path, Path(sys.executable))
    raw = json.loads(response.read_text()); raw['text']='Изменённый ответ'
    response.write_text(json.dumps(raw))
    with pytest.raises(ValueError, match='responses changed'):
        run(tmp_path, Path(sys.executable))
