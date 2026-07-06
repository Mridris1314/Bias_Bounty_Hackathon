FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HF_HOME=/app/.hf_cache

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# Ingest regulations into local Chroma at BUILD time, baked into the image,
# rather than at container startup. This step loads a torch-based embedding
# model, which combined with the FastAPI/CrewAI process easily exceeds a
# free-tier runtime instance's RAM (512MB on Render) if done at boot —
# Render's build step has more headroom, and the persisted Chroma data
# survives as an image layer, so subsequent restarts don't repeat this work.
# Only runs against local Chroma (no QDRANT_URL at build time); if deploying
# with a Qdrant Cloud cluster, ingest against it separately per the README.
RUN python -m rag.ingest

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -fsS http://localhost:${PORT:-8000}/health || exit 1

CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1
