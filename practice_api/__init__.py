"""Local-first API for the practice knowledge base."""

def create_app(*args, **kwargs):
    # Keep the standalone schedule service independent of private corpus imports.
    from practice_api.app import create_app as create_corpus_app
    return create_corpus_app(*args, **kwargs)

__all__ = ["create_app"]
