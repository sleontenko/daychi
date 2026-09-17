"""FastAPI application exposing the first app-first vertical slice."""

from __future__ import annotations

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from practice_api.bedrock import BedrockClient, BedrockError
from practice_api.config import Settings
from practice_api.gemini import GeminiClient, GeminiError
from practice_api.repository import CorpusUnavailableError, KnowledgeRepository


class AskRequest(BaseModel):
    question: str = Field(min_length=3, max_length=1_000)


def _local_navigation_answer(
    sources: list[dict[str, object]], provider_status: str
) -> dict[str, object]:
    if not sources:
        answer = (
            "В локальном индексе не нашлось подходящих материалов. "
            "Попробуйте назвать традицию, практику или термин точнее."
        )
    else:
        titles = "; ".join(str(source["title"]) for source in sources[:3])
        answer = (
            "По названиям и метаданным ближе всего подходят: "
            f"{titles}. Пока полные транскрипты не подключены, "
            "это навигационная рекомендация, а не пересказ учения."
        )
    return {
        "answer": answer,
        "citations": sources[:3],
        "model": "local-navigation",
        "provider_status": provider_status,
    }


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    repository = KnowledgeRepository(settings.ingest_db, settings.notebook_plan)
    try:
        bedrock = (
            BedrockClient(
                model=settings.bedrock_model,
                region=settings.aws_region,
                profile=settings.aws_profile,
            )
            if settings.bedrock_model
            else None
        )
    except BedrockError:
        bedrock = None
    gemini = (
        GeminiClient(settings.gemini_api_key, settings.gemini_model)
        if settings.gemini_api_key
        else None
    )

    app = FastAPI(
        title="Practice Knowledge API",
        version="0.1.0",
        description="Local-first API over the private practice corpus.",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.allowed_origins),
        allow_credentials=True,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )

    @app.get("/api/v1/health")
    def health() -> dict[str, object]:
        return {
            "status": "ok" if repository.is_ready() else "degraded",
            "corpus_ready": repository.is_ready(),
            "primary_provider": (
                "amazon-bedrock" if bedrock else "gemini" if gemini else "local"
            ),
            "bedrock_configured": bedrock is not None,
            "bedrock_model": settings.bedrock_model,
            "gemini_configured": gemini is not None,
            "gemini_model": settings.gemini_model,
        }

    @app.get("/api/v1/overview")
    def overview() -> dict[str, object]:
        try:
            return repository.overview()
        except CorpusUnavailableError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc

    @app.get("/api/v1/topics")
    def topics() -> list[dict[str, object]]:
        try:
            return repository.topics()
        except CorpusUnavailableError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc

    @app.get("/api/v1/materials")
    def materials(
        topic: str | None = None,
        q: str | None = None,
        limit: int = Query(default=20, ge=1, le=100),
        offset: int = Query(default=0, ge=0),
    ) -> dict[str, object]:
        try:
            return repository.list_materials(
                topic=topic, query=q, limit=limit, offset=offset
            )
        except CorpusUnavailableError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc

    @app.post("/api/v1/ask")
    def ask(request: AskRequest) -> dict[str, object]:
        try:
            sources = repository.search_for_answer(request.question)
            if bedrock is not None:
                try:
                    return bedrock.answer(request.question, sources)
                except BedrockError:
                    pass
            if gemini is not None:
                try:
                    return gemini.answer(request.question, sources)
                except GeminiError:
                    pass
            provider_status = (
                "temporarily_unavailable"
                if bedrock is not None or gemini is not None
                else "not_configured"
            )
            return _local_navigation_answer(sources, provider_status)
        except CorpusUnavailableError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc

    return app


app = create_app()
