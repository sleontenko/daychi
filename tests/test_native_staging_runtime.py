"""Deployment bootstrap coverage; injected decisions never exist as HTTP controls."""
import importlib.util
from pathlib import Path

from fastapi.testclient import TestClient
from practice_api.cabinet_session_http import NativeSessionResult


def runtime():
    path = Path(__file__).resolve().parents[1] / 'deploy/native-materials-staging/run.py'
    spec = importlib.util.spec_from_file_location('native_staging_runtime', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_staging_real_alias_surface_and_synthetic_content(tmp_path, monkeypatch):
    monkeypatch.setattr('os.environ', dict(__import__('os').environ))
    calls = []
    async def check(credential):
        calls.append(credential)
        return NativeSessionResult(200)
    app = runtime().create_fixture_app(tmp_path, check=check)
    client = TestClient(app, base_url='https://native-test.example')
    for route in app.app.state.native_content_routes:
        path = route.replace('{material_id}', '1'*32).replace('{concept_id}', 'fixture-topic')
        response = client.get(path, headers={'Authorization': 'Bearer synthetic-native-token'})
        assert response.status_code == 200, (path, response.text)
        assert response.headers['cache-control'] == 'no-store'
    assert len(calls) == 9
    assert client.get('/api/native/wiki/materials/'+'1'*32,
                      headers={'Authorization': 'Bearer synthetic-native-token'}).json()['links']
    assert client.get('/health').status_code == 200
    for path in ('/wiki', '/api/wiki/materials', '/api/public/wiki/materials',
                 '/api/site/wiki-graph', '/api/admin/wiki/articles/sources', '/api/access/zoom'):
        assert client.get(path).status_code == 404
    assert client.post('/api/access/redeem-code', json={'code':'synthetic'}).status_code == 404
    assert client.post('/api/native/wiki/materials').status_code == 404


def test_staging_refusals_do_not_deliver_recording_or_cache_success(tmp_path, monkeypatch):
    monkeypatch.setattr('os.environ', dict(__import__('os').environ))
    replies = [200, 401, 403, 503, 200]
    async def check(_):
        return NativeSessionResult(replies.pop(0))
    client = TestClient(runtime().create_fixture_app(tmp_path, check=check),
                        base_url='https://native-test.example')
    for status in (200, 401, 403, 503, 200):
        response = client.get('/api/native/wiki/materials/'+'1'*32,
                              headers={'Authorization': 'Bearer synthetic-native-token'})
        assert response.status_code == status
        assert ('youtu.be' in response.text) is (status == 200)
        assert response.headers['cache-control'] == 'no-store'
    assert not replies
    assert client.get('/api/native/wiki/materials/'+'1'*32).status_code == 401


def test_staging_has_stable_synthetic_ids_without_private_data(tmp_path, monkeypatch):
    monkeypatch.setattr('os.environ', dict(__import__('os').environ))
    first = runtime().create_fixture_app(tmp_path)
    second = runtime().create_fixture_app(tmp_path)
    assert [r['id'] for r in first.app.state.wiki_catalog()] == ['1'*32, '2'*32]
    assert [r['id'] for r in second.app.state.wiki_catalog()] == ['1'*32, '2'*32]
    assert (tmp_path/'index.json').stat().st_mode & 0o777 == 0o600
