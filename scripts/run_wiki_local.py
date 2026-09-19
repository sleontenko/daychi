"""Start the private wiki on loopback using ignored local configuration."""
import json
import os
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import uvicorn

configuration = Path('data/wiki-local.json')
if configuration.exists():
    for key, value in json.loads(configuration.read_text()).items():
        os.environ.setdefault(key, str(value))
uvicorn.run('practice_api.wiki_app:app', host='127.0.0.1', port=8766, access_log=False)
