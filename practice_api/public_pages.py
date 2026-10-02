"""Public release pages, gated until their text and retention plan are approved."""
from pathlib import Path

from fastapi import HTTPException
from fastapi.responses import FileResponse

HEADERS = {
    'Content-Security-Policy': "default-src 'none'; style-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
}


def mount_public_pages(app, *, enabled):
    folder = Path(__file__).with_name('public_pages')

    @app.get('/privacy', include_in_schema=False)
    def privacy():
        if not enabled:
            raise HTTPException(404)
        return FileResponse(folder / 'privacy.html', headers=HEADERS)

    @app.get('/support', include_in_schema=False)
    def support():
        if not enabled:
            raise HTTPException(404)
        return FileResponse(folder / 'support.html', headers=HEADERS)

    @app.get('/public-page-assets/pages.css', include_in_schema=False)
    def stylesheet():
        if not enabled:
            raise HTTPException(404)
        return FileResponse(folder / 'pages.css', headers=HEADERS)
