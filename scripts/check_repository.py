"""Check Git files for private artifacts and recognizable credentials.

Use --staged before committing. Reports paths/rules only, never matched secrets.
This is a guardrail, not an audit of images or arbitrary corpus content.
"""
import argparse
import io
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import zipfile


ROOT = Path(__file__).resolve().parents[1]
PRIVATE_SUFFIXES = (
    '.sqlite', '.sqlite3', '.db', '.p8', '.p12', '.pem', '.key',
    '.mobileprovision', '.keystore', '.jks', '.ipa', '.apk', '.aab',
    '.mp3', '.m4a', '.mp4', '.wav', '.session',
)
PATTERNS = {
    'GitHub credential': re.compile(rb'\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b'),
    'provider credential': re.compile(rb'\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{20,}|AKIA[A-Z0-9]{16})\b'),
    'Telegram bot credential': re.compile(rb'\b\d{8,12}:[A-Za-z0-9_-]{32,}\b'),
    'private key': re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
}
ZOOM = re.compile(rb'https?://[^\s<>"\x27]*zoom\.us/j/')


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)


def private_path(name):
    path = PurePosixPath(name)
    if any(p in {'data', 'node_modules', '.venv', '__pycache__', '.expo'} for p in path.parts):
        return True
    if name.startswith(('knowledge/raw/', 'apps/practice-app/src/features/wiki/generated/',
                        'apps/practice-app/src/features/schedule/generated/')):
        return True
    if path.name.startswith('.env') and path.name != '.env.example':
        return True
    return any(part.endswith(('.xcarchive', '.sqlite-wal', '.sqlite-shm')) for part in path.parts) or path.name.endswith(PRIVATE_SUFFIXES)


def scan(name, data):
    issues = [(name, 'private artifact')] if private_path(name) else []
    # Synthetic Zoom URLs in existing tests are fixtures, not meeting credentials.
    if not name.startswith(('tests/', 'apps/practice-app/scripts/')) and ZOOM.search(data):
        issues.append((name, 'Zoom meeting URL'))
    issues.extend((name, rule) for rule, pattern in PATTERNS.items() if pattern.search(data))
    return issues


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--staged', action='store_true', help='Read the Git index, not the working tree')
    args = parser.parse_args()
    names = [p.decode('utf-8') for p in git('ls-files', '-z').split(b'\0') if p]
    issues = []
    for name in names:
        path = ROOT / name
        if args.staged:
            data = git('show', ':' + name)
        elif path.is_file():
            data = path.read_bytes()
        else:
            continue
        issues.extend(scan(name, data))
        if name.endswith('.zip'):
            try:
                with zipfile.ZipFile(io.BytesIO(data)) as archive:
                    for entry in archive.infolist():
                        if entry.is_dir():
                            continue
                        issues.extend((name + '::' + entry.filename, rule)
                                      for _, rule in scan(entry.filename, archive.read(entry)))
            except zipfile.BadZipFile:
                issues.append((name, 'invalid ZIP archive'))
    for name, rule in issues:
        print(f'{name}: {rule}')
    if issues:
        print(f'FAIL: {len(issues)} findings; review before sharing.')
        return 1
    print(f'PASS: {len(names)} Git files checked; no recognized private artifacts/credentials.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
