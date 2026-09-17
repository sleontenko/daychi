"""Runtime configuration with secrets kept outside the repository."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent


@dataclass(frozen=True)
class Settings:
    ingest_db: Path = PROJECT_ROOT / "data" / "ingest.db"
    notebook_plan: Path = PROJECT_ROOT / "data" / "notebook_plan.json"
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-3.5-flash"
    aws_profile: str | None = None
    aws_region: str = "us-east-1"
    bedrock_model: str | None = None
    allowed_origins: tuple[str, ...] = (
        "http://localhost:8081",
        "http://localhost:19006",
    )

    @classmethod
    def from_env(cls) -> "Settings":
        origins = os.getenv("PRACTICE_ALLOWED_ORIGINS", "")
        aws_profile = os.getenv(
            "PRACTICE_AWS_PROFILE", "bedrock-cogito-agent"
        )
        bedrock_model = os.getenv(
            "BEDROCK_MODEL", "us.anthropic.claude-sonnet-4-6"
        )
        return cls(
            ingest_db=Path(
                os.getenv("PRACTICE_INGEST_DB", PROJECT_ROOT / "data/ingest.db")
            ),
            notebook_plan=Path(
                os.getenv(
                    "PRACTICE_NOTEBOOK_PLAN",
                    PROJECT_ROOT / "data/notebook_plan.json",
                )
            ),
            gemini_api_key=os.getenv("GEMINI_API_KEY")
            or os.getenv("GOOGLE_API_KEY"),
            gemini_model=os.getenv("GEMINI_MODEL", "gemini-3.5-flash"),
            aws_profile=aws_profile or None,
            aws_region=os.getenv("AWS_REGION", "us-east-1"),
            bedrock_model=bedrock_model or None,
            allowed_origins=tuple(
                item.strip() for item in origins.split(",") if item.strip()
            )
            or cls.allowed_origins,
        )
