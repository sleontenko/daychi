"""Amazon Bedrock adapter using the existing AWS credential chain."""

from __future__ import annotations

import json
from collections.abc import Callable
from typing import Any

import boto3
from botocore.exceptions import BotoCoreError, ClientError


class BedrockError(RuntimeError):
    """Normalized Bedrock failure without leaking AWS configuration."""


class BedrockClient:
    def __init__(
        self,
        *,
        model: str,
        region: str = "us-east-1",
        profile: str | None = None,
        converse: Callable[..., dict[str, Any]] | None = None,
    ):
        if not model:
            raise ValueError("Bedrock model is required")
        self.model = model
        if converse is not None:
            self._converse = converse
            return
        try:
            session = boto3.Session(profile_name=profile, region_name=region)
            self._converse = session.client("bedrock-runtime").converse
        except BotoCoreError as exc:
            raise BedrockError("Amazon Bedrock credentials are unavailable") from exc

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
                "Отвечай по-русски только на основании списка найденных материалов.",
                "Доступны названия и метаданные, но пока не полные транскрипты.",
                "Не выдумывай содержание: предложи порядок изучения или честно скажи, что данных недостаточно.",
                "Верни только JSON вида {\"answer\": \"...\", \"citations\": [1, 2]}.",
                "В citations указывай номера действительно использованных материалов.",
                "",
                f"Вопрос: {question}",
                "",
                "Материалы:",
                *(source_lines or ["Материалы не найдены."]),
            )
        )
        try:
            response = self._converse(
                modelId=self.model,
                messages=[
                    {
                        "role": "user",
                        "content": [{"text": prompt}],
                    }
                ],
                inferenceConfig={
                    "maxTokens": 700,
                    "temperature": 0.1,
                },
            )
            parts = response["output"]["message"]["content"]
            raw = "".join(part.get("text", "") for part in parts)
            raw = raw.strip()
            if raw.startswith("```"):
                raw = raw.removeprefix("```json").removeprefix("```")
                raw = raw.removesuffix("```").strip()
            generated = json.loads(raw)
            if not isinstance(generated, dict):
                raise ValueError("Bedrock response must be a JSON object")
        except (BotoCoreError, ClientError, KeyError, TypeError, ValueError) as exc:
            raise BedrockError("Amazon Bedrock could not produce a valid answer") from exc

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
            "provider": "amazon-bedrock",
        }
