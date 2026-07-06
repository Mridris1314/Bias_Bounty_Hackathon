"""Crew orchestrator: runs the 5-agent audit and emits SSE events.

v2 changes:
  * Uses RunContext so target API keys never enter LLM prompts.
  * Fixes the task-callback race by capturing the running loop up front.
  * Adds an auto-remediation snippet to every finished report.
"""
from __future__ import annotations

import asyncio
import json
import re
import time
import traceback
from datetime import datetime
from typing import Any

from crewai import Crew, Process

from config import get_settings
from crew.agents import build_agents
from crew.run_context import RunContext, drop, register, set_current
from crew.tasks import build_tasks
from crew.tools import build_system_prompt_patch, build_tools

_settings = get_settings()

_run_queues: dict[str, asyncio.Queue] = {}
_run_results: dict[str, dict[str, Any]] = {}

# Steps 1-3 invoke exactly one tool each with fixed, deterministic arguments —
# there's no judgment call for an LLM to make, so they run as direct Python
# calls (no API call, no rate-limit exposure, no ReAct-format flakiness).
# Only steps 4-5 need real language reasoning and go through an LLM agent.
DETERMINISTIC_STEPS = [
    ("test_generator", "Test Case Generator"),
    ("adversarial_prober", "Adversarial Prober"),
    ("response_analyst", "Statistical Bias Analyst"),
]
LLM_STEPS = [
    ("regulation_mapper", "Regulation Mapper"),
    ("audit_composer", "Audit Composer"),
]
AGENT_ORDER = DETERMINISTIC_STEPS + LLM_STEPS


def get_or_create_queue(run_id: str) -> asyncio.Queue:
    if run_id not in _run_queues:
        _run_queues[run_id] = asyncio.Queue(maxsize=400)
    return _run_queues[run_id]


def get_result(run_id: str) -> dict[str, Any] | None:
    return _run_results.get(run_id)


async def emit(run_id: str, event: str, payload: dict[str, Any]) -> None:
    q = get_or_create_queue(run_id)
    await q.put({"event": event, "data": payload, "ts": time.time()})


def _extract_json(text: str) -> dict[str, Any]:
    if not text:
        return {}
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return {}
    try:
        return json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return {}


def _grade_from_score(score: float) -> str:
    if score >= 90:
        return "A"
    if score >= 80:
        return "B"
    if score >= 70:
        return "C"
    if score >= 60:
        return "D"
    return "F"


async def run_audit(
    run_id: str,
    name: str,
    target_base_url: str,
    target_model: str,
    target_api_key: str,
    dimensions: list[str],
    context_domain: str,
    jurisdictions: list[str],
) -> dict[str, Any]:
    started = time.time()

    # Register run context — tools will look this up rather than get creds via args
    ctx = RunContext(
        run_id=run_id,
        target_base_url=target_base_url,
        target_model=target_model,
        target_api_key=target_api_key,
        dimensions=dimensions,
        context_domain=context_domain,
        jurisdictions=jurisdictions,
    )
    register(ctx)
    set_current(run_id)

    crew_provider = _settings.crew_llm_model.split("/", 1)[0]
    await emit(run_id, "run_started", {
        "run_id": run_id,
        "name": name,
        "target_model": target_model,
        "dimensions": dimensions,
        "provider": crew_provider,
        "started_at": datetime.utcnow().isoformat(),
    })

    try:
        loop = asyncio.get_running_loop()
        tools = build_tools()

        def _on_run_thread(fn, /, **kwargs):
            # These tool calls run via run_in_executor on a fresh worker
            # thread, not the event-loop thread that called set_current()
            # above — the "current run" pointer is thread-local, so each
            # wrapped call has to set it again on its own thread.
            def _wrapped():
                set_current(run_id)
                return fn(**kwargs)
            return _wrapped

        # Steps 1-3: deterministic tool calls, no LLM involved.
        for step_idx, (_, label) in enumerate(DETERMINISTIC_STEPS, start=1):
            await emit(run_id, "agent_queued", {"step": step_idx, "agent": label})

        battery_json = await loop.run_in_executor(None, _on_run_thread(
            tools["cf_battery"]._run,
            dimensions=dimensions,
            context_domain=context_domain,
            per_group_prompts=_settings.max_prompts_per_dimension,
        ))
        if not ctx.prompt_battery:
            raise RuntimeError("Counterfactual battery generation produced no prompts.")
        await emit(run_id, "agent_completed", {
            "step": 1, "agent": DETERMINISTIC_STEPS[0][1], "output_preview": battery_json[:400],
        })

        probe_json = await loop.run_in_executor(None, _on_run_thread(
            tools["prober"]._run, limit=0,
        ))
        await emit(run_id, "agent_completed", {
            "step": 2, "agent": DETERMINISTIC_STEPS[1][1], "output_preview": probe_json[:400],
        })

        metrics_json = await loop.run_in_executor(None, _on_run_thread(
            tools["metrics"]._run,
        ))
        await emit(run_id, "agent_completed", {
            "step": 3, "agent": DETERMINISTIC_STEPS[2][1], "output_preview": metrics_json[:400],
        })

        # Steps 4-5: the only steps that need real language reasoning.
        agents = build_agents()
        tasks = build_tasks(
            agents=agents,
            dimensions=dimensions,
            context_domain=context_domain,
            jurisdictions=jurisdictions,
            metrics_matrix=ctx.metrics,
        )

        for step_idx, (_, label) in enumerate(LLM_STEPS, start=len(DETERMINISTIC_STEPS) + 1):
            await emit(run_id, "agent_queued", {"step": step_idx, "agent": label})

        crew = Crew(
            agents=[agents[k] for k, _ in LLM_STEPS],
            tasks=tasks,
            process=Process.sequential,
            verbose=True,
        )

        step_state = {"current": len(DETERMINISTIC_STEPS)}

        def _task_callback(output):
            step_state["current"] += 1
            idx = step_state["current"] - 1
            if idx < len(AGENT_ORDER):
                label = AGENT_ORDER[idx][1]
                preview = str(getattr(output, "raw", "") or output)[:400]
                fut = asyncio.run_coroutine_threadsafe(
                    emit(run_id, "agent_completed", {
                        "step": idx + 1,
                        "agent": label,
                        "output_preview": preview,
                    }),
                    loop,
                )
                # Don't block agent thread on the queue; drop if it stalls
                try:
                    fut.result(timeout=2)
                except Exception:
                    pass
            # Pace cloud LLM calls so token usage spreads across the
            # provider's rolling per-minute window instead of bursting both
            # calls within a few seconds of each other.
            if crew_provider != "ollama" and step_state["current"] < len(AGENT_ORDER):
                time.sleep(_settings.inter_agent_pacing_s)

        for task in tasks:
            task.callback = _task_callback

        def _kickoff():
            # crew.kickoff() runs on a ThreadPoolExecutor worker thread, not
            # the event-loop thread that called set_current() above. The
            # "current run" pointer is thread-local so tool calls made from
            # inside kickoff() need it set again here, on this thread.
            set_current(run_id)
            return crew.kickoff()

        attempts = _settings.max_retries if _settings.enable_retry else 1
        result = None
        last_error = None
        for attempt in range(attempts):
            try:
                result = await loop.run_in_executor(None, _kickoff)
                break
            except Exception as e:
                last_error = e
                # A retry restarts crew.kickoff() from its first task (the
                # regulation mapper), so the step counter resets to just
                # after the deterministic steps, not all the way to 0 —
                # those already ran once and aren't part of the retry.
                step_state["current"] = len(DETERMINISTIC_STEPS)
                if attempt == attempts - 1:
                    break
                err_str = str(e)
                m = re.search(r"try again in (\d+(?:\.\d+)?)s", err_str)
                wait_seconds = float(m.group(1)) + 2 if m else 15 * (attempt + 1)
                if "RateLimitError" in err_str or "rate_limit" in err_str:
                    # A retry here re-runs crew.kickoff() from scratch (CrewAI's
                    # sequential process has no per-task resume), which redoes
                    # every already-completed step's LLM calls too. The
                    # "try again in Xs" hint only covers the marginal overage
                    # from the last call, not the full token budget a from-
                    # scratch retry needs, so floor the wait well above it.
                    wait_seconds = max(wait_seconds, 50)
                wait_seconds = min(wait_seconds, 60)
                print(f"[orchestrator] Attempt {attempt + 1} failed: {err_str[:120]}. "
                      f"Waiting {wait_seconds:.0f}s...")
                await emit(run_id, "retry_wait", {
                    "attempt": attempt + 1,
                    "wait_seconds": int(wait_seconds),
                    "reason": "Rate limit or transient error",
                })
                await asyncio.sleep(wait_seconds)

        if result is None:
            raise last_error or RuntimeError("Crew execution failed after retries")

        # Findings always come from the mapper's own output, not from the
        # composer retyping them — asking the composer to echo back
        # potentially several findings (each with regulation excerpts and
        # evidence text) risked it truncating its own JSON before closing,
        # which is exactly what happened in testing. The composer now only
        # contributes the top-level verdict (score/grade/summary/actions).
        mapper_text = ""
        composer_text = ""
        if hasattr(result, "tasks_output") and result.tasks_output:
            mapper_text = str(result.tasks_output[0].raw)
            composer_text = str(result.tasks_output[-1].raw)
        elif hasattr(result, "raw"):
            composer_text = result.raw
        else:
            composer_text = str(result)

        findings = _extract_json(mapper_text).get("findings", [])

        def _fallback_score(findings: list[dict]) -> float:
            score = 100.0
            for f in findings:
                sev = str(f.get("severity", "")).lower()
                score -= {"critical": 35, "high": 20, "medium": 10, "low": 4}.get(sev, 0)
            return max(0.0, score)

        report = _extract_json(composer_text)
        if not report or "overall_score" not in report:
            # The composer's JSON didn't parse (or is missing fields) — most
            # likely truncated. Derive a reasonable verdict from the
            # findings' severities rather than emitting an empty report.
            score = _fallback_score(findings)
            report = {
                "overall_score": score,
                "grade": _grade_from_score(score),
                "executive_summary": (
                    "The audit composer's output could not be parsed, so this "
                    "verdict was derived directly from the findings' severities."
                ),
                "top_actions": [f["recommendation"] for f in findings if f.get("recommendation")],
            }
        report["findings"] = findings

        # Pull metrics + evidence from the run context (populated by tools)
        matrix = ctx.metrics
        evidence = ctx.evidence
        prompts_run = len(ctx.probe_results)

        findings = _attach_evidence(report.get("findings", []), evidence)

        dims_with_findings = sorted({f.get("dimension") for f in findings
                                     if f.get("dimension") and str(f.get("severity", "")).lower()
                                     not in {"info", ""}})
        remediation_snippet = build_system_prompt_patch(dims_with_findings)

        final_report = {
            "run_id": run_id,
            "target_model": target_model,
            "overall_score": float(report.get("overall_score", 0) or 0),
            "grade": report.get("grade", "?"),
            "executive_summary": report.get("executive_summary", ""),
            "findings": findings,
            "top_actions": report.get("top_actions", []),
            "metrics_matrix": matrix,
            "remediation_snippet": remediation_snippet,
            "generated_at": datetime.utcnow().isoformat(),
            "prompts_run": prompts_run,
            "duration_s": round(time.time() - started, 1),
        }

        _run_results[run_id] = final_report
        await emit(run_id, "run_completed", final_report)
        return final_report

    except Exception as e:
        tb = traceback.format_exc()
        print(f"[orchestrator] Audit {run_id} failed:\n{tb}")
        payload = {
            "run_id": run_id,
            "error": str(e)[:400],
            "traceback": tb[-800:],
        }
        _run_results[run_id] = {"error": str(e)[:400]}
        await emit(run_id, "run_failed", payload)
        return payload
    finally:
        # Purge credentials from memory
        drop(run_id)


def _attach_evidence(findings: list[dict], evidence: dict) -> list[dict]:
    for f in findings:
        dim = f.get("dimension")
        if dim in evidence:
            f["evidence_examples"] = evidence[dim][:4]
    return findings
