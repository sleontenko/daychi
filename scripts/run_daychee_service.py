"""Run the invitation-protected API with private server configuration."""
import argparse
import json
import os
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import uvicorn

parser = argparse.ArgumentParser()
parser.add_argument('--config', type=Path, required=True)
parser.add_argument('--port', type=int, default=8768)
args = parser.parse_args()
os.umask(0o077)
config = json.loads(args.config.read_text())
for key in ('WIKI_INDEX', 'WIKI_DATABASE', 'DAYCHEE_ACCESS_DATABASE', 'DAYCHEE_ZOOM'):
    value = Path(config[key])
    if not value.is_absolute():
        raise ValueError(f'{key} must be an absolute path')
    if key != 'DAYCHEE_ACCESS_DATABASE' and not value.is_file():
        raise ValueError(f'{key} must refer to an existing file')
    os.environ[key] = str(value)
uvicorn.run('practice_api.daychee_app:app', host='127.0.0.1', port=args.port,
            access_log=False, proxy_headers=True, forwarded_allow_ips='127.0.0.1')
