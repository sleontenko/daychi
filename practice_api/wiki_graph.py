"""Graph view of the private wiki catalog: deterministic links only.

Edges come from the catalog structure (category -> subtopic -> material) and from
series numbering in titles («Веер для новичков 39» -> «… 40»). No semantic guessing;
Only reviewed, source-current glossary/topic relations may extend this payload.
"""
from collections import defaultdict
from pathlib import Path
import re

from fastapi import Depends, HTTPException
from fastapi.responses import FileResponse

SERIES = re.compile(r'^(.*?\D)\s*(\d{1,3})\s*$')
ASSETS = ('graph.js', 'graph.css')
PAGE_HEADERS = {
    'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; font-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, nofollow',
}


def build_graph(rows, content=None, semantic=None):
    sections, subtopics, nodes, edges = {}, {}, [], []
    for row in rows:
        category = row['category']
        section = sections.setdefault(category, {'id': 'c:' + category, 'type': 'section', 'sec': category,
                                                 'label': row['category_name'], 'count': 0})
        section['count'] += 1
        parent = section['id']
        if row['subtopic_key']:
            sub_id = f"s:{category}:{row['subtopic_key']}"
            sub = subtopics.setdefault(sub_id, {'id': sub_id, 'type': 'subtopic', 'sec': category,
                                                'label': row['subtopic'], 'count': 0})
            sub['count'] += 1
            parent = sub_id
        nodes.append({'id': row['id'], 'type': 'material', 'sec': category, 'label': row['title'],
                      'sub': row['subtopic'], 'date': row['date'], 'ts': row['timestamp'],
                      'media': next((l['type'] for l in row['links'] if l['type'] != 'zoom'), None)})
        edges.append({'s': row['id'], 't': parent, 'k': 'structure'})
    for sub in subtopics.values():
        edges.append({'s': sub['id'], 't': 'c:' + sub['sec'], 'k': 'structure'})

    series = defaultdict(list)
    for node in nodes:
        match = SERIES.match(node['label'])
        if match and len(match[1].strip()) >= 4:
            key = (node['sec'], match[1].strip().rstrip('-–—:.,').casefold())
            series[key].append((int(match[2]), node['id']))
    for items in series.values():
        items.sort()
        for (a_number, a), (b_number, b) in zip(items, items[1:]):
            if b_number - a_number == 1:
                edges.append({'s': a, 't': b, 'k': 'series'})

    ordered = list(sections.values())
    result = {'sections': [{'id': s['sec'], 'name': s['label'], 'count': s['count']} for s in ordered],
            'nodes': ordered + list(subtopics.values()) + nodes, 'edges': edges}
    if semantic and semantic.enabled:
        layer = semantic.graph(rows)
        result['nodes'].extend(layer['nodes'])
        result['edges'].extend(layer['edges'])
        result['semantic_enabled'] = True
    return result


def mount_wiki_graph(app, load, authorize):
    folder = Path(__file__).with_name('wiki_graph_web')

    @app.get('/wiki', include_in_schema=False)
    @app.get('/wiki/graph', include_in_schema=False)
    def graph_page():
        return FileResponse(folder / 'index.html', headers=PAGE_HEADERS)

    @app.get('/wiki-graph-assets/{name}', include_in_schema=False)
    def graph_asset(name: str):
        if name not in ASSETS:
            raise HTTPException(404)
        return FileResponse(folder / name, headers=PAGE_HEADERS)

    @app.get('/api/wiki/graph', dependencies=[Depends(authorize)])
    def graph():
        return build_graph(load(), semantic=app.state.wiki_semantics)
