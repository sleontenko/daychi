"""Run the isolated wiki with a private server-side JSON configuration."""
import argparse
import json
import os
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import uvicorn

parser = argparse.ArgumentParser()
parser.add_argument('--config', type=Path, required=True)
parser.add_argument('--port', type=int, default=8767)
args = parser.parse_args()
os.umask(0o077)
for key, value in json.loads(args.config.read_text()).items():
    if key.startswith('WIKI_'):
        os.environ[key] = str(value)
uvicorn.run('practice_api.wiki_app:app', host='127.0.0.1', port=args.port,
            access_log=False, proxy_headers=True, forwarded_allow_ips='127.0.0.1')
