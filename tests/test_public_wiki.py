import json

from fastapi.testclient import TestClient
from practice_api.wiki_app import WikiSettings, create_wiki_app
from practice_api.public_wiki import public_link, public_material

def record(n, title):
    return {'id': f'nikita:base:{n}', 'title': title, 'source_date_label': '18 сен 2026',
            'source_timestamp_ms': n, 'category_id': 'neigong', 'category_name': 'Нэйгун',
            'subtopic': 'Трёхмерность', 'subtopic_key': 'трёхмерность',
            'source_text': f'{title} Код доступа: private-code https://example.com/{n}',
            'links': [{'url': f'https://example.com/{n}', 'type': 'zoom', 'label': 'Zoom'}]}


def test_public_wiki_is_off_until_explicit_rollout(tmp_path, monkeypatch):
    monkeypatch.delenv('DAYCHEE_PUBLIC_WIKI_ENABLED', raising=False)
    client = TestClient(create_wiki_app(WikiSettings(tmp_path/'index.json', tmp_path/'wiki.sqlite3', '', '')))
    for path in ('categories', 'materials', 'materials/x', 'graph'):
        assert client.get('/api/public/wiki/' + path).status_code == 404


def test_public_catalog_never_exposes_private_connections(tmp_path, monkeypatch):
    monkeypatch.setenv('DAYCHEE_PUBLIC_WIKI_ENABLED', '1')
    raw = record(1, 'Урок 1')
    raw['links'].append({'url': 'https://youtu.be/abcdefghijk', 'type': 'video', 'label': 'Видео'})
    index = tmp_path/'index.json'
    index.write_text(json.dumps([raw]))
    client = TestClient(create_wiki_app(WikiSettings(index, tmp_path/'wiki.sqlite3', 'student', 'pw')))
    result = client.get('/api/public/wiki/materials').json()
    identity = result['items'][0]['id']
    response = client.get('/api/public/wiki/materials/' + identity)
    assert response.status_code == 200 and response.headers['cache-control'] == 'no-store'
    public = response.json()
    assert public['links'] == []
    assert public['restricted_links'] is True
    for path in ('categories', 'materials', 'materials/'+identity, 'recent', 'graph', 'graph?semantics=1'):
        text = client.get('/api/public/wiki/'+path).text
        assert 'private-code' not in text and 'example.com' not in text
        assert 'zoom_password' not in text and 'source_text' not in text
        assert 'youtu' not in text and 'abcdefghijk' not in text and 'resource_id' not in text
    # Existing protected endpoints remain protected for old clients.
    assert client.get('/api/wiki/materials/'+identity).status_code == 401
    token = client.post('/api/wiki/login', json={'username': 'student', 'password': 'pw'}).json()['token']
    headers = {'Authorization': 'Bearer ' + token}
    private = client.get('/api/wiki/materials/'+identity, headers=headers)
    assert private.status_code == 200 and 'https://youtu.be/abcdefghijk' in private.text
    assert client.post('/api/wiki/logout', headers=headers).status_code == 200
    assert client.get('/api/wiki/materials/'+identity, headers=headers).status_code == 401
    assert client.get('/api/public/wiki/materials?q=private-code').json()['total'] == 0
    assert client.get('/api/public/wiki/materials?ids=missing').json()['missing_ids'] == ['missing']


def test_connection_host_cannot_bypass_guard_by_mislabeling():
    for url in ('https://us02web.zoom.us/j/123?pwd=private', 'https://zoom.us/j/123',
                'https://Zoom.COM./j/123', 'https://user:pw@video.test/v', 'http://youtu.be/123',
                'https://video.test/v?token=secret', 'https://video.test/v?%74oken=secret',
                'https://video.test:bad/v', 'https://[invalid/v',
                'https://%79outube.com/watch?v=abcdefghijk',
                'https://ｙｏｕｔｕｂｅ.com/watch?v=abcdefghijk',
                'https://youtube。com/watch?v=abcdefghijk',
                'https://youtu.be\\abcdefghijk', 'https://%ff.youtube.com/watch?v=abcdefghijk'):
        assert public_link({'url': url, 'label': 'Video', 'type': 'video'}) is None
    for host in ('YouTube.COM.', 'm.youtube.com', 'www.youtube.com', 'youtu.be',
                 'www.youtube-nocookie.com'):
        for kind in ('video', 'article', 'drive', 'doc'):
            assert public_link({'url': f'https://{host}/embed/abcdefghijk', 'type': kind}) is None
    assert public_link({'url': 'https://example.org/article', 'type': 'article'}) is not None


def test_recordings_require_live_daychi_access_and_close_on_invitation_revocation(tmp_path, monkeypatch):
    from practice_api.daychee_app import create_daychee_app
    from practice_api.invitations import Invitations
    from practice_api.wiki_content import Batch
    from tests.test_wiki_content import payload
    monkeypatch.setenv('DAYCHEE_PUBLIC_WIKI_ENABLED', '1')
    row = record(1, 'Урок')
    row['links'].append({'url': 'https://youtu.be/abcdefghijk', 'type': 'video', 'label': 'Запись'})
    index = tmp_path/'index.json'; index.write_text(json.dumps([row]))
    invitations = Invitations(tmp_path/'access.sqlite3')
    invite_id, code = invitations.issue()
    app = create_daychee_app(WikiSettings(index, tmp_path/'wiki.sqlite3', '', ''), invitations, tmp_path/'zoom.json')
    app.state.wiki_content.import_batch(Batch(batch_id='protected-recording', records=[payload()]), app.state.wiki_catalog())
    client = TestClient(app)
    identity = client.get('/api/public/wiki/materials').json()['items'][0]['id']
    path = '/api/wiki/materials/' + identity
    assert client.get(path).status_code == 401
    token = client.post('/api/access/redeem', json={'token': code}).json()['token']
    headers = {'Authorization': 'Bearer ' + token}
    private = client.get(path, headers=headers)
    assert private.status_code == 200
    assert private.json()['annotation']['resource_id'] == 'abcdefghijk'
    assert 'https://youtu.be/abcdefghijk' in private.text
    public = client.get('/api/public/wiki/materials/' + identity)
    assert public.status_code == 200 and public.json()['annotation']['points']
    assert 'abcdefghijk' not in public.text and 'resource_id' not in public.text
    invitations.revoke(invite_id)
    assert client.get(path, headers=headers).status_code == 401
    assert client.get('/api/public/wiki/materials/' + identity).json() == public.json()


def test_public_detail_does_not_copy_unknown_fields():
    row = {key: '' for key in ('id','title','date','category','category_name','subtopic','subtopic_key','description')}
    row.update(timestamp=1, links=[], zoom_password='private', source_text='private', credential='private')
    assert 'private' not in json.dumps(public_material(row))


def test_public_annotations_are_allowlisted_and_redacted():
    row = {key: '' for key in ('id','title','date','category','category_name','subtopic','subtopic_key','description')}
    row.update(timestamp=1, links=[{'type': 'video', 'label': 'Видео', 'url': 'https://youtu.be/abcdefghijk'}])
    class Content:
        def get(self, identity, links):
            assert links == row['links']  # Source binding still uses the protected original.
            return {'resource_id': 'abcdefghijk', 'revision': 1, 'status': 'source_checked_draft',
                    'summary': 'Аннотация пароль: hidden-secret https://zoom.us/j/123 youtu.be/abcdefghijk',
                    'points': [{'text': 'Цитата код доступа: hidden-secret', 'start_seconds': 1,
                                'end_seconds': 2, 'private_provenance': 'private'}],
                    'transcript_sha256': 'private'}
    result = json.dumps(public_material(row, Content()))
    assert 'hidden-secret' not in result and 'zoom.us' not in result and 'private' not in result
    assert 'resource_id' not in result and 'abcdefghijk' not in result and 'youtu' not in result


def test_public_reader_updates_are_real_and_private_provenance_stays_private(tmp_path, monkeypatch):
    from practice_api.wiki_content import Batch
    from tests.test_wiki_content import payload
    monkeypatch.setenv('DAYCHEE_PUBLIC_WIKI_ENABLED', '1')
    row = record(1, 'Урок')
    row['links'].append({'url': 'https://youtu.be/abcdefghijk', 'type': 'video', 'label': 'Видео'})
    index = tmp_path/'index.json'; index.write_text(json.dumps([row]))
    app = create_wiki_app(WikiSettings(index, tmp_path/'wiki.sqlite3', '', ''))
    client = TestClient(app)
    identity = client.get('/api/public/wiki/materials').json()['items'][0]['id']
    assert 'annotation' not in client.get('/api/public/wiki/materials/'+identity).json()
    app.state.wiki_content.import_batch(Batch(batch_id='public-reader', records=[payload()]), app.state.wiki_catalog())
    with app.state.wiki_content.db() as db:
        db.execute('UPDATE content SET updated=123456789 WHERE material_id=?', (identity,))
    result = client.get('/api/public/wiki/materials/'+identity).json()
    assert result['annotation']['updated_at'] == 123456789
    assert result['annotation']['status'] == 'source_checked_draft'
    assert len(result['annotation']['points']) == 2
    assert result['links'] == [] and result['restricted_links'] is True
    assert 'resource_id' not in result['annotation']
    assert 'transcript_sha256' not in result['annotation']
    assert 'subtitles_sha256' not in result['annotation']
    # Changing the original source must hide the old reader annotation.
    row['links'][-1]['url'] = 'https://youtu.be/otherid1234'
    index.write_text(json.dumps([row]))
    assert 'annotation' not in client.get('/api/public/wiki/materials/'+identity).json()


def test_public_recent_falls_back_to_source_date_and_graph_ids_match_reader(tmp_path, monkeypatch):
    monkeypatch.setenv('DAYCHEE_PUBLIC_WIKI_ENABLED', '1')
    index = tmp_path/'index.json'
    index.write_text(json.dumps([record(0, 'Неизвестная дата'), record(20, 'Серия 2'), record(10, 'Серия 1')]))
    client = TestClient(create_wiki_app(WikiSettings(index, tmp_path/'wiki.sqlite3', '', '')))
    response = client.get('/api/public/wiki/recent?limit=1')
    assert response.status_code == 200 and response.headers['cache-control'] == 'no-store'
    assert response.json()['date_basis'] == 'last_update'
    recent = response.json()['items']; assert recent[0]['title'] == 'Серия 2'
    assert recent[0]['timestamp'] == 20
    graph = client.get('/api/public/wiki/graph').json()
    assert graph['version'] == client.get('/api/public/wiki/graph').json()['version']
    material_ids = {n['id'] for n in graph['nodes'] if n['type'] == 'material'}
    assert recent[0]['id'] in material_ids
    assert {i['id'] for i in client.get('/api/public/wiki/materials').json()['items']} == material_ids
    for identity in material_ids:
        assert client.get('/api/public/wiki/materials/'+identity).status_code == 200
    assert any(e['k'] == 'series' for e in graph['edges'])
    assert 'private-code' not in json.dumps(graph)
    assert 'example.com' not in response.text


def test_annotation_update_moves_old_lesson_to_recent_top_without_changing_catalog(tmp_path, monkeypatch):
    from practice_api.wiki_content import Batch
    monkeypatch.setenv('DAYCHEE_PUBLIC_WIKI_ENABLED', '1')
    old = record(10, 'Старый урок')
    old['links'].append({'url':'https://youtu.be/abcdefghijk','type':'video','label':'Видео'})
    index = tmp_path/'index.json'
    index.write_text(json.dumps([old, record(20, 'Новый урок')]))
    app = create_wiki_app(WikiSettings(index, tmp_path/'wiki.sqlite3', '', ''), access_authorizer=lambda:'fixture')
    client = TestClient(app)
    row = next(r for r in app.state.wiki_catalog() if r['title']=='Старый урок')
    batch = Batch(batch_id='update', records=[{'resource_id':'abcdefghijk','expected_title':'Старый урок',
        'revision':1,'summary':'Проверенный конспект старого записанного занятия.',
        'points':[{'text':'Первая точная цитата','start_seconds':1,'end_seconds':2},
                  {'text':'Вторая точная цитата','start_seconds':3,'end_seconds':4}],
        'transcript_sha256':'a'*64,'subtitles_sha256':'b'*64}])
    before_version = client.get('/api/public/wiki/graph').json()['version']
    app.state.wiki_content.import_batch(batch, app.state.wiki_catalog())
    recent = client.get('/api/public/wiki/recent').json()['items']
    assert recent[0]['id']==row['id'] and recent[0]['timestamp']==10
    assert recent[0]['updated_timestamp']>20
    for endpoint in ['/api/public/wiki/graph','/api/wiki/graph']:
        node=next(n for n in client.get(endpoint).json()['nodes'] if n['id']==row['id'])
        assert node['ts']==10 and node['updated_ts']==recent[0]['updated_timestamp']
    assert client.get('/api/public/wiki/graph').json()['version']!=before_version
    app.state.wiki_content.import_batch(batch,app.state.wiki_catalog())
    assert client.get('/api/public/wiki/recent').json()['items']==recent
    assert client.get('/api/public/wiki/materials').json()['items'][0]['title']=='Новый урок'
    old['links'][-1]['url']='https://youtu.be/otherid1234'
    index.write_text(json.dumps([old,record(20,'Новый урок')]))
    assert client.get('/api/public/wiki/recent').json()['items'][0]['title']=='Новый урок'
    assert all('updated_ts' not in n for n in client.get('/api/public/wiki/graph').json()['nodes'])
