"""Schedule domain rules; no source integration or push delivery yet.

An occurrence ID must remain stable when a source moves or cancels a class.
Dispatchers must re-read the latest snapshot immediately before delivery.
"""

from datetime import datetime, timedelta
from typing import Literal
from zoneinfo import ZoneInfo

from pydantic import AwareDatetime, BaseModel, Field, model_validator


class ClassOccurrence(BaseModel):
    id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    starts_at: AwareDatetime
    ends_at: AwareDatetime
    status: Literal["scheduled", "cancelled"] = "scheduled"

    @model_validator(mode="after")
    def validate_interval(self):
        if self.ends_at <= self.starts_at:
            raise ValueError("ends_at must be after starts_at")
        return self


class ScheduleSnapshot(BaseModel):
    revision: str = Field(min_length=1)
    fetched_at: AwareDatetime
    # Set by the source adapter, not by the device clock or cache reader.
    valid_until: AwareDatetime
    occurrences: list[ClassOccurrence]

    @model_validator(mode="after")
    def validate_snapshot(self):
        if self.valid_until <= self.fetched_at:
            raise ValueError("valid_until must be after fetched_at")
        ids = [item.id for item in self.occurrences]
        if len(ids) != len(set(ids)):
            raise ValueError("duplicate occurrence IDs")
        return self


class AttendanceChoice(BaseModel):
    occurrence_id: str = Field(min_length=1, max_length=200)
    reminders_enabled: bool = True
    minutes_before: Literal[0, 30, 60] = 30


class ReminderCandidate(BaseModel):
    occurrence_id: str
    schedule_revision: str
    starts_at: AwareDatetime
    notify_at: AwareDatetime


def _require_aware(now: datetime) -> None:
    if now.tzinfo is None or now.utcoffset() is None:
        raise ValueError("now must include a timezone")


def is_fresh(snapshot: ScheduleSnapshot, now: datetime) -> bool:
    _require_aware(now)
    return snapshot.fetched_at <= now < snapshot.valid_until


def classes_today(
    snapshot: ScheduleSnapshot, now: datetime, timezone: str
) -> list[ClassOccurrence]:
    """Include cancellations so the UI can explain a changed schedule."""
    _require_aware(now)
    zone = ZoneInfo(timezone)
    today = now.astimezone(zone).date()
    return sorted(
        (item for item in snapshot.occurrences
         if item.starts_at.astimezone(zone).date() == today),
        key=lambda item: item.starts_at,
    )


def reminder_candidates(
    snapshot: ScheduleSnapshot,
    choices: list[AttendanceChoice],
    now: datetime,
    delivery_grace: timedelta = timedelta(minutes=2),
) -> list[ReminderCandidate]:
    """Candidates only: delivery needs persistent deduplication and consent.

    Suppress stale data and reminders missed outside a short worker grace
    period. Never infer weekly recurrence from an attendance choice.
    """
    if delivery_grace < timedelta(0):
        raise ValueError("delivery_grace must be nonnegative")
    if not is_fresh(snapshot, now):
        return []
    occurrences = {item.id: item for item in snapshot.occurrences}
    result = []
    # Last saved choice wins if a caller provides duplicated preferences.
    for choice in {item.occurrence_id: item for item in choices}.values():
        item = occurrences.get(choice.occurrence_id)
        if not choice.reminders_enabled or item is None:
            continue
        if item.status == "cancelled" or (item.starts_at < now and choice.minutes_before != 0):
            continue
        notify_at = item.starts_at - timedelta(minutes=choice.minutes_before)
        if notify_at <= now < notify_at + delivery_grace:
            result.append(ReminderCandidate(
                occurrence_id=item.id,
                schedule_revision=snapshot.revision,
                starts_at=item.starts_at,
                notify_at=notify_at,
            ))
    return result
