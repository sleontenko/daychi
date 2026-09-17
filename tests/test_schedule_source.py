from datetime import datetime

from fastapi.testclient import TestClient
import pytest
import requests

from practice_api.schedule_app import create_app
from practice_api.schedule_source import (
    DAYS, ScheduleSource, ScheduleSourceError, build_snapshot, parse_week,
)


def html(time="08.00-09.00", title="Тайцзи <span>онлайн</span>"):
    return "".join(
        f'<div data-testid="richTextElement"><h2>{day}</h2>'
        f'<p><span>{time} </span>{title}</p><p>\u200b</p></div>'
        for day in DAYS
    )


def test_inline_markup_and_all_days():
    rows = parse_week(html())
    assert len(rows) == 7
    assert rows[0]["title"] == "Тайцзи онлайн"


def test_occurrences_use_israel_dst_and_actual_dates():
    data = build_snapshot(html(), datetime.fromisoformat("2026-10-23T12:00:00+00:00"))
    assert len(data.occurrences) == 14
    assert data.occurrences[0].starts_at.isoformat() == "2026-10-23T08:00:00+03:00"
    assert data.occurrences[2].starts_at.isoformat() == "2026-10-25T08:00:00+02:00"


def test_move_keeps_identity_but_changes_revision():
    now = datetime.fromisoformat("2026-09-17T12:00:00+00:00")
    old = build_snapshot(html(), now)
    new = build_snapshot(html(time="10.00-11.00"), now)
    assert old.occurrences[0].id == new.occurrences[0].id
    assert old.revision != new.revision


@pytest.mark.parametrize("page", [
    "<html>maintenance</html>", html().replace("Пятница", "Праздник"),
    html(time="25.00-26.00"), html(time="09.00-08.00"),
    html().replace("<p>\u200b</p>", "<p>Сегодня отмена</p>"),
    html() + html(),
])
def test_fail_closed_on_ambiguous_or_changed_source(page):
    with pytest.raises(ScheduleSourceError):
        parse_week(page)


def test_source_caches_success_and_does_not_hide_network_error(monkeypatch):
    calls = []
    class Response:
        text = html()
        def raise_for_status(self):
            pass
    def get(*args, **kwargs):
        calls.append(1)
        return Response()
    monkeypatch.setattr(requests, "get", get)
    source = ScheduleSource()
    assert source.get() is source.get()
    assert len(calls) == 1
    source.snapshot = None
    def fail(*args, **kwargs):
        raise requests.ConnectionError("offline")
    monkeypatch.setattr(requests, "get", fail)
    with pytest.raises(ScheduleSourceError):
        source.get()
    assert source.retry_after is not None


def test_isolated_api_has_no_private_routes():
    class Source:
        def get(self):
            return build_snapshot(html(), datetime.fromisoformat("2026-09-17T12:00:00+00:00"))
    client = TestClient(create_app(Source()))
    response = client.get("/api/v1/schedule")
    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-store"
    assert response.json()["exceptions_verified"] is False
    assert response.json()["timezone"] == "Asia/Jerusalem"
    assert client.get("/api/v1/materials").status_code == 404


def test_api_failure_is_not_empty_schedule():
    class Source:
        def get(self):
            raise ScheduleSourceError("changed markup")
    assert TestClient(create_app(Source())).get("/api/v1/schedule").status_code == 503
