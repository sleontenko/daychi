"""Loopback-only synthetic site/wiki QA; not a production provider or entry."""
import importlib.util
from pathlib import Path
from starlette.responses import FileResponse, HTMLResponse, JSONResponse
from practice_api.web_wiki_session import WebWikiBoundary, cabinet_web_session_check

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
spec=importlib.util.spec_from_file_location('site_fixture_reader',HERE/'web-session.py')
qa=importlib.util.module_from_spec(spec)
spec.loader.exec_module(qa)
REFERENCE=ROOT/'docs/qa-site-cabinet-links-2026-10-13/reference'

async def frontend(scope,receive,send):
    host=next((v.decode() for k,v in scope.get('headers',[]) if k==b'host'),'')
    reference=host.startswith('daychi-site-reference.')
    path=scope['path']
    if path=='/':
        html=(REFERENCE/'site-before.html' if reference else ROOT/'practice_api/website/index.html').read_text()
        if not reference:
            html=html.replace('https://app.xuanxue.su','http://daychi-site-qa.localhost:38915')
        return await HTMLResponse(html,headers={'Cache-Control':'no-store'})(scope,receive,send)
    if path.startswith('/website-assets/'):
        name=path.split('/')[-1]
        allowed={'site.css','site.js','graph-layout.mjs','golos-text.ttf','schedule-ios.png'}
        if name not in allowed: return await qa.api(scope,receive,send)
        file=REFERENCE/'site-before.js' if reference and name=='site.js' else ROOT/'practice_api/website'/name
        media='text/javascript' if name.endswith(('.js','.mjs')) else None
        return await FileResponse(file,media_type=media,headers={'Cache-Control':'no-store'})(scope,receive,send)
    if path=='/api/public/wiki/graph' and reference:
        return await JSONResponse(qa.DATA['graph'],headers={'Cache-Control':'no-store'})(scope,receive,send)
    if path in ('/support','/privacy'):
        return await FileResponse(ROOT/'practice_api/public_pages'/(path[1:]+'.html'))(scope,receive,send)
    return await qa.api(scope,receive,send)

protected=WebWikiBoundary(frontend,check=cabinet_web_session_check(transport=qa.httpx.MockTransport(qa.provider)))

async def app(scope,receive,send):
    if scope['type']!='http': return await protected(scope,receive,send)
    host=next((v.decode() for k,v in scope['headers'] if k==b'host'),'')
    if host.startswith('daychi-site-reference.') or scope['path'].startswith('/qa/'):
        return await frontend(scope,receive,send)
    canonical=host.startswith('daychi-site-wiki-qa.')
    scoped={**scope,'headers':[(k,v) for k,v in scope['headers'] if k!=b'host']+[(b'host',b'wiki.xuanxue.su' if canonical else b'app.xuanxue.su')]}
    async def fixture_send(message):
        if message['type']=='http.response.start':
            # Fixture browser follows the exact same path/query/fragment between
            # reserved loopback hosts. HTTP tests separately verify the real URL.
            message={**message,'headers':[(k,v.replace(b'https://wiki.xuanxue.su',b'http://daychi-site-wiki-qa.localhost:38915')) if k.lower()==b'location' else (k,v) for k,v in message.get('headers',[])]}
        await send(message)
    return await protected(scoped,receive,fixture_send)
