from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from practice_api.apns import PushResult
from practice_api.reminder_store import ReminderStore
from practice_api.reminder_worker import dispatch
from practice_api.schedule import AttendanceChoice, ClassOccurrence, ScheduleSnapshot


def setup(tmp_path):
    store = ReminderStore(tmp_path / "private.db")
    auth = store.pair(store.create_pairing_code())
    device = store.authenticate(auth)
    store.set_push(device, "ab" * 32, True)
    store.set_choices(device, [AttendanceChoice(occurrence_id="one")])
    now = datetime.now(timezone.utc)
    snapshot = ScheduleSnapshot(revision="one", fetched_at=now - timedelta(seconds=1),
        valid_until=now + timedelta(minutes=5), occurrences=[ClassOccurrence(
            id="one", title="Lesson", starts_at=now + timedelta(minutes=30),
            ends_at=now + timedelta(minutes=90))])
    return store, device, now, snapshot


def test_dedup_restart_and_revision_change(tmp_path):
    store, device, now, snapshot = setup(tmp_path)
    calls = []
    sender = SimpleNamespace(send=lambda *args: calls.append(args) or PushResult("accepted"))
    source = SimpleNamespace(get=lambda: snapshot)
    assert dispatch(store, source, sender, clock=lambda: now)["accepted"] == 1
    snapshot.revision = "changed-title"
    dispatch(ReminderStore(store.path), source, sender, clock=lambda: now)
    assert len(calls) == 1


def test_uncertain_result_not_retried(tmp_path):
    store, device, now, snapshot = setup(tmp_path)
    sender = SimpleNamespace(send=lambda *args: PushResult("unknown"))
    source = SimpleNamespace(get=lambda: snapshot)
    assert dispatch(store, source, sender, clock=lambda: now)["unknown"] == 1
    assert dispatch(store, source, sender, clock=lambda: now)["unknown"] == 0


def test_invalid_token_disabled(tmp_path):
    store, device, now, snapshot = setup(tmp_path)
    dispatch(store, SimpleNamespace(get=lambda: snapshot),
             SimpleNamespace(send=lambda *args: PushResult("rejected", True)), clock=lambda: now)
    assert store.active_devices() == []


def test_optout_between_scan_and_claim(tmp_path):
    store, device, now, snapshot = setup(tmp_path)
    def source():
        store.set_choices(device, [])
        return snapshot
    def unexpected(*args):
        raise AssertionError("must not send")
    assert dispatch(store, SimpleNamespace(get=source), SimpleNamespace(send=unexpected),
                    clock=lambda: now) == dict(accepted=0, rejected=0, unknown=0)


def test_old_token_rejection_preserves_new_token(tmp_path):
    store, device, now, snapshot = setup(tmp_path)
    store.set_push(device, "cd" * 32, True)
    store.disable_push_token(device, "ab" * 32)
    assert store.active_devices()[0]["push_token"] == "cd" * 32
