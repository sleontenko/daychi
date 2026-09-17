"""Read the school's public weekly timetable, without private corpus access."""

from datetime import datetime, time, timedelta, timezone
from hashlib import sha256
from html.parser import HTMLParser
import re
from threading import Lock
from zoneinfo import ZoneInfo

import requests

from practice_api.schedule import ClassOccurrence, ScheduleSnapshot

SOURCE_URL = "https://www.telaviv-taiji.com/kogda"
SCHOOL_TIMEZONE = "Asia/Jerusalem"
DAYS = {name: index for index, name in enumerate(
    ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"]
)}
TIME_ROW = re.compile(r"^(\d{1,2})[.:](\d{2})\s*[-–—]\s*(\d{1,2})[.:](\d{2})\s+(.+)$")


class ScheduleSourceError(ValueError):
    pass


class _TimetableHTML(HTMLParser):
    """Preserve text across Wix inline spans; ignore scripts and navigation."""

    def __init__(self):
        super().__init__()
        self.groups = []
        self.group = None
        self.depth = 0
        self.block = None
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag == "div":
            if self.depth:
                self.depth += 1
            elif dict(attrs).get("data-testid") == "richTextElement":
                self.depth = 1
                self.group = []
        if self.depth and tag in ("h2", "p"):
            self.block, self.parts = tag, []
        if self.block and tag == "br":
            self.parts.append(" ")

    def handle_data(self, data):
        if self.block:
            self.parts.append(data)

    def handle_endtag(self, tag):
        if tag == self.block:
            text = " ".join("".join(self.parts).replace("\u200b", "").split())
            if text:
                self.group.append(text)
            self.block = None
        if tag == "div" and self.depth:
            self.depth -= 1
            if self.depth == 0:
                self.groups.append(self.group)
                self.group = None
                self.block = None


def parse_week(html: str) -> list[dict]:
    parser = _TimetableHTML()
    parser.feed(html)
    rows, seen_days, seen_ids = [], set(), set()
    for group in parser.groups:
        if not group or group[0] not in DAYS:
            continue
        weekday = DAYS[group[0]]
        if weekday in seen_days or len(group) < 2:
            raise ScheduleSourceError("Duplicate or empty weekday section")
        seen_days.add(weekday)
        for line in group[1:]:
            match = TIME_ROW.fullmatch(line)
            if not match:
                # A cancellation notice or changed layout needs review, not guessing.
                raise ScheduleSourceError("Unrecognized timetable row")
            hour, minute, end_hour, end_minute = map(int, match.groups()[:4])
            try:
                starts, ends = time(hour, minute), time(end_hour, end_minute)
            except ValueError as exc:
                raise ScheduleSourceError("Invalid class time") from exc
            if ends <= starts:
                raise ScheduleSourceError("Invalid or overnight interval")
            title = match[5]
            identity = sha256(f"{weekday}:{title}".encode()).hexdigest()[:20]
            if identity in seen_ids:
                raise ScheduleSourceError("Ambiguous class identity")
            seen_ids.add(identity)
            rows.append(dict(series_id=identity, weekday=weekday, title=title,
                             starts=starts, ends=ends))
    if seen_days != set(range(7)):
        raise ScheduleSourceError("Expected all seven weekday sections")
    return sorted(rows, key=lambda row: (row["weekday"], row["starts"], row["series_id"]))


def build_snapshot(html: str, now: datetime) -> ScheduleSnapshot:
    if now.tzinfo is None or now.utcoffset() is None:
        raise ValueError("now must include a timezone")
    rows = parse_week(html)
    zone = ZoneInfo(SCHOOL_TIMEZONE)
    today = now.astimezone(zone).date()
    events = []
    for offset in range(14):
        day = today + timedelta(days=offset)
        for row in rows:
            if row["weekday"] == day.weekday():
                events.append(ClassOccurrence(
                    id=f"{row['series_id']}:{day.isoformat()}", title=row["title"],
                    starts_at=datetime.combine(day, row["starts"], zone),
                    ends_at=datetime.combine(day, row["ends"], zone),
                ))
    revision = sha256(repr(rows).encode()).hexdigest()
    return ScheduleSnapshot(revision=revision, fetched_at=now,
                            valid_until=now + timedelta(minutes=5), occurrences=events)


class ScheduleSource:
    """Five-minute, process-local cache; failures never renew its timestamp."""

    def __init__(self):
        self.lock = Lock()
        self.snapshot = None
        self.retry_after = None

    def get(self) -> ScheduleSnapshot:
        with self.lock:
            now = datetime.now(timezone.utc)
            if (self.snapshot and now < self.snapshot.valid_until
                    and self.snapshot.fetched_at.astimezone(ZoneInfo(SCHOOL_TIMEZONE)).date()
                    == now.astimezone(ZoneInfo(SCHOOL_TIMEZONE)).date()):
                return self.snapshot
            if self.retry_after and now < self.retry_after:
                raise ScheduleSourceError("Source temporarily unavailable")
            try:
                response = requests.get(SOURCE_URL, timeout=(5, 15), headers={
                    "User-Agent": "QuietPracticeSchedule/0.1",
                    "Cache-Control": "no-cache",
                })
                response.raise_for_status()
                self.snapshot = build_snapshot(response.text, datetime.now(timezone.utc))
                self.retry_after = None
                return self.snapshot
            except (requests.RequestException, ScheduleSourceError) as exc:
                self.retry_after = now + timedelta(seconds=30)
                raise ScheduleSourceError("Could not verify the school timetable") from exc
