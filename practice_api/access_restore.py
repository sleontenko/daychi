"""Create a new restore candidate with the latest deletion ledger applied.

This never replaces the live database. The ledger must be independently saved
from the latest working database, not taken from the old backup being restored.
"""
from contextlib import closing
from pathlib import Path
import os
import sqlite3
import math
import time

from .access_requests import AccessRequests
from .access_deletion import erase_hashed
from .invitations import Invitations


def restore_candidate(backup, ledger, output, *, backup_created_at, now=None):
    now = time.time() if now is None else now
    # The operator supplies the verified original capture time, never a copy's
    # mtime. Older snapshots are unsafe once finite deletion proofs expire.
    if not math.isfinite(backup_created_at) or not 0 <= now - backup_created_at < 30 * 86400:
        raise ValueError('Only a verified backup captured less than 30 days ago may be restored')
    backup, ledger, output = (Path(value).resolve() for value in (backup, ledger, output))
    if not backup.is_file() or not ledger.is_file() or output in (backup, ledger) or backup == ledger:
        raise ValueError('A separate backup, latest ledger and new output are required')
    # Validate/read the latest ledger before creating any output.
    with closing(sqlite3.connect(ledger.as_uri() + '?mode=ro', uri=True)) as latest:
        latest.execute('BEGIN')
        tombstones = latest.execute('SELECT token_hash,created_at FROM deleted_credentials WHERE created_at>?', (now - 90 * 86400,)).fetchall()
        receipts = latest.execute('SELECT operation_hash,proof_hash,created_at FROM deletion_receipts WHERE created_at>?', (now - 90 * 86400,)).fetchall()
        hashes = [row[0] for row in tombstones]
    fd = os.open(output, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    os.close(fd)
    try:
        with closing(sqlite3.connect(backup.as_uri() + '?mode=ro', uri=True)) as source, closing(sqlite3.connect(output)) as target:
            source.backup(target)
        with closing(AccessRequests(Invitations(output)).db()) as con, con:
            con.execute('PRAGMA secure_delete=ON')
            con.execute('BEGIN IMMEDIATE')
            # The old snapshot's ledger cannot resurrect expired proofs or
            # extend their lifetime. The latest independent ledger replaces it.
            con.execute('DELETE FROM deleted_credentials')
            con.execute('DELETE FROM deletion_receipts')
            result = erase_hashed(con, hashes, now=now)
            con.executemany('INSERT OR REPLACE INTO deleted_credentials (token_hash,created_at) VALUES (?,?)', tombstones)
            con.executemany('INSERT INTO deletion_receipts (operation_hash,proof_hash,created_at) VALUES (?,?,?)', receipts)
            con.commit()
            # An older backup may contain free pages from deletions performed
            # before secure_delete was enabled. Rebuild the candidate file.
            con.execute('VACUUM')
            if con.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                raise ValueError('Restore integrity check failed')
        return result
    except BaseException:
        output.unlink(missing_ok=True)
        raise
