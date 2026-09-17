"""Server-side Gemini adapter for grounded navigation answers."""

from __future__ import annotations

import json
from collections.abc import Callable
from typing import Any

import requests


class GeminiError(RuntimeError):
    """Normalized provider failure without leaking credentials."""


class GeminiClient:
    def __init__(
        self,
        api_key: str,
        model: str = "gemini-3.5-flash",
        post: Callable[..., Any] = requests.post,
    ):
        if not api_key:
            raise ValueError("Gemini API key is required")
        self.api_key = api_key
        self.model = model
        self._post = post

    def answer(
        self, question: str, sources: list[dict[str, Any]]
    ) -> dict[str, Any]:
        source_lines = [
            (
                f"[{index}] {item['title']} | тема: {item['topic_slug']} | "
                f"тип: {item['kind']} | дата: {item.get('date') or 'неизвестна'}"
            )
            for index, item in enumerate(sources, 1)
        ]
        prompt = "\n".join(
            (
                "Ты — навигатор по закрытой библиотеке материалов о практике.",
                "Отвечай по-русски и только на основании списка найденных материалов.",
                "Сейчас доступны названия и метаданные, но не полные транскрипты.",
                "Поэтому не выдумывай содержание: предложи, с чего начать, или честно скажи, что данных недостаточно.",
                "В citations верни номера действительно использованных материалов.",
                "",
                f"Вопрос: {question}",
                "",
                "Материалы:",
                *(source_lines or ["Материалы не найдены."]),
            )
        )
        response = self._post(
            (
                "https://generativelanguage.googleapis.com/v1beta/models/"
                f"{self.model}:generateContent"
            ),
            headers={"x-goog-api-key": self.api_key},
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 0.2,
                    "responseMimeType": "application/json",
                    "responseJsonSchema": {
                        "type": "object",
                        "properties": {
                            "answer": {"type": "string"},
                            "citations": {
                                "type": "array",
                                "items": {"type": "integer"},
                            },
                        },
                        "required": ["answer", "citations"],
                    },
                },
            },
            timeout=45,
        )
        try:
            response.raise_for_status()
            payload = response.json()
            raw = payload["candidates"][0]["content"]["parts"][0]["text"]
            generated = json.loads(raw)
            if not isinstance(generated, dict):
                raise ValueError("Gemini response must be a JSON object")
        except (KeyError, IndexError, TypeError, ValueError, requests.RequestException) as exc:
            raise GeminiError("Gemini could not produce a valid answer") from exc

        citation_indexes = {
            value
            for value in generated.get("citations", [])
            if isinstance(value, int) and 1 <= value <= len(sources)
        }
        citations = [
            source for index, source in enumerate(sources, 1) if index in citation_indexes
        ]
        return {
            "answer": str(generated.get("answer") or "").strip(),
            "citations": citations,
            "model": self.model,
        }
