"""Authenticated device enrollment/preferences; never exposes APNs tokens."""

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field, model_validator

from practice_api.reminder_store import ReminderStore
from practice_api.schedule import AttendanceChoice


class PairRequest(BaseModel):
    code: str = Field(min_length=20, max_length=100)


class PushSettings(BaseModel):
    token: str | None = Field(default=None, pattern=r"^[0-9a-fA-F]{32,512}$")
    enabled: bool

    @model_validator(mode="after")
    def validate_enabled(self):
        if self.enabled and not self.token:
            raise ValueError("Push token required when enabling reminders")
        return self


class ChoicesRequest(BaseModel):
    choices: list[AttendanceChoice] = Field(max_length=100)


def reminder_router(store: ReminderStore) -> APIRouter:
    router = APIRouter(prefix="/api/v1/device")
    bearer = HTTPBearer(auto_error=False)

    def authenticate(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
        if not credentials or len(credentials.credentials) > 128:
            raise HTTPException(status_code=401, detail="Device authentication required")
        device_id = store.authenticate(credentials.credentials)
        if not device_id:
            raise HTTPException(status_code=401, detail="Device authentication required")
        return device_id

    @router.post("/pair")
    def pair(body: PairRequest, response: Response):
        response.headers["Cache-Control"] = "no-store"
        token = store.pair(body.code)
        if not token:
            raise HTTPException(status_code=401, detail="Invalid or expired pairing code")
        return {"token": token}

    @router.get("/choices")
    def choices(response: Response, device_id: str = Depends(authenticate)):
        response.headers["Cache-Control"] = "no-store"
        return {"choices": store.get_choices(device_id)}

    @router.put("/choices")
    def update_choices(body: ChoicesRequest, device_id: str = Depends(authenticate)):
        store.set_choices(device_id, body.choices)
        return {"saved": True}

    @router.put("/push")
    def push(body: PushSettings, device_id: str = Depends(authenticate)):
        store.set_push(device_id, body.token.lower() if body.token else None, body.enabled)
        # Accepted settings are not evidence that transport/worker/device is healthy.
        return {"saved": True, "enabled": body.enabled}

    @router.delete("")
    def revoke(device_id: str = Depends(authenticate)):
        store.revoke(device_id)
        return {"revoked": True}

    return router
