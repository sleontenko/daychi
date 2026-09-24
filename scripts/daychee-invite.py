#!/usr/bin/env python3
"""Local owner-only administration; never expose this CLI as an HTTP endpoint."""
import argparse
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from practice_api.invitations import Invitations

parser = argparse.ArgumentParser()
parser.add_argument('--database', required=True)
parser.add_argument('action', choices=['issue', 'revoke'])
parser.add_argument('--id')
args = parser.parse_args()
store = Invitations(args.database)
if args.action == 'issue':
    identity, token = store.issue()
    print('Access ID:', identity)
    print('quietpractice://invite#' + token)
else:
    if not args.id: parser.error('--id is required for revoke')
    print('Revoked' if store.revoke(args.id) else 'Not found')
