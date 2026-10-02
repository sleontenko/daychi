"""Standalone public-read schedule API. Never mounts the private corpus API."""

import os
import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware

from practice_api.schedule_source import (
    SCHOOL_TIMEZONE, SOURCE_URL, ScheduleSource, ScheduleSourceError,
)
from practice_api.reminder_routes import reminder_router
from practice_api.reminder_store import ReminderStore


def create_app(source=None, store=None):
    source = source or ScheduleSource()
    @asynccontextmanager
    async def lifespan(app):
        task = None
        transport = None
        if store is not None and os.environ.get("APNS_KEY_PATH"):
            from practice_api.apns import APNs
            from practice_api.reminder_worker import dispatch
            transport = APNs(Path(os.environ["APNS_KEY_PATH"]),
                             os.environ["APNS_KEY_ID"], os.environ["APNS_TEAM_ID"])
            async def loop():
                while True:
                    try:
                        await asyncio.to_thread(dispatch, store, source, transport)
                    except Exception:
                        # Never put device tokens/request URLs into shared logs.
                        logging.getLogger(__name__).error("Reminder dispatch failed")
                    await asyncio.sleep(15)
            task = asyncio.create_task(loop())
        yield
        if task:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        if transport:
            transport.close()
    app = FastAPI(title="Daychi Schedule", version="0.1.0", lifespan=lifespan)
    app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET"])
    # Private routes are opt-in; they use a distinct DB and device bearer auth.
    if store is not None:
        app.include_router(reminder_router(store))

    @app.get("/health")
    def health():
        return {"status": "ok"}

    @app.get("/api/v1/schedule")
    def schedule(response: Response):
        response.headers["Cache-Control"] = "no-store"
        try:
            data = source.get().model_dump(mode="json")
        except ScheduleSourceError as exc:
            raise HTTPException(status_code=503, detail="Не удалось проверить расписание школы") from exc
        return {**data, "source_url": SOURCE_URL, "timezone": SCHOOL_TIMEZONE,
                "kind": "weekly_template", "exceptions_verified": False}

    return app


private_path = os.environ.get("SCHEDULE_PRIVATE_DB")
app = create_app(store=ReminderStore(Path(private_path)) if private_path else None)
