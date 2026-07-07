"""One-shot corpus ingestion into Qdrant/Chroma.

Reads all .md files from backend/data/regulations/, splits, embeds, upserts.

Each regulation file must have a YAML-ish front matter block delimited by `---`
and containing `jurisdiction`, `regulation`. Each clause is a `## <clause_id>`
heading whose body is the clause text.
"""
from __future__ import annotations

import os
import re
import sys
import uuid
from pathlib import Path
from typing import Iterable

# Allow running: python -m rag.ingest
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from langchain_text_splitters import RecursiveCharacterTextSplitter

from config import get_settings

REGS_DIR = Path(__file__).resolve().parent.parent / "data" / "regulations"


def parse_regulation_file(path: Path) -> list[dict]:
    text = path.read_text(encoding="utf-8")
    front, _, body = text.partition("---\n")
    # allow leading '---\n' too
    if front.strip() == "":
        front, _, body = body.partition("---\n")
    meta = {}
    for line in front.splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            meta[k.strip()] = v.strip()

    clauses = []
    current_clause = None
    current_lines: list[str] = []
    for line in body.splitlines():
        m = re.match(r"^##\s+(.+)$", line)
        if m:
            if current_clause:
                clauses.append({"clause": current_clause, "body": "\n".join(current_lines).strip()})
            current_clause = m.group(1).strip()
            current_lines = []
        else:
            current_lines.append(line)
    if current_clause:
        clauses.append({"clause": current_clause, "body": "\n".join(current_lines).strip()})

    docs = []
    for c in clauses:
        docs.append({
            "jurisdiction": meta.get("jurisdiction", "?"),
            "regulation": meta.get("regulation", path.stem),
            "clause": c["clause"],
            "topic": [t.strip() for t in meta.get("topic", "").split(",") if t.strip()],
            "text": c["body"],
        })
    return docs


def chunk_docs(docs: Iterable[dict]) -> list[dict]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=100,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    out = []
    for d in docs:
        for i, chunk in enumerate(splitter.split_text(d["text"])):
            out.append({
                "id": f"{d['regulation']}::{d['clause']}::{i}",
                "text": chunk,
                "jurisdiction": d["jurisdiction"],
                "regulation": d["regulation"],
                "clause": d["clause"],
                "topic": d["topic"],
            })
    return out


def ingest_qdrant(chunks: list[dict]) -> None:
    from qdrant_client import QdrantClient
    from qdrant_client.models import Distance, PointStruct, VectorParams

    from rag.embeddings import embed_texts

    settings = get_settings()
    client = QdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key or None)
    embeddings = embed_texts([c["text"] for c in chunks])
    dim = len(embeddings[0])

    client.recreate_collection(
        collection_name=settings.qdrant_collection,
        vectors_config=VectorParams(size=dim, distance=Distance.COSINE),
    )

    points = [
        PointStruct(
            id=str(uuid.uuid5(uuid.NAMESPACE_URL, c["id"])),
            vector=emb,
            payload={
                "jurisdiction": c["jurisdiction"],
                "regulation": c["regulation"],
                "clause": c["clause"],
                "topic": c["topic"],
                "excerpt": c["text"],
            },
        )
        for c, emb in zip(chunks, embeddings)
    ]
    client.upsert(collection_name=settings.qdrant_collection, points=points)
    print(f"[ingest] Upserted {len(points)} chunks into Qdrant collection "
          f"'{settings.qdrant_collection}'.")


def ingest_chroma(chunks: list[dict]) -> None:
    import chromadb

    from rag.embeddings import embed_texts

    settings = get_settings()
    os.makedirs(settings.chroma_persist_dir, exist_ok=True)
    client = chromadb.PersistentClient(path=settings.chroma_persist_dir)
    try:
        client.delete_collection(settings.qdrant_collection)
    except Exception:
        pass
    collection = client.create_collection(settings.qdrant_collection)

    embeddings = embed_texts([c["text"] for c in chunks])

    collection.add(
        ids=[str(uuid.uuid5(uuid.NAMESPACE_URL, c["id"])) for c in chunks],
        embeddings=embeddings,
        documents=[c["text"] for c in chunks],
        metadatas=[
            {
                "jurisdiction": c["jurisdiction"],
                "regulation": c["regulation"],
                "clause": c["clause"],
                "topic": ",".join(c["topic"]),
            }
            for c in chunks
        ],
    )
    print(f"[ingest] Upserted {len(chunks)} chunks into Chroma collection "
          f"'{settings.qdrant_collection}' at {settings.chroma_persist_dir}.")


def main() -> None:
    all_docs = []
    for md in sorted(REGS_DIR.glob("*.md")):
        docs = parse_regulation_file(md)
        all_docs.extend(docs)
        print(f"[ingest] Parsed {len(docs)} clauses from {md.name}")
    chunks = chunk_docs(all_docs)
    print(f"[ingest] Generated {len(chunks)} chunks total.")

    settings = get_settings()
    if settings.qdrant_url:
        ingest_qdrant(chunks)
    else:
        ingest_chroma(chunks)


if __name__ == "__main__":
    main()
