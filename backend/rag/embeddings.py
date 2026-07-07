"""Remote embedding calls via the Gemini embeddings API.

Deliberately NOT a local model (sentence-transformers/fastembed): loading
an embedding model into this process was the single largest memory spike
in the app, and on a memory-constrained deploy (Render's free tier caps
runtime RAM at 512MB) it was pushing the process over the cap and
crashing mid-audit. A remote API call has ~0 memory cost by comparison —
verified directly against the live API (a local model added ~180MB, this
call added none).
"""
from __future__ import annotations

import litellm

from config import get_settings


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts, in the same order as given."""
    settings = get_settings()
    resp = litellm.embedding(
        model=f"gemini/{settings.embedding_model}",
        input=texts,
        api_key=settings.gemini_api_key,
    )
    return [d["embedding"] for d in resp.data]


def embed_query(text: str) -> list[float]:
    return embed_texts([text])[0]
