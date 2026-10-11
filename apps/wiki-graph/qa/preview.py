"""Local synthetic content v1 preview. No production data, writes or imports."""
import argparse
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
ROOT = Path(__file__).resolve().parents[3]
FIXTURE = json.loads(Path(__file__).with_name('content-v1.json').read_text())
ARTICLES = json.loads(Path(__file__).with_name('articles-v1.json').read_text())
class Handler(BaseHTTPRequestHandler):
    def reply(self, status, body, kind='application/json'):
        payload = body if isinstance(body, bytes) else json.dumps(body,ensure_ascii=False).encode()
        self.send_response(status); self.send_header('Content-Type',kind); self.send_header('Cache-Control','no-store'); self.end_headers(); self.wfile.write(payload)
    def do_POST(self):
        self.reply(200, {'token':'synthetic-preview-only'})
    def do_GET(self):
        p = urlparse(self.path)
        if p.path == '/api/wiki/graph':
            if self.server.state == 'error': return self.reply(503, {'error':'synthetic unavailable'})
            if self.server.state == 'loading':
                import time
                time.sleep(2)
            return self.reply(200, FIXTURE['empty_graph'] if self.server.state == 'empty' else ARTICLES['graph'])
        if p.path.startswith('/api/wiki/articles/'):
            if self.server.state == 'article-error': return self.reply(503, {'error':'synthetic article error'})
            if self.server.state == 'article-absent': return self.reply(404, {})
            if self.server.state == 'article-loading':
                import time
                time.sleep(2)
            group = 'concepts' if '/concepts/' in p.path else 'articles'
            value=ARTICLES[group].get(p.path.split('/')[-1])
            return self.reply(200 if value else 404,value or {})
        if p.path.startswith('/api/wiki/materials/'):
            if self.server.state == 'detail-error': return self.reply(503, {'error':'synthetic detail error'})
            record=next((r for r in ARTICLES['materials'] if r['id']==p.path.split('/')[-1]),None)
            return self.reply(200 if record else 404,record or {})
        if p.path == '/qa/state':
            from urllib.parse import parse_qs
            self.server.state=parse_qs(p.query).get('value',['normal'])[0]
            return self.reply(200,{'state':self.server.state})
        if p.path in ('/wiki','/wiki/graph','/'):
            return self.reply(200,(ROOT/'practice_api/wiki_graph_web/index.html').read_bytes(),'text/html; charset=utf-8')
        if p.path.startswith('/wiki-graph-assets/') and p.path.split('/')[-1] in ('graph.css','graph.js'):
            path=ROOT/'practice_api/wiki_graph_web'/p.path.split('/')[-1]
            return self.reply(200,path.read_bytes(),'text/css' if path.suffix=='.css' else 'text/javascript')
        return self.reply(404,{})
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=8897);args=parser.parse_args()
    server=ThreadingHTTPServer(('127.0.0.1',args.port),Handler);server.state='normal'
    print(f'Synthetic wiki preview: http://127.0.0.1:{args.port}/wiki',flush=True);server.serve_forever()
