import json
import sqlite3

from fastapi.testclient import TestClient

from practice_api.app import create_app
from practice_api.config import Settings


def _settings(tmp_path):
    db_path = tmp_path / "ingest.db"
    conn = sqlite3.connect(db_path)
    conn.executescript(
        """
        CREATE TABLE messages(channel_id INTEGER, msg_id INTEGER, text TEXT);
        CREATE TABLE links(id INTEGER);
        CREATE TABLE attachments(id INTEGER);
        """
    )
    conn.close()
    plan_path = tmp_path / "notebook_plan.json"
    plan_path.write_text(
        json.dumps({"meta": {}, "notebooks": [], "sources": []}),
        encoding="utf-8",
    )
    return Settings(ingest_db=db_path, notebook_plan=plan_path)


def test_health_does_not_expose_credentials(tmp_path):
    client = TestClient(create_app(_settings(tmp_path)))

    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "corpus_ready": True,
        "primary_provider": "local",
        "bedrock_configured": False,
        "bedrock_model": None,
        "gemini_configured": False,
        "gemini_model": "gemini-3.5-flash",
    }


def test_ask_falls_back_to_local_navigation_without_gemini(tmp_path):
    client = TestClient(create_app(_settings(tmp_path)))

    response = client.post("/api/v1/ask", json={"question": "С чего начать?"})

    assert response.status_code == 200
    assert response.json()["model"] == "local-navigation"
    assert response.json()["provider_status"] == "not_configured"
