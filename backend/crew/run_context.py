"""In-memory per-run context registry.

Purpose: keep target API keys OUT of task descriptions (which get sent to the
crew LLM as prompts). Tools look up credentials by run_id at execution time
rather than receiving them as agent-visible arguments.
"""
from __future__ import annotations

import threading
from dataclasses import dataclass, field
from typing import Any

_lock = threading.Lock()
_ctx: dict[str, "RunContext"] = {}
# Thread-local for the "current" run so tools called from CrewAI's worker
# thread can find their context without agents having to pass IDs around.
_current: threading.local = threading.local()


@dataclass
class RunContext:
    run_id: str
    target_base_url: str
    target_model: str
    target_api_key: str
    dimensions: list[str]
    context_domain: str
    jurisdictions: list[str]
    # Populated by counterfactual engine, consumed by prober
    prompt_battery: list[dict[str, Any]] = field(default_factory=list)
    # Populated by prober, consumed by analyst
    probe_results: list[dict[str, Any]] = field(default_factory=list)
    # Populated by analyst, consumed by mapper/composer
    metrics: dict[str, Any] = field(default_factory=dict)
    evidence: dict[str, list[dict]] = field(default_factory=dict)
    # Cost tracking
    total_tokens_in: int = 0
    total_tokens_out: int = 0


def register(ctx: RunContext) -> None:
    with _lock:
        _ctx[ctx.run_id] = ctx


def get(run_id: str) -> RunContext | None:
    with _lock:
        return _ctx.get(run_id)


def drop(run_id: str) -> None:
    with _lock:
        _ctx.pop(run_id, None)
    if getattr(_current, "run_id", None) == run_id:
        _current.run_id = None


def set_current(run_id: str) -> None:
    _current.run_id = run_id


def current() -> RunContext | None:
    rid = getattr(_current, "run_id", None)
    return get(rid) if rid else None
