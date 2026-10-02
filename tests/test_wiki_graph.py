import json

from fastapi.testclient import TestClient
from practice_api.wiki_app import WikiSettings, create_wiki_app
from practice_api.wiki_graph import build_graph


def row(n, title, category='fan', subtopic_key='младшая группа'):
    return {'id': f'm{n}', 'title': title, 'date': '1 сен 2026', 'timestamp': n, 'category': category,
            'category_name': 'Веер', 'subtopic': 'Младшая группа' if subtopic_key else '',
            'subtopic_key': subtopic_key, 'description': 'секретное описание',
            'links': [{'url': 'https://zoom.example/1', 'type': 'zoom', 'label': 'Zoom'},
                      {'url': 'https://video.example/1', 'type': 'video', 'label': 'YouTube'}],
            'zoom_password': 'private-code'}


def edges(graph, kind):
    return {(e['s'], e['t']) for e in graph['edges'] if e['k'] == kind}


def test_structure_and_series_links():
    graph = build_graph([row(1, 'Веер для новичков 38'), row(2, 'Веер для новичков 39'),
                         row(3, 'Веер для новичков 41'), row(4, 'Дракон 39', category='dragon'),
                         row(5, 'Статья без подтемы', subtopic_key=None)])
    assert edges(graph, 'series') == {('m1', 'm2')}  # 39 → 41 is a gap; another category is another series
    structure = edges(graph, 'structure')
    assert ('m1', 's:fan:младшая группа') in structure
    assert ('s:fan:младшая группа', 'c:fan') in structure
    assert ('m5', 'c:fan') in structure
    assert [s['count'] for s in graph['sections']] == [4, 1]
    ids = {n['id'] for n in graph['nodes']}
    assert all(e['s'] in ids and e['t'] in ids for e in graph['edges'])


def test_graph_payload_has_no_private_detail():
    text = json.dumps(build_graph([row(1, 'Веер для новичков 38')]), ensure_ascii=False)
    for secret in ('секретное описание', 'private-code', 'zoom.example', 'video.example'):
        assert secret not in text


def index_record(n, title):
    return {'id': f'nikita:base:{n}', 'title': title, 'source_date_label': '18 сен 2026',
            'source_timestamp_ms': n, 'category_id': 'fan', 'category_name': 'Веер',
            'subtopic': 'Младшая группа', 'subtopic_key': 'младшая группа',
            'source_text': title, 'links': [{'url': f'https://example.com/{n}', 'type': 'video', 'label': 'YouTube'}]}


def test_graph_endpoint_requires_access_and_page_is_locked_down(tmp_path):
    path = tmp_path / 'index.json'
    path.write_text(json.dumps([index_record(1, 'Веер для новичков 1'), index_record(2, 'Веер для новичков 2')]))
    client = TestClient(create_wiki_app(WikiSettings(path, tmp_path / 'wiki.sqlite3', 'student', 'pw')))
    assert client.get('/api/wiki/graph').status_code == 401

    token = client.post('/api/wiki/login', json={'username': 'student', 'password': 'pw'}).json()['token']
    response = client.get('/api/wiki/graph', headers={'Authorization': 'Bearer ' + token})
    assert response.status_code == 200 and response.headers['cache-control'] == 'no-store'
    graph = response.json()
    assert len(edges(graph, 'series')) == 1 and 'example.com' not in response.text

    reader = client.get('/wiki')
    assert reader.status_code == 200 and 'catalog-search' not in reader.text
    assert 'local-wiki-prototype-qa' not in reader.text
    assert reader.headers['cache-control'] == 'no-store'
    assert client.get('/api/wiki/materials').status_code == 401
    first_id = next(n['id'] for n in graph['nodes'] if n['type'] == 'material')
    assert client.get('/api/wiki/materials/' + first_id).status_code == 401
    page = client.get('/wiki/graph')
    assert page.status_code == 200 and 'Веер' not in page.text  # the shell carries no catalog data
    assert "connect-src 'self'" in page.headers['content-security-policy']
    assert page.headers['x-robots-tag'] == 'noindex, nofollow'
    assert client.get('/wiki-graph-assets/graph.js').status_code == 200
    assert client.get('/wiki-graph-assets/index.html').status_code == 404
    assert client.get('/wiki-graph-assets/..%2Fwiki_graph.py').status_code == 404
