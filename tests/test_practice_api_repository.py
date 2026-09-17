import json
import sqlite3

from practice_api.repository import KnowledgeRepository


def _repository(tmp_path):
    db_path = tmp_path / "ingest.db"
    conn = sqlite3.connect(db_path)
    conn.executescript(
        """
        CREATE TABLE messages(channel_id INTEGER, msg_id INTEGER, text TEXT);
        CREATE TABLE links(id INTEGER);
        CREATE TABLE attachments(id INTEGER);
        INSERT INTO messages VALUES(1, 1, 'Тайцзи для начинающих');
        INSERT INTO links VALUES(1);
        INSERT INTO attachments VALUES(1);
        """
    )
    conn.close()
    plan_path = tmp_path / "notebook_plan.json"
    plan_path.write_text(
        json.dumps(
            {
                "meta": {"unique_loadable_sources": 2},
                "notebooks": [
                    {
                        "slug": "taiji_001",
                        "topic_slug": "taiji",
                        "title": "Тайцзи #1",
                        "source_count": 2,
                        "estimated_minutes": 45,
                    }
                ],
                "sources": [
                    {
                        "source_id": "youtube:one",
                        "title": "Первый урок тайцзи https://youtube.test/one",
                        "topic_slug": "taiji",
                        "load_type": "youtube_url",
                        "locator": "https://youtube.test/one",
                        "date": "2026-01-02",
                    },
                    {
                        "source_id": "youtube:two",
                        "title": "Работа с веером",
                        "topic_slug": "fan",
                        "load_type": "youtube_url",
                        "locator": "https://youtube.test/two",
                        "date": "2026-01-01",
                    },
                ],
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    return KnowledgeRepository(db_path, plan_path)


def test_overview_uses_current_local_artifacts(tmp_path):
    overview = _repository(tmp_path).overview()

    assert overview["messages"] == 1
    assert overview["unique_materials"] == 2
    assert overview["topics"][0]["title"] == "Тайцзи"


def test_material_search_is_ranked_and_deduplicated(tmp_path):
    result = _repository(tmp_path).list_materials(
        query="С чего начать: урок тайцзи?"
    )

    assert result["total"] == 1
    assert result["items"][0]["title"] == "Первый урок тайцзи"
    assert len(result["items"][0]["id"]) == 20
