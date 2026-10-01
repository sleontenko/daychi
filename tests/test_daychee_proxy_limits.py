from fastapi.testclient import TestClient
from practice_api.daychee_app import create_daychee_app
from practice_api.invitations import Invitations
from practice_api.wiki_app import WikiSettings


def test_railway_limit_uses_only_valid_edge_ip(tmp_path, monkeypatch):
    monkeypatch.setenv('RAILWAY_ENVIRONMENT_ID', 'test-environment')
    app = create_daychee_app(WikiSettings(tmp_path/'index', tmp_path/'wiki', '', ''), Invitations(tmp_path/'access'))
    client = TestClient(app)
    for _ in range(10):
        assert client.post('/api/access/redeem-code', json={'code':'A'*12}, headers={'X-Real-IP':'192.0.2.1'}).status_code == 401
    assert client.post('/api/access/redeem-code', json={'code':'A'*12}, headers={'X-Real-IP':'192.0.2.1','X-Forwarded-For':'192.0.2.2'}).status_code == 429
    assert client.post('/api/access/redeem-code', json={'code':'A'*12}, headers={'X-Real-IP':'192.0.2.2'}).status_code == 401


def test_local_deployment_does_not_trust_client_headers(tmp_path, monkeypatch):
    monkeypatch.delenv('RAILWAY_ENVIRONMENT_ID', raising=False)
    monkeypatch.delenv('FLY_APP_NAME', raising=False)
    app = create_daychee_app(WikiSettings(tmp_path/'index', tmp_path/'wiki', '', ''), Invitations(tmp_path/'access'))
    client = TestClient(app)
    statuses = [client.post('/api/access/redeem-code', json={'code':'A'*12}, headers={'X-Real-IP':f'192.0.2.{i}'}).status_code for i in range(1,12)]
    assert statuses == [401]*10+[429]
