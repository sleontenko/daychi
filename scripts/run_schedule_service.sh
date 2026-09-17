#!/bin/sh
set -eu
umask 077
cd /Users/mac-mini-server/projects/quiet-practice-release
export SCHEDULE_PRIVATE_DB=/Users/mac-mini-server/.config/quiet-practice/devices.sqlite3
export APNS_KEY_PATH=/Users/mac-mini-server/.config/quiet-practice/AuthKey_429DFGG3ZP.p8
export APNS_KEY_ID=429DFGG3ZP
export APNS_TEAM_ID=92HWGZCSS4
exec .venv/bin/uvicorn practice_api.schedule_app:app --host 127.0.0.1 --port 8765 --no-access-log
