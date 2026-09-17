"""One dispatch pass; deployment must supply a fresh, verified schedule source."""

from datetime import datetime, timezone
from hashlib import sha256

from practice_api.schedule import reminder_candidates


def dispatch(store, source, transport, *, clock=lambda: datetime.now(timezone.utc)):
    counts = dict(accepted=0, rejected=0, unknown=0)
    for device in store.active_devices():
        # Refresh source/preferences for each device, not once at worker startup.
        snapshot = source.get()
        for candidate in reminder_candidates(snapshot, store.get_choices(device["id"]), clock()):
            # Revision/title changes must not resend an already-issued reminder.
            # One reminder per selected occurrence, even if it later moves.
            key = sha256(candidate.occurrence_id.encode()).hexdigest()
            if not store.claim_active(device["id"], device["push_token"],
                                      candidate.occurrence_id, key):
                continue
            try:
                result = transport.send(device["push_token"], key, candidate.occurrence_id)
            except Exception:
                # Persist uncertainty even if an unexpected transport failure occurs.
                store.delivery_result(device["id"], key, "unknown")
                raise
            store.delivery_result(device["id"], key, result.state)
            counts[result.state] += 1
            if result.invalid_token:
                store.disable_push_token(device["id"], device["push_token"])
                break
    return counts
