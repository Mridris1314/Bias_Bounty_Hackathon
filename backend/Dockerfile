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

RUN mkdir -p /app/data/chroma

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -fsS http://localhost:${PORT:-8000}/health || exit 1

# Ingest regulations at container start (idempotent), then serve. Embeddings
# are now a remote API call (GEMINI_API_KEY), not a local model, so this no
# longer risks the OOM that motivated doing it at build time — and doing it
# at build time isn't an option now anyway, since the API key isn't
# available in the Docker build environment.
CMD python -m rag.ingest && \
    uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1
