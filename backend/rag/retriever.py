"""Runtime RAG retriever — Qdrant preferred, Chroma fallback."""
from __future__ import annotations

import os
from typing import Any

from config import get_settings
from rag.embeddings import embed_query


class RegulationRetriever:
    """Retrieves regulation clauses. Backend-agnostic (Qdrant or Chroma)."""

    def __init__(self):
        self.settings = get_settings()
        self._backend = None
        self._init_backend()

    # ------------------------------------------------------------------
    def _init_backend(self) -> None:
        if self.settings.qdrant_url:
            try:
                from qdrant_client import QdrantClient
                self._backend = ("qdrant", QdrantClient(
                    url=self.settings.qdrant_url,
                    api_key=self.settings.qdrant_api_key or None,
                ))
                return
            except Exception as e:
                print(f"[retriever] Qdrant unreachable ({e}); falling back to Chroma")
        # Chroma fallback
        import chromadb
        os.makedirs(self.settings.chroma_persist_dir, exist_ok=True)
        client = chromadb.PersistentClient(path=self.settings.chroma_persist_dir)
        self._backend = ("chroma", client)

    # ------------------------------------------------------------------
    def search(
        self,
        query: str,
        jurisdictions: list[str],
        top_k: int = 4,
    ) -> list[dict[str, Any]]:
        # Corpus metadata is ingested with upper-case jurisdiction codes
        # (EU, US, IN, INT). Both backends' filters are case-sensitive, so a
        # caller passing "eu" instead of "EU" would silently get zero hits
        # rather than an error — normalise instead of trusting caller casing.
        jurisdictions = [j.upper() for j in jurisdictions] if jurisdictions else jurisdictions
        embed = embed_query(query)

        kind, client = self._backend
        if kind == "qdrant":
            from qdrant_client.models import Filter, FieldCondition, MatchAny
            flt = Filter(
                must=[FieldCondition(
                    key="jurisdiction", match=MatchAny(any=jurisdictions)
                )]
            ) if jurisdictions else None
            try:
                results = client.query_points(
                    collection_name=self.settings.qdrant_collection,
                    query=embed,
                    limit=top_k,
                    query_filter=flt,
                ).points
                return [self._format_hit(p.payload, p.score) for p in results]
            except Exception as e:
                print(f"[retriever] Qdrant query failed: {e}")
                return []
        else:
            collection = client.get_or_create_collection(
                self.settings.qdrant_collection
            )
            where = {"jurisdiction": {"$in": jurisdictions}} if jurisdictions else None
            try:
                res = collection.query(
                    query_embeddings=[embed],
                    n_results=top_k,
                    where=where,
                )
                out = []
                if res["ids"] and res["ids"][0]:
                    for i, doc_id in enumerate(res["ids"][0]):
                        meta = res["metadatas"][0][i] or {}
                        meta["excerpt"] = res["documents"][0][i]
                        score = 1.0 - float(res["distances"][0][i]) if res.get("distances") else 0.5
                        out.append(self._format_hit(meta, score))
                return out
            except Exception as e:
                print(f"[retriever] Chroma query failed: {e}")
                return []

    @staticmethod
    def _format_hit(payload: dict, score: float) -> dict[str, Any]:
        return {
            "jurisdiction": payload.get("jurisdiction", "?"),
            "regulation": payload.get("regulation", "?"),
            "clause": payload.get("clause", "?"),
            "topic": payload.get("topic", []),
            "excerpt": payload.get("excerpt", "")[:800],
            "score": round(float(score), 3),
        }
