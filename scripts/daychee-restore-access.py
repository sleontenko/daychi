#!/usr/bin/env python3
"""Offline restore candidate; never overwrites or deploys a database."""
import argparse
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from practice_api.access_restore import restore_candidate

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--backup', required=True)
parser.add_argument('--latest-ledger', required=True)
parser.add_argument('--output', required=True)
parser.add_argument('--backup-created-at', type=float, required=True,
                    help='Verified original backup capture time, Unix UTC seconds (not copy mtime)')
args = parser.parse_args()
print(json.dumps(restore_candidate(args.backup, args.latest_ledger, args.output,
                                   backup_created_at=args.backup_created_at)))
