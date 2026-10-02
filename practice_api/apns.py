"""Production-only APNs transport. Never log credentials or device tokens."""

from dataclasses import dataclass
from pathlib import Path
import re
import time
import uuid

import httpx2
import jwt

TOPIC = "ai.mypraxis.quietpractice"


@dataclass(frozen=True)
class PushResult:
    state: str
    invalid_token: bool = False


class APNs:
    def __init__(self, key_path: Path, key_id: str, team_id: str, *, client=None,
                 clock=time.time):
        if key_path.stat().st_mode & 0o077:
            raise ValueError("APNs key must be accessible only to its owner")
        self.key = key_path.read_bytes()
        self.key_id, self.team_id = key_id, team_id
        self.clock = clock
        self.token, self.issued = None, 0
        self.client = client or httpx2.Client(http2=True, timeout=10, trust_env=False)

    def close(self):
        self.client.close()

    def authorization(self):
        now = int(self.clock())
        if self.token is None or not 0 <= now - self.issued < 3000:
            self.token = jwt.encode({"iss": self.team_id, "iat": now}, self.key,
                                    algorithm="ES256", headers={"kid": self.key_id})
            self.issued = now
        return f"bearer {self.token}"

    def send(self, token: str, event_key: str, occurrence_id: str) -> PushResult:
        if not re.fullmatch(r"[0-9a-fA-F]{32,512}", token):
            return PushResult("rejected", invalid_token=True)
        # Generic lock-screen copy: never expose private Telegram class contents.
        payload = {"aps": {"alert": {"title": "Дейчи",
                    "body": "Скоро выбранное занятие. Проверьте актуальное расписание."},
                    "sound": "default"}, "occurrence_id": occurrence_id}
        headers = {"authorization": self.authorization(), "apns-topic": TOPIC,
                   "apns-push-type": "alert", "apns-priority": "10",
                   "apns-expiration": "0", "apns-collapse-id": event_key,
                   "apns-id": str(uuid.uuid4())}
        try:
            response = self.client.post(f"https://api.push.apple.com/3/device/{token}",
                                        headers=headers, json=payload)
        except httpx2.RequestError:
            # An uncertain outcome must not generate a duplicate alert on retry.
            return PushResult("unknown")
        if response.status_code == 200:
            return PushResult("accepted")
        try:
            reason = response.json().get("reason")
        except (ValueError, AttributeError):
            reason = None
        return PushResult("rejected", reason in {
            "Unregistered", "BadDeviceToken", "DeviceTokenNotForTopic"})
