#!/usr/bin/env python3
"""Create a new allowlisted source tree for railway up; never copy private data."""
import argparse
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
FILES = (
    'deploy/daychee/Dockerfile', 'deploy/daychee/requirements.txt',
    'deploy/daychee/run.py', 'practice_api/__init__.py',
    'practice_api/daychee_app.py', 'practice_api/wiki_app.py',
    'practice_api/wiki_content.py',
    'practice_api/wiki_graph.py', 'practice_api/wiki_graph_web/index.html',
    'practice_api/wiki_graph_web/graph.js', 'practice_api/wiki_graph_web/graph.css',
    'practice_api/feedback.py', 'practice_api/admin.py', 'practice_api/admin_web/index.html',
    'practice_api/access_requests.py', 'practice_api/access_request_api.py',
    'practice_api/access_request_notifications.py',
    'practice_api/admin_web/admin.css', 'practice_api/admin_web/admin.js',
    'practice_api/invitations.py', 'practice_api/schedule_source.py',
    'practice_api/schedule.py', 'scripts/daychee-invite.py',
    'practice_api/invitation_web/index.html',
    'practice_api/invitation_web/invitation.js',
    'practice_api/invitation_web/invitation.css',
    'practice_api/website/index.html',
    'practice_api/website/caprasimo-OFL.txt', 'practice_api/website/figtree-OFL.txt',
    'practice_api/website/site.css', 'practice_api/website/site.js',
    'practice_api/website/font-0.ttf', 'practice_api/website/font-1.ttf',
    'practice_api/website/font-2.ttf', 'practice_api/website/font-3.ttf',
    'practice_api/website/schedule-ios.png',
    'practice_api/website/apple.svg', 'practice_api/website/android.svg',
    'practice_api/website/simple-icons-LICENSE.md',
    'practice_api/downloads/daychee-android.apk',
)


def stage(destination):
    destination = Path(destination)
    destination.mkdir(mode=0o700, parents=True, exist_ok=False)
    for relative in FILES:
        source = ROOT / relative
        if source.is_symlink():
            raise ValueError(f'Refusing symlink: {relative}')
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
    shutil.copyfile(ROOT / 'deploy/daychee/railway.json', destination / 'railway.json')
    shutil.copyfile(ROOT / 'deploy/daychee/Dockerfile', destination / 'Dockerfile')
    shutil.copyfile(ROOT / 'deploy/daychee/dockerignore', destination / '.dockerignore')
    return destination


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('destination', help='New directory; existing paths are refused')
    args = parser.parse_args()
    output = stage(args.destination)
    print(f'Prepared {len(FILES) + 3} source/config files in {output}')
