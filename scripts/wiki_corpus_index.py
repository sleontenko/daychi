"""Private, versioned Telegram resource index. Source databases/sessions are read-only.

Examples: import-history --source OLD_DB --output PRIVATE_DIR
          discover --env-file CONFIG --session SESSION --output PRIVATE_DIR
          sync --env-file CONFIG --session SESSION --chats PRIVATE_JSON --output DIR
"""
from __future__ import annotations

import argparse
import asyncio
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import sqlite3
from urllib.parse import parse_qs, urlsplit, urlunsplit


def utcnow():
    return datetime.now(timezone.utc).isoformat()


def classify(url):
    """Return provider, persistent key, normalized URL; do not trust substring hosts."""
    url = url.strip().rstrip('.,;!)]}>')
    try:
        p = urlsplit(url)
        host = (p.hostname or '').lower()
        query = parse_qs(p.query)
    except ValueError:
        return None
    if p.scheme not in ('http', 'https') or not host:
        return None
    if host in ('youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtu.be'):
        parts = p.path.strip('/').split('/')
        video = (parts[0] if host.endswith('youtu.be') else
                 query.get('v', [''])[0] if p.path == '/watch' else
                 parts[1] if len(parts) > 1 and parts[0] in ('shorts', 'live', 'embed') else '')
        if re.fullmatch(r'[A-Za-z0-9_-]{11}', video):
            return ('youtube', 'youtube:' + video, 'https://www.youtube.com/watch?v=' + video)
        playlist = query.get('list', [''])[0]
        if playlist:
            return ('youtube_container', 'youtube_playlist:' + playlist,
                    'https://www.youtube.com/playlist?list=' + playlist)
    if host in ('drive.google.com', 'docs.google.com'):
        m = re.search(r'/(?:file/)?d/([A-Za-z0-9_-]+)', p.path)
        folder = re.search(r'/folders/([A-Za-z0-9_-]+)', p.path)
        file_id = m[1] if m else query.get('id', [''])[0]
        if folder:
            return ('drive_container', 'drive_folder:' + folder[1],
                    'https://drive.google.com/drive/folders/' + folder[1])
        if file_id:
            return ('drive', 'drive:' + file_id, 'https://drive.google.com/file/d/' + file_id)
    normalized = urlunsplit((p.scheme.lower(), p.netloc.lower(), p.path, p.query, p.fragment))
    provider = 'zoom' if host == 'zoom.us' or host.endswith('.zoom.us') else 'other'
    return (provider, provider + ':' + hashlib.sha256(normalized.encode()).hexdigest(), normalized)


def resource_links(message):
    text = message.get('message') or message.get('text') or ''
    urls = re.findall(r'https?://[^\s<>]+', text)
    encoded = text.encode('utf-16-le')
    for entity in message.get('entities') or []:
        if entity.get('url'):
            urls.append(entity['url'])
        elif entity.get('_') == 'MessageEntityUrl':
            start = int(entity['offset']) * 2
            end = start + int(entity['length']) * 2
            urls.append(encoded[start:end].decode('utf-16-le', errors='replace'))
    result = {}
    for url in urls:
        item = classify(url)
        if item:
            result[(item[1], url)] = (*item, url)
    return list(result.values())


class Index:
    def __init__(self, path):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.c = sqlite3.connect(path)
        self.c.executescript('''
          PRAGMA foreign_keys=ON;
          CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY, origin TEXT, started TEXT, completed TEXT);
          CREATE TABLE IF NOT EXISTS coverage(run TEXT, chat INTEGER, oldest INTEGER,
            count INTEGER DEFAULT 0, complete INTEGER DEFAULT 0, PRIMARY KEY(run,chat));
          CREATE TABLE IF NOT EXISTS messages(run TEXT, chat INTEGER, msg INTEGER,
            date TEXT, edited TEXT, topic INTEGER, raw TEXT, PRIMARY KEY(run,chat,msg));
          CREATE TABLE IF NOT EXISTS resources(id TEXT PRIMARY KEY, provider TEXT, locator TEXT);
          CREATE TABLE IF NOT EXISTS occurrences(run TEXT, chat INTEGER, msg INTEGER,
            resource TEXT REFERENCES resources(id), raw_url TEXT,
            PRIMARY KEY(run,chat,msg,resource,raw_url));
        ''')

    def begin(self, run, origin):
        self.c.execute('INSERT OR IGNORE INTO runs VALUES(?,?,?,NULL)', (run, origin, utcnow()))
        self.c.commit()

    def add(self, run, chat, message):
        mid = int(message['id'])
        reply = message.get('reply_to') or {}
        topic = reply.get('reply_to_top_id') or (reply.get('reply_to_msg_id') if reply.get('forum_topic') else None)
        self.c.execute('INSERT OR REPLACE INTO messages VALUES(?,?,?,?,?,?,?)',
                       (run, chat, mid, str(message.get('date') or ''),
                        str(message.get('edit_date') or ''), topic,
                        json.dumps(message, ensure_ascii=False, default=str)))
        self.c.execute('DELETE FROM occurrences WHERE run=? AND chat=? AND msg=?', (run, chat, mid))
        links = resource_links(message)
        doc = (message.get('media') or {}).get('document') or {}
        if doc.get('id') and (doc.get('mime_type') or '').startswith(('audio/', 'video/')):
            links.append(('telegram_media', 'telegram_document:' + str(doc['id']), '', ''))
        for provider, key, locator, original in links:
            self.c.execute('INSERT OR IGNORE INTO resources VALUES(?,?,?)', (key, provider, locator))
            self.c.execute('INSERT OR IGNORE INTO occurrences VALUES(?,?,?,?,?)',
                           (run, chat, mid, key, original))

    def report(self, run):
        return {'run': run, 'origin': self.c.execute('SELECT origin FROM runs WHERE id=?',(run,)).fetchone()[0],
                'messages': self.c.execute('SELECT count(*) FROM messages WHERE run=?',(run,)).fetchone()[0],
                'unique_resources_by_provider': dict(self.c.execute('''SELECT r.provider,count(DISTINCT r.id)
                 FROM resources r JOIN occurrences o ON r.id=o.resource WHERE o.run=? GROUP BY r.provider''',(run,))),
                'occurrences': self.c.execute('SELECT count(*) FROM occurrences WHERE run=?',(run,)).fetchone()[0],
                'coverage': [dict(zip(['chat_id','oldest_id','messages','complete'],r)) for r in self.c.execute(
                    'SELECT chat,oldest,count,complete FROM coverage WHERE run=?',(run,))]}


def save(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    temp.replace(path)


def import_history(args):
    root = Path(args.output)
    index = Index(root/'registry.db')
    index.begin(args.run, 'historical_database_not_fresh_telegram_sync')
    old = sqlite3.connect(Path(args.source).resolve().as_uri() + '?mode=ro', uri=True)
    for chat, mid, date, text, raw in old.execute('SELECT channel_id,msg_id,date,text,raw_json FROM messages'):
        message = json.loads(raw) if raw else {'id': mid, 'date': date, 'message': text}
        index.add(args.run, chat, message)
    index.c.commit()
    chats = [r[0] for r in old.execute('SELECT DISTINCT channel_id FROM messages')]
    for chat, oldest, count in old.execute('SELECT channel_id,min(msg_id),count(*) FROM messages GROUP BY channel_id'):
        index.c.execute('INSERT OR REPLACE INTO coverage VALUES(?,?,?,?,0)', (args.run,chat,oldest,count))
    index.c.commit()
    # Candidate list only: online sync requires an explicit --chats argument.
    save(root/'historical-chat-candidates.json', {'chat_ids': chats, 'selection': 'old_school_corpus'})
    report = index.report(args.run)
    report['source_sync_dates'] = [r[0] for r in old.execute('SELECT last_run_at FROM sync_state')]
    report['coverage_note'] = 'Historical import only; no current Telegram history coverage confirmed.'
    save(root/'historical-report.json', report)
    if args.catalog:
        cards = json.loads(Path(args.catalog).read_text())
        active = {r[0] for r in index.c.execute('SELECT DISTINCT resource FROM occurrences WHERE run=?',(args.run,))}
        mappings = []
        for card in cards:
            keys = sorted({item[1] for link in card.get('links', [])
                           if (item := classify(link['url'])) and item[0] in ('youtube','drive','telegram_media')})
            mappings.append({'material_id':card['id'], 'resource_ids':keys,
                             'in_historical_telegram':[k for k in keys if k in active]})
        save(root/'catalog-crosswalk.json', {'source_catalog_sha256':hashlib.sha256(Path(args.catalog).read_bytes()).hexdigest(),
            'snapshot_run':args.run, 'cards':len(cards),
            'matched_cards':sum(bool(m['in_historical_telegram']) for m in mappings),
            'matched_resources':len({k for m in mappings for k in m['in_historical_telegram']}),
            'mappings':mappings, 'scope':'exact IDs only; does not modify app catalog'})
    old.close()
    index.c.close()
    print(json.dumps({k:v for k,v in report.items() if k!='coverage'}))


async def client_for(args):
    import os
    from dotenv import load_dotenv
    from telethon import TelegramClient
    from telethon.sessions import MemorySession
    from telethon.crypto import AuthKey
    if args.env_file:
        load_dotenv(args.env_file, override=False)
    if not os.environ.get('TELEGRAM_API_ID') or not os.environ.get('TELEGRAM_API_HASH'):
        raise SystemExit('Missing Telegram API configuration; no login attempted.')
    path = Path(args.session)
    if not path.is_file():
        raise SystemExit('Missing authorized Telegram SQLite session; no login attempted.')
    db = sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True)
    row = db.execute('SELECT dc_id,server_address,port,auth_key FROM sessions LIMIT 1').fetchone()
    db.close()
    if not row or not row[3]:
        raise SystemExit('No auth key in provided session.')
    session = MemorySession()
    session.set_dc(row[0], row[1], row[2])
    session.auth_key = AuthKey(row[3])
    client = TelegramClient(session, int(os.environ['TELEGRAM_API_ID']), os.environ['TELEGRAM_API_HASH'],
                            flood_sleep_threshold=60, request_retries=3, connection_retries=3)
    await client.connect()
    if not await client.is_user_authorized():
        await client.disconnect()
        raise SystemExit('Existing Telegram session is not authorized; no login attempted.')
    return client


async def online(args):
    from telethon.errors import FloodWaitError
    from telethon.tl.types import Channel, Chat
    root = Path(args.output)
    client = await client_for(args)
    try:
        dialogs = [d async for d in client.iter_dialogs()]
        groups = [d for d in dialogs if isinstance(d.entity, (Channel, Chat))]
        save(root/'available-group-dialogs.json', {'checked_at': utcnow(), 'dialogs': [
            {'id': d.id, 'title': d.name, 'forum': bool(getattr(d.entity,'forum',False)),
             'archived': d.archived} for d in groups]})
        print(json.dumps({'group_dialogs':len(groups), 'action':args.command}), flush=True)
        if args.command == 'discover':
            return
        selected = set(json.loads(Path(args.chats).read_text())['chat_ids'])
        # Positive IDs in the historical schema were bare channel IDs.
        by_id = {d.id:d for d in groups}
        by_id.update({d.entity.id:d for d in groups if isinstance(d.entity, Channel)})
        missing = selected - by_id.keys()
        if missing:
            save(root/'unavailable-chats.json', {'chat_ids':sorted(missing)})
            raise SystemExit('Selected chats missing from accessible dialogs; inspect private report.')
        selected = {by_id[chat].id for chat in selected}
        index = Index(root/'registry.db')
        index.begin(args.run, 'telegram_live_history')
        for number, chat in enumerate(sorted(selected),1):
            row = index.c.execute('SELECT oldest,count,complete FROM coverage WHERE run=? AND chat=?',
                                  (args.run,chat)).fetchone()
            if row and row[2]:
                continue
            cursor, count = (row[0] or 0, row[1]) if row else (0,0)
            while True:
                try:
                    async for message in client.iter_messages(by_id[chat].entity, offset_id=cursor, limit=None, wait_time=1):
                        index.add(args.run, chat, message.to_dict())
                        cursor, count = message.id, count+1
                        index.c.execute('INSERT OR REPLACE INTO coverage VALUES(?,?,?,?,0)',
                                        (args.run, chat, cursor, count))
                        if count % 100 == 0:
                            index.c.commit()
                            print(json.dumps({'chat_number':number, 'messages':count}), flush=True)
                    index.c.execute('INSERT OR REPLACE INTO coverage VALUES(?,?,?,?,1)',
                                    (args.run, chat, cursor, count))
                    index.c.commit()
                    break
                except FloodWaitError as e:
                    index.c.commit()
                    print(json.dumps({'flood_wait_seconds':e.seconds}), flush=True)
                    await asyncio.sleep(e.seconds+1)
            save(root/'live-report.json', index.report(args.run))
        index.c.execute('UPDATE runs SET completed=? WHERE id=?',(utcnow(),args.run))
        index.c.commit()
        save(root/'live-report.json', index.report(args.run))
        index.c.close()
    finally:
        await client.disconnect()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['import-history','discover','sync'])
    parser.add_argument('--output',required=True)
    parser.add_argument('--run',default=datetime.now(timezone.utc).strftime('%Y-%m-%dT%H%M%SZ'))
    parser.add_argument('--source')
    parser.add_argument('--catalog')
    parser.add_argument('--env-file')
    parser.add_argument('--session')
    parser.add_argument('--chats')
    args = parser.parse_args()
    if args.command == 'import-history':
        if not args.source: parser.error('--source is required')
        import_history(args)
    else:
        if not args.session: parser.error('--session is required')
        if args.command == 'sync' and not args.chats: parser.error('--chats is required')
        asyncio.run(online(args))
