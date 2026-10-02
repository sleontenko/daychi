#!/usr/bin/env python3
"""Local owner-only administration; never expose this CLI as an HTTP endpoint."""
import argparse
import json
import sys
import time
from pathlib import Path
from urllib.parse import urlsplit
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from practice_api.invitations import Invitations

parser = argparse.ArgumentParser()
parser.add_argument('--database', required=True)
parser.add_argument('action', choices=['issue', 'revoke', 'list', 'summary'])
parser.add_argument('--id')
parser.add_argument('--label', default='', help='Optional owner label, up to 80 characters')
parser.add_argument('--base-url', help='Public HTTPS service URL, e.g. the deployed Railway origin')
args = parser.parse_args()
store = Invitations(args.database)
if args.action == 'issue':
    base = args.base_url.rstrip('/') if args.base_url else None
    if base:
        parsed = urlsplit(base)
        if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
            parser.error('--base-url must be a public HTTPS URL without credentials, query or fragment')
    try:
        identity, token = store.issue_code(args.label)
    except ValueError as error:
        parser.error(str(error))
    print('Access ID:', identity)
    print('Code:', '-'.join(token[i:i+4] for i in range(0, 12, 4)))
    if base: print('Invitation:', base + '/invite#' + token)
    print('Expires in 7 days. One use, one phone.')
elif args.action == 'revoke':
    if not args.id: parser.error('--id is required for revoke')
    print('Revoked' if store.revoke(args.id) else 'Not found')
elif args.action == 'list':
    print(json.dumps(store.inventory(), ensure_ascii=False, indent=2))
else:
    now = time.time()
    print(json.dumps({'period_days': 30, **store.summary(since=now - 30 * 86400, now=now)}, ensure_ascii=False, indent=2))
