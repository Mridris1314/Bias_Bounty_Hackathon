"""Pydantic + SQLModel schemas."""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field
from sqlmodel import JSON, Column, Field as SQLField, SQLModel


# ---------- Enums ----------

class Dimension(str, Enum):
    GENDER = "gender"
    CASTE = "caste"
    ETHNICITY = "ethnicity"
    RELIGION = "religion"
    DISABILITY = "disability"
    REGION = "region"
    AGE = "age"


class RunStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class Severity(str, Enum):
    INFO = "info"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


# ---------- API request/response ----------

class TargetConfig(BaseModel):
    """Configuration for the LLM being audited."""
    provider: str = Field(description="e.g. 'groq', 'openai', 'anthropic', 'custom'")
    base_url: str = Field(description="OpenAI-compatible base URL")
    model: str = Field(description="Model identifier at the target")
    api_key: str = Field(description="Target API key — held in-memory only, never logged")
    temperature: float = 0.2
    max_tokens: int = 256


class AuditRequest(BaseModel):
    name: str = Field(default="Untitled audit", max_length=120)
    target: TargetConfig
    dimensions: list[Dimension] = Field(min_length=1, max_length=7)
    context_domain: str = Field(
        default="general",
        description="Domain of audit: 'hiring', 'lending', 'healthcare', 'general', etc.",
    )
    jurisdictions: list[str] = Field(
        default_factory=lambda: ["EU", "US", "IN"],
        description="Jurisdictions whose regulations should be checked.",
    )


class AuditResponse(BaseModel):
    id: str
    status: RunStatus
    created_at: datetime
    stream_url: str


class Finding(BaseModel):
    id: str
    dimension: Dimension
    severity: Severity
    title: str
    summary: str
    evidence_examples: list[dict[str, str]] = Field(default_factory=list)
    metrics: dict[str, float] = Field(default_factory=dict)
    regulations: list[dict[str, str]] = Field(
        default_factory=list,
        description="Each item: {jurisdiction, regulation, clause, excerpt}",
    )
    recommendation: str


class AuditReport(BaseModel):
    run_id: str
    target_model: str
    overall_score: float = Field(description="0–100, higher = safer")
    grade: str = Field(description="A/B/C/D/F")
    findings: list[Finding]
    metrics_matrix: dict[str, dict[str, float]] = Field(
        description="dimension -> {parity_gap, sentiment_delta, refusal_skew, stereotype_score}"
    )
    generated_at: datetime
    prompts_run: int


# ---------- Persistence ----------

class AuditRun(SQLModel, table=True):
    id: str = SQLField(primary_key=True)
    name: str
    target_model: str
    target_provider: str
    dimensions: list[str] = SQLField(sa_column=Column(JSON))
    context_domain: str
    jurisdictions: list[str] = SQLField(sa_column=Column(JSON))
    status: RunStatus = SQLField(default=RunStatus.QUEUED)
    created_at: datetime = SQLField(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    report: Optional[dict[str, Any]] = SQLField(default=None, sa_column=Column(JSON))
    error: Optional[str] = None
