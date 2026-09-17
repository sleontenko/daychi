from concurrent.futures import ThreadPoolExecutor

from practice_api.reminder_store import ReminderStore
from practice_api.schedule import AttendanceChoice


def test_one_time_expiring_pairing_and_token_hashes(tmp_path):
    store = ReminderStore(tmp_path / "private.sqlite")
    code = store.create_pairing_code(now=100)
    token = store.pair(code, now=101)
    assert token and store.authenticate(token)
    assert store.pair(code, now=102) is None
    assert store.authenticate("wrong") is None
    assert store.pair(store.create_pairing_code(now=100), now=1000) is None
    assert token.encode() not in store.path.read_bytes()
    assert code.encode() not in store.path.read_bytes()


def test_devices_cannot_overwrite_each_others_choices(tmp_path):
    store = ReminderStore(tmp_path / "private.sqlite")
    a = store.authenticate(store.pair(store.create_pairing_code()))
    b = store.authenticate(store.pair(store.create_pairing_code()))
    store.set_choices(a, [AttendanceChoice(occurrence_id="a")])
    store.set_choices(b, [AttendanceChoice(occurrence_id="b", minutes_before=60)])
    store.set_choices(a, [])
    assert not store.get_choices(a)
    assert store.get_choices(b)[0].occurrence_id == "b"
    store.set_push(a, "token", True)
    store.set_push(b, "token", True)
    assert [d["id"] for d in store.active_devices()] == [b]


def test_concurrent_claims_and_revocation(tmp_path):
    store = ReminderStore(tmp_path / "private.sqlite")
    token = store.pair(store.create_pairing_code())
    device = store.authenticate(token)
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda _: store.claim(device, "event"), range(8)))
    assert sum(results) == 1
    store.delivery_result(device, "event", "accepted")
    assert not store.claim(device, "event")
    store.revoke(device)
    assert store.authenticate(token) is None
    assert not store.active_devices()
