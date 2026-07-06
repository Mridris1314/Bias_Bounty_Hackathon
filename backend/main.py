"""BiasBounty FastAPI application."""
from __future__ import annotations

import asyncio
import json
import os
import uuid
from datetime import datetime
from typing import AsyncGenerator

from fastapi import BackgroundTasks, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse
from sqlmodel import Session, SQLModel, create_engine, select

from config import get_settings
from crew.agents import _PROVIDER_KEYS
from crew.orchestrator import get_or_create_queue, get_result, run_audit
from models import AuditRequest, AuditResponse, AuditRun, RunStatus

settings = get_settings()


def _crew_llm_key_missing() -> bool:
    model = settings.crew_llm_model
    if model.startswith("ollama/"):
        return False
    for prefix, get_key in _PROVIDER_KEYS.items():
        if model.startswith(prefix):
            return not get_key(settings)
    return True

os.makedirs("./data", exist_ok=True)
engine = create_engine(settings.sqlite_url, connect_args={"check_same_thread": False})
SQLModel.metadata.create_all(engine)

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="Meta-agentic AI compliance auditor. Point at any LLM API, get a regulator-grade bias audit.",
)

_cors_origins = ["*"] if settings.app_env == "dev" else settings.cors_origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=False if "*" in _cors_origins else True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------------------- Health --------------------

@app.get("/health")
def health():
    return {"status": "ok", "app": settings.app_name, "time": datetime.utcnow().isoformat()}


# -------------------- Create audit --------------------

@app.post(f"{settings.api_prefix}/audits", response_model=AuditResponse, status_code=202)
async def create_audit(req: AuditRequest, background: BackgroundTasks):
    if _crew_llm_key_missing():
        raise HTTPException(
            500, f"Server missing API key for crew LLM provider in {settings.crew_llm_model!r}."
        )
    is_local_target = (
        req.target.provider == "ollama"
        or req.target.base_url.startswith("http://localhost")
        or req.target.base_url.startswith("http://127.0.0.1")
    )
    if not req.target.api_key and not is_local_target:
        raise HTTPException(400, "Target API key is required.")

    run_id = uuid.uuid4().hex[:12]

    # Persist run record (but NOT the API key)
    with Session(engine) as s:
        s.add(AuditRun(
            id=run_id,
            name=req.name,
            target_model=req.target.model,
            target_provider=req.target.provider,
            dimensions=[d.value for d in req.dimensions],
            context_domain=req.context_domain,
            jurisdictions=req.jurisdictions,
            status=RunStatus.QUEUED,
        ))
        s.commit()

    # Kick off orchestrator in background
    background.add_task(
        _run_and_persist,
        run_id=run_id,
        name=req.name,
        target_base_url=req.target.base_url,
        target_model=req.target.model,
        target_api_key=req.target.api_key,
        dimensions=[d.value for d in req.dimensions],
        context_domain=req.context_domain,
        jurisdictions=req.jurisdictions,
    )

    return AuditResponse(
        id=run_id,
        status=RunStatus.RUNNING,
        created_at=datetime.utcnow(),
        stream_url=f"{settings.api_prefix}/audits/{run_id}/stream",
    )


async def _run_and_persist(run_id: str, **kwargs) -> None:
    with Session(engine) as s:
        run = s.get(AuditRun, run_id)
        if run:
            run.status = RunStatus.RUNNING
            s.add(run)
            s.commit()

    result = await run_audit(run_id=run_id, **kwargs)

    with Session(engine) as s:
        run = s.get(AuditRun, run_id)
        if run:
            run.status = RunStatus.FAILED if result.get("error") else RunStatus.COMPLETED
            run.completed_at = datetime.utcnow()
            run.report = result
            run.error = result.get("error")
            s.add(run)
            s.commit()


# -------------------- List / get / stream --------------------

@app.get(f"{settings.api_prefix}/audits")
def list_audits(limit: int = 20):
    with Session(engine) as s:
        runs = s.exec(
            select(AuditRun).order_by(AuditRun.created_at.desc()).limit(limit)
        ).all()
        return [{
            "id": r.id,
            "name": r.name,
            "target_model": r.target_model,
            "status": r.status,
            "created_at": r.created_at.isoformat(),
            "grade": (r.report or {}).get("grade"),
            "overall_score": (r.report or {}).get("overall_score"),
        } for r in runs]


@app.get(f"{settings.api_prefix}/audits/{{run_id}}")
def get_audit(run_id: str):
    with Session(engine) as s:
        run = s.get(AuditRun, run_id)
        if not run:
            raise HTTPException(404, "Audit not found")
        return {
            "id": run.id,
            "name": run.name,
            "target_model": run.target_model,
            "status": run.status,
            "dimensions": run.dimensions,
            "jurisdictions": run.jurisdictions,
            "created_at": run.created_at.isoformat(),
            "completed_at": run.completed_at.isoformat() if run.completed_at else None,
            "report": run.report,
            "error": run.error,
        }


@app.get(f"{settings.api_prefix}/audits/{{run_id}}/stream")
async def stream_audit(run_id: str, request: Request):
    queue = get_or_create_queue(run_id)

    async def event_gen() -> AsyncGenerator[dict, None]:
        # Emit a hello ping so the client's onopen fires immediately
        yield {"event": "hello", "data": json.dumps({"run_id": run_id})}
        while True:
            if await request.is_disconnected():
                break
            try:
                item = await asyncio.wait_for(queue.get(), timeout=25.0)
            except asyncio.TimeoutError:
                # Keep-alive comment
                yield {"event": "ping", "data": json.dumps({"t": datetime.utcnow().isoformat()})}
                continue
            yield {
                "event": item["event"],
                "data": json.dumps(item["data"]),
            }
            if item["event"] in {"run_completed", "run_failed"}:
                break

    return EventSourceResponse(event_gen())


# -------------------- Replay (placeholder) --------------------

@app.post(f"{settings.api_prefix}/audits/{{run_id}}/replay")
async def replay_audit(run_id: str, background: BackgroundTasks):
    with Session(engine) as s:
        run = s.get(AuditRun, run_id)
        if not run:
            raise HTTPException(404, "Audit not found")
    # Target API keys are never persisted, so a prior run's config can't be
    # replayed server-side. Caller must resubmit via POST /audits.
    raise HTTPException(
        400,
        "Replay requires re-submitting API key. Use POST /audits with the same config.",
    )


# -------------------- Public shareable report --------------------

@app.get(f"{settings.api_prefix}/audits/{{run_id}}/public")
def public_report(run_id: str):
    """Sanitised, publicly shareable audit view.

    Returns only fields safe for a public share link. No API keys, no full
    prompts (prompt previews only), no traceback. Suitable for board or
    regulator review URLs.
    """
    with Session(engine) as s:
        run = s.get(AuditRun, run_id)
        if not run or not run.report:
            raise HTTPException(404, "Report not available.")
        r = dict(run.report)
        # Drop anything that might leak evidence prompts wholesale
        findings = []
        for f in r.get("findings", []):
            ff = dict(f)
            ev = ff.get("evidence_examples") or []
            ff["evidence_examples"] = [
                {"group": e.get("group"), "prompt": (e.get("prompt") or "")[:160],
                 "response": (e.get("response") or "")[:220]}
                for e in ev
            ]
            findings.append(ff)
        r["findings"] = findings
        return {
            "id": run.id,
            "name": run.name,
            "target_model": run.target_model,
            "created_at": run.created_at.isoformat(),
            "completed_at": run.completed_at.isoformat() if run.completed_at else None,
            "report": r,
        }


# -------------------- Report PDF --------------------

@app.get(f"{settings.api_prefix}/audits/{{run_id}}/report.pdf")
def download_report(run_id: str):
    with Session(engine) as s:
        run = s.get(AuditRun, run_id)
        if not run or not run.report:
            raise HTTPException(404, "Report not available.")
    from services.pdf_report import render_pdf
    pdf_bytes = render_pdf(run.report, run.name, run.target_model)
    from fastapi.responses import Response
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="biasbounty-{run_id}.pdf"'},
    )


# -------------------- Root --------------------

@app.get("/")
def root():
    return {
        "app": "BiasBounty",
        "docs": "/docs",
        "health": "/health",
        "endpoints": {
            "create_audit": f"POST {settings.api_prefix}/audits",
            "list_audits": f"GET {settings.api_prefix}/audits",
            "stream": f"GET {settings.api_prefix}/audits/{{run_id}}/stream",
            "report_pdf": f"GET {settings.api_prefix}/audits/{{run_id}}/report.pdf",
        },
    }
