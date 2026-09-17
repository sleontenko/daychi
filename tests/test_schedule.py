from datetime import datetime

import pytest
from pydantic import ValidationError

from practice_api.schedule import (
    AttendanceChoice, ClassOccurrence, ScheduleSnapshot,
    classes_today, is_fresh, reminder_candidates,
)


def at(value):
    return datetime.fromisoformat(value)


def snapshot(**event_changes):
    event = dict(id="class-1", title="Цигун",
                 starts_at="2026-09-17T10:00:00+03:00",
                 ends_at="2026-09-17T11:00:00+03:00")
    event.update(event_changes)
    return ScheduleSnapshot(
        revision="r1", fetched_at="2026-09-17T09:00:00+03:00",
        valid_until="2026-09-17T10:01:00+03:00",
        occurrences=[ClassOccurrence(**event)],
    )


def test_due_reminder_and_grace_boundary():
    choices = [AttendanceChoice(occurrence_id="class-1")]
    assert len(reminder_candidates(snapshot(), choices, at("2026-09-17T09:30:00+03:00"))) == 1
    assert not reminder_candidates(snapshot(), choices, at("2026-09-17T09:29:59+03:00"))
    assert not reminder_candidates(snapshot(), choices, at("2026-09-17T09:32:00+03:00"))


@pytest.mark.parametrize("changes", [
    {"status": "cancelled"},
    {"starts_at": "2026-09-17T10:30:00+03:00"},
])
def test_latest_schedule_suppresses_original_reminder(changes):
    assert not reminder_candidates(snapshot(**changes),
        [AttendanceChoice(occurrence_id="class-1")], at("2026-09-17T09:30:00+03:00"))


def test_disabled_missing_and_duplicate_choices():
    choices = [AttendanceChoice(occurrence_id="class-1"),
               AttendanceChoice(occurrence_id="class-1", reminders_enabled=False),
               AttendanceChoice(occurrence_id="deleted")]
    assert not reminder_candidates(snapshot(), choices, at("2026-09-17T09:30:00+03:00"))


def test_stale_and_future_snapshots_are_not_trusted():
    data = snapshot()
    for now in ["2026-09-17T08:59:59+03:00", "2026-09-17T10:01:00+03:00"]:
        assert not is_fresh(data, at(now))
        assert not reminder_candidates(data, [AttendanceChoice(occurrence_id="class-1")], at(now))


def test_today_uses_requested_timezone_not_utc_date():
    data = snapshot(starts_at="2026-09-16T22:30:00+00:00",
                    ends_at="2026-09-16T23:30:00+00:00")
    now = at("2026-09-17T08:00:00+00:00")
    assert len(classes_today(data, now, "Europe/Moscow")) == 1
    assert not classes_today(data, now, "UTC")


def test_start_time_reminder():
    assert len(reminder_candidates(snapshot(),
        [AttendanceChoice(occurrence_id="class-1", minutes_before=0)],
        at("2026-09-17T10:00:00+03:00"))) == 1
    assert len(reminder_candidates(snapshot(),
        [AttendanceChoice(occurrence_id="class-1", minutes_before=0)],
        at("2026-09-17T10:00:30+03:00"))) == 1


def test_reject_naive_dates_and_invalid_intervals():
    with pytest.raises(ValidationError):
        snapshot(starts_at="2026-09-17T10:00:00")
    with pytest.raises(ValidationError):
        snapshot(ends_at="2026-09-17T09:00:00+03:00")
    with pytest.raises(ValueError):
        is_fresh(snapshot(), at("2026-09-17T09:30:00"))


def test_duplicate_occurrence_ids_rejected():
    data = snapshot().model_dump()
    data["occurrences"] *= 2
    with pytest.raises(ValidationError):
        ScheduleSnapshot(**data)
