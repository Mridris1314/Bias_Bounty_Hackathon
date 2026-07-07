"""Application configuration via environment variables."""
from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- App ---
    app_name: str = "BiasBounty"
    app_env: Literal["dev", "prod"] = "dev"
    api_prefix: str = "/api/v1"
    cors_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]
    )

    # --- LLM (crew brain, NOT the audit target) ---
    groq_api_key: str = ""
    gemini_api_key: str = ""
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    ollama_base_url: str = "http://localhost:11434"
    crew_llm_model: str = "ollama/llama3.2:3b"
    enable_retry: bool = True
    max_retries: int = 3
    # Pause between sequential agent steps for cloud LLM providers so token
    # usage spreads across the provider's rolling per-minute rate-limit
    # window instead of bursting all 5 agents' calls into a few seconds.
    inter_agent_pacing_s: int = 10

    # --- Vector DB ---
    # If qdrant_url is empty, we fall back to local Chroma
    qdrant_url: str = ""
    qdrant_api_key: str = ""
    qdrant_collection: str = "regulations"
    chroma_persist_dir: str = "./data/chroma"

    # --- Embeddings ---
    # Called remotely via the Gemini embeddings API (gemini_api_key) rather
    # than loading a model into this process — on a memory-constrained
    # deploy (Render's free tier caps runtime RAM at 512MB), a local
    # embedding model was the single largest memory spike in the app,
    # pushing the process over the cap and crashing mid-audit.
    embedding_model: str = "gemini-embedding-001"

    # --- Storage ---
    sqlite_url: str = "sqlite:///./data/biasbounty.db"

    # --- Audit runtime ---
    max_prompts_per_dimension: int = 4
    request_timeout_s: int = 30
    max_concurrent_probes: int = 6


@lru_cache
def get_settings() -> Settings:
    return Settings()
