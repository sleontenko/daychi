#!/bin/sh
set -eu
umask 077
DAYCHI_PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
if [ -n "${DAYCHI_SERVICE_ENV:-}" ]; then
  . "$DAYCHI_SERVICE_ENV"
fi
: "${SCHEDULE_PRIVATE_DB:?Set SCHEDULE_PRIVATE_DB to the private database path}"
export SCHEDULE_PRIVATE_DB
cd "$DAYCHI_PROJECT_DIR"
exec .venv/bin/uvicorn practice_api.schedule_app:app --host 127.0.0.1 --port 8765 --no-access-log
