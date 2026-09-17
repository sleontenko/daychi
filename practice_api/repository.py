"""Read-only access to the current local corpus and loading plan."""

from __future__ import annotations

import hashlib
import json
import re
import sqlite3
from collections import defaultdict
from pathlib import Path
from typing import Any


class CorpusUnavailableError(RuntimeError):
    """Raised when the local corpus has not been prepared yet."""


class KnowledgeRepository:
    def __init__(self, ingest_db: Path, notebook_plan: Path):
        self.ingest_db = Path(ingest_db)
        self.notebook_plan = Path(notebook_plan)

    def is_ready(self) -> bool:
        return self.ingest_db.is_file() and self.notebook_plan.is_file()

    def _plan(self) -> dict[str, Any]:
        if not self.notebook_plan.is_file():
            raise CorpusUnavailableError(
                f"Notebook plan not found: {self.notebook_plan}"
            )
        return json.loads(self.notebook_plan.read_text(encoding="utf-8"))

    def _connect_read_only(self) -> sqlite3.Connection:
        if not self.ingest_db.is_file():
            raise CorpusUnavailableError(
                f"Ingest database not found: {self.ingest_db}"
            )
        uri = f"file:{self.ingest_db.resolve()}?mode=ro"
        return sqlite3.connect(uri, uri=True)

    @staticmethod
    def _material_id(source_id: str) -> str:
        return hashlib.sha256(source_id.encode("utf-8")).hexdigest()[:20]

    @staticmethod
    def _display_title(value: object) -> str:
        title = str(value or "")
        title = re.sub(r"https?://\S+", "", title)
        title = re.sub(r"\]\([^)]+\)", "]", title)
        title = " ".join(title.split()).strip(" -–—:[]()")
        return title or "Материал без названия"

    def overview(self) -> dict[str, Any]:
        with self._connect_read_only() as conn:
            messages = conn.execute("SELECT COUNT(*) FROM messages").fetchone()[0]
            links = conn.execute("SELECT COUNT(*) FROM links").fetchone()[0]
            attachments = conn.execute(
                "SELECT COUNT(*) FROM attachments"
            ).fetchone()[0]

        plan = self._plan()
        return {
            "messages": messages,
            "links": links,
            "attachments": attachments,
            "unique_materials": plan.get("meta", {}).get(
                "unique_loadable_sources", 0
            ),
            "topics": self.topics(),
        }

    def topics(self) -> list[dict[str, Any]]:
        grouped: dict[str, dict[str, Any]] = {}
        for notebook in self._plan().get("notebooks", []):
            slug = notebook.get("topic_slug") or notebook.get("slug")
            item = grouped.setdefault(
                slug,
                {
                    "slug": slug,
                    "title": str(notebook.get("title") or slug).split(" #", 1)[0],
                    "source_count": 0,
                    "estimated_minutes": 0.0,
                },
            )
            item["source_count"] += int(notebook.get("source_count") or 0)
            item["estimated_minutes"] += float(
                notebook.get("estimated_minutes") or 0
            )

        topics = list(grouped.values())
        for topic in topics:
            topic["estimated_minutes"] = round(topic["estimated_minutes"], 1)
        return sorted(topics, key=lambda item: (-item["source_count"], item["title"]))

    def _materials(self) -> list[dict[str, Any]]:
        materials: list[dict[str, Any]] = []
        for source in self._plan().get("sources", []):
            source_id = str(source.get("source_id") or source.get("locator") or "")
            if not source_id:
                continue
            materials.append(
                {
                    "id": self._material_id(source_id),
                    "source_id": source_id,
                    "title": self._display_title(source.get("title")),
                    "topic_slug": source.get("topic_slug") or "general_practice",
                    "notebook_title": source.get("notebook_title"),
                    "kind": source.get("load_type") or "unknown",
                    "source_url": source.get("locator"),
                    "date": source.get("date"),
                    "duration_minutes": source.get("duration_min"),
                }
            )
        return materials

    def list_materials(
        self,
        *,
        topic: str | None = None,
        query: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> dict[str, Any]:
        materials = self._materials()
        if topic:
            materials = [item for item in materials if item["topic_slug"] == topic]
        if query and query.strip():
            materials = self._ranked_search(materials, query)
        else:
            kind_rank = {"youtube_url": 2, "gdrive_url": 2, "telegram_media": 1}
            materials.sort(
                key=lambda item: (
                    item.get("date") or "",
                    kind_rank.get(str(item.get("kind")), 0),
                ),
                reverse=True,
            )

        unique: list[dict[str, Any]] = []
        seen: set[str] = set()
        seen_display: set[tuple[str, str]] = set()
        for item in materials:
            if item["id"] in seen:
                continue
            display_key = (
                str(item.get("date") or "")[:10],
                str(item.get("title") or "").casefold(),
            )
            if display_key in seen_display:
                continue
            seen.add(item["id"])
            seen_display.add(display_key)
            unique.append(item)
        return {
            "items": unique[offset : offset + limit],
            "total": len(unique),
            "limit": limit,
            "offset": offset,
        }

    @staticmethod
    def _ranked_search(
        materials: list[dict[str, Any]], query: str
    ) -> list[dict[str, Any]]:
        normalized = " ".join(query.lower().split())
        tokens = [token for token in re.findall(r"[\wё]+", normalized) if len(token) > 1]
        ranked: list[tuple[int, str, dict[str, Any]]] = []
        for item in materials:
            title = str(item.get("title") or "").lower()
            haystack = " ".join(
                (
                    title,
                    str(item.get("topic_slug") or "").lower(),
                    str(item.get("notebook_title") or "").lower(),
                )
            )
            score = sum(2 if token in title else 1 for token in tokens if token in haystack)
            normalized_phrase = " ".join(tokens)
            if normalized_phrase and normalized_phrase in title:
                score += 5
            if score:
                ranked.append((score, str(item.get("date") or ""), item))
        ranked.sort(key=lambda row: (row[0], row[1]), reverse=True)
        return [row[2] for row in ranked]

    def search_for_answer(self, query: str, limit: int = 8) -> list[dict[str, Any]]:
        result = self.list_materials(query=query, limit=limit)
        return result["items"]

    def topic_counts_for_materials(self) -> dict[str, int]:
        counts: dict[str, set[str]] = defaultdict(set)
        for item in self._materials():
            counts[item["topic_slug"]].add(item["id"])
        return {slug: len(ids) for slug, ids in counts.items()}
