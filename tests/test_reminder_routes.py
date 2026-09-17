from fastapi.testclient import TestClient

from practice_api.reminder_store import ReminderStore
from practice_api.schedule_app import create_app


def test_private_endpoints_require_authentication(tmp_path):
    store = ReminderStore(tmp_path / "private.sqlite")
    client = TestClient(create_app(store=store))
    assert client.get("/api/v1/device/choices").status_code == 401
    assert client.put("/api/v1/device/push", json={"enabled": False}).status_code == 401
    assert client.post("/api/v1/device/pair", json={"code": "x" * 32}).status_code == 401
    assert TestClient(create_app()).get("/api/v1/device/choices").status_code == 404


def test_pair_save_disable_and_revoke(tmp_path):
    store = ReminderStore(tmp_path / "private.sqlite")
    client = TestClient(create_app(store=store))
    code = store.create_pairing_code()
    response = client.post("/api/v1/device/pair", json={"code": code})
    assert response.headers["cache-control"] == "no-store"
    token = response.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    assert client.post("/api/v1/device/pair", json={"code": code}).status_code == 401
    choices = [{"occurrence_id": "class1", "minutes_before": 30, "reminders_enabled": True}]
    assert client.put("/api/v1/device/choices", headers=headers, json={"choices": choices}).status_code == 200
    assert client.get("/api/v1/device/choices", headers=headers).json()["choices"] == choices
    assert client.put("/api/v1/device/push", headers=headers, json={"enabled": True}).status_code == 422
    assert client.put("/api/v1/device/push", headers=headers,
                      json={"enabled": True, "token": "a" * 64}).status_code == 200
    assert len(store.active_devices()) == 1
    client.put("/api/v1/device/push", headers=headers, json={"enabled": False})
    assert not store.active_devices()
    assert client.delete("/api/v1/device", headers=headers).status_code == 200
    assert client.get("/api/v1/device/choices", headers=headers).status_code == 401
