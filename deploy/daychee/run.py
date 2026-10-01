"""Single-worker service. Private files live only on the mounted volume."""
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
import uvicorn

os.umask(0o077)
folder = Path('/data/daychee')
folder.mkdir(mode=0o700, parents=True, exist_ok=True)
if os.getuid() == 0:
    os.chown(folder, 10001, 10001)
    os.setgroups([])
    os.setgid(10001)
    os.setuid(10001)

if __name__ == '__main__':
    # One rollback snapshot before the additive admin schema is first used.
    # This volume-local copy is not an independent disaster-recovery backup.
    access = Path(os.getenv('DAYCHEE_ACCESS_DATABASE', folder / 'access.sqlite3'))
    marker = folder / 'backup-before-admin.complete'
    if access.exists() and not marker.exists():
        backups = folder / 'backups'
        backups.mkdir(mode=0o700, exist_ok=True)
        target = backups / ('access-before-admin-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '.sqlite3')
        with sqlite3.connect(access) as source, sqlite3.connect(target) as destination:
            source.backup(destination)
            if destination.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                raise RuntimeError('Access backup integrity check failed')
        os.chmod(target, 0o600)
        marker.write_text(target.name + '\n')
    # Snapshot existing access/session state before the requests schema is first used.
    request_marker = folder / 'backup-before-access-requests.complete'
    if os.getenv('DAYCHEE_ACCESS_REQUESTS_ENABLED') == '1' and access.exists() and not request_marker.exists():
        backups = folder / 'backups'
        backups.mkdir(mode=0o700, exist_ok=True)
        target = backups / ('access-before-requests-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '.sqlite3')
        with sqlite3.connect(access) as source, sqlite3.connect(target) as destination:
            source.backup(destination)
            if destination.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                raise RuntimeError('Access requests backup integrity check failed')
        os.chmod(target, 0o600)
        request_marker.write_text(target.name + '\n')
    # IP trust is handled explicitly by the application, not uvicorn defaults.
    uvicorn.run('practice_api.daychee_app:app', host='0.0.0.0', port=int(os.getenv('PORT', '8080')),
                workers=1, access_log=False, proxy_headers=False)
