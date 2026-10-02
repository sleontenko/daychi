from fastapi.testclient import TestClient

from practice_api.daychee_app import create_daychee_app
from practice_api.invitations import Invitations
from practice_api.wiki_app import WikiSettings


def test_release_pages_are_public_only_after_text_approval(tmp_path, monkeypatch):
    cfg = WikiSettings(tmp_path/'index.json', tmp_path/'wiki.db', '', '')
    store = Invitations(tmp_path/'access.db')
    monkeypatch.delenv('DAYCHEE_PUBLIC_PAGES_ENABLED', raising=False)
    disabled = TestClient(create_daychee_app(cfg, store))
    for route in ('/privacy', '/support', '/public-page-assets/pages.css'):
        assert disabled.get(route).status_code == 404
    monkeypatch.setenv('DAYCHEE_PUBLIC_PAGES_ENABLED', '1')
    public = TestClient(create_daychee_app(cfg, store))
    for route in ('/privacy', '/support'):
        response = public.get(route)
        assert response.status_code == 200 and 'dev@mypraxis.ai' in response.text
        assert 'Черновик' in response.text or 'подготовлена локально' in response.text
        assert response.headers['cache-control'] == 'no-store'
        assert response.headers['referrer-policy'] == 'no-referrer'
        assert "frame-ancestors 'none'" in response.headers['content-security-policy']
    assert public.get('/public-page-assets/pages.css').status_code == 200
    assert public.get('/public-page-assets/../index.json').status_code == 404
    assert public.get('/api/access/zoom').status_code == 401
