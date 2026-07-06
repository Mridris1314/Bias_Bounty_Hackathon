<div align="center">

# BiasBounty

**Point at any LLM API. Get the audit regulators want.**

A meta-agentic AI compliance auditor built with CrewAI, RAG on
EU AI Act + NIST AI RMF + ISO 42001 + India MeitY advisories, and a
Next.js control-room dashboard.

</div>

---

## What it does

Give BiasBounty any OpenAI-compatible LLM endpoint. It runs a five-agent
CrewAI investigation:

1. **Counterfactual Battery Curator** — generates a deterministic minimal-pair
   prompt battery (CrowS-Pairs / BBQ methodology, not ad-hoc LLM prompts).
2. **Adversarial Prober** — executes the battery against the target model.
3. **Statistical Bias Analyst** — computes parity gap, sentiment delta,
   refusal skew, stereotype score, and paired flip rate, each with a
   **bootstrap 95% confidence interval**.
4. **Regulation Mapper** — retrieves specific clauses from EU AI Act,
   NIST AI RMF, ISO 42001, and India's MeitY advisory / DPDP Act via RAG.
5. **Audit Composer** — ships a regulator-grade PDF with severity-ranked
   findings, citations, and a **copy-pasteable system prompt patch** that
   mitigates the specific disparities found.

Everything streams live to the dashboard via SSE.

## Why it's different

- **Meta-agentic**: it's AI auditing AI, in a market with active EU AI
  Act enforcement.
- **Counterfactual minimal pairs**, not ad-hoc prompts — findings are
  reproducible.
- **Bootstrap confidence intervals** on every metric, not point estimates.
- **Auto-remediation**: the audit ships with an actual fix, not just a
  citation.
- **Runs on ₹0**: Groq free tier, Qdrant Cloud free tier (Chroma fallback),
  Vercel + Render free tiers.

---

## Local setup

### Prerequisites
- Python 3.11+
- Node 20+
- A **free** Gemini API key from https://aistudio.google.com (this powers the
  crew — validated more reliable than Groq's free tier for this pipeline's
  tool-calling; Groq and local Ollama are also supported, see `.env.example`)
- Optional: a **free** Qdrant Cloud cluster from https://cloud.qdrant.io
  (if omitted, we fall back to local Chroma automatically)

### 1. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Open .env and set GEMINI_API_KEY (mandatory), QDRANT_URL/QDRANT_API_KEY (optional)

# One-time: embed the regulation corpus
python -m rag.ingest

# Run the API
uvicorn main:app --reload --port 8000
```

Sanity check: `curl http://localhost:8000/health`.

### 2. Frontend

```bash
cd ../frontend
cp .env.local.example .env.local            # points at http://localhost:8000
npm install
npm run dev
```

Open http://localhost:3000, click **Start audit**, paste any OpenAI-compatible
target (a second Groq model works great for demo), and go.

---

## Deploy to production (free tier)

### Backend → Render.com
1. Push the repo to GitHub.
2. On Render, **New → Web Service → Connect repo**.
3. Root directory: `backend`.
4. Render will auto-detect the `Dockerfile`.
5. Add env vars from `backend/.env.example` (at minimum `GEMINI_API_KEY`).
6. Health check path: `/health`.
7. First boot ingests the corpus into Qdrant (or local Chroma if no
   `QDRANT_URL`). Subsequent restarts are fast because the embedding model
   is baked into the image.

`render.yaml` is included at the repo root for one-click deploys.

### Frontend → Vercel
1. On Vercel, **New Project → Import repo**.
2. Root directory: `frontend`.
3. Env var: `NEXT_PUBLIC_BACKEND_URL=https://<your-render-service>.onrender.com`.
4. Deploy. Done.

### Vector DB → Qdrant Cloud (optional but recommended)
1. Sign up at https://cloud.qdrant.io, create a 1GB free cluster.
2. Copy the cluster URL and API key into backend env vars.
3. Re-run `python -m rag.ingest` locally against the cloud URL (or let
   the container do it on first boot).

---

## Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for full mermaid diagrams
covering system architecture, the sequential agent flow, the RAG ingestion
and retrieval pipeline, agent contracts, bias methodology, and the
end-to-end data flow.

## Pitch deck

See [`docs/PITCH.md`](docs/PITCH.md) for the ten-slide judge pitch outline
and 60-second demo script.

## Repository layout

```
biasbounty/
├── backend/                     # FastAPI + CrewAI + RAG
│   ├── main.py                  # API entry
│   ├── config.py                # pydantic-settings
│   ├── models.py                # Pydantic + SQLModel
│   ├── crew/
│   │   ├── agents.py            # 5 CrewAI agents
│   │   ├── tasks.py             # sequential tasks
│   │   ├── tools.py             # custom tools (prober, metrics, RAG, remediation)
│   │   ├── counterfactual.py    # deterministic minimal-pair engine
│   │   ├── run_context.py       # secure in-memory context (keeps API keys out of LLM prompts)
│   │   └── orchestrator.py      # crew runner + SSE broadcasting
│   ├── rag/
│   │   ├── ingest.py            # one-shot corpus ingestion
│   │   └── retriever.py         # runtime retriever (Qdrant → Chroma fallback)
│   ├── services/pdf_report.py   # ReportLab-based audit PDF
│   ├── data/regulations/*.md    # seed corpus
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example
├── frontend/                    # Next.js 14 + Tailwind
│   ├── app/
│   │   ├── page.tsx             # landing (control-room aesthetic)
│   │   ├── audit/page.tsx       # new audit form
│   │   └── audit/[id]/page.tsx  # live SSE dashboard + results
│   ├── lib/api.ts               # API client + SSE helpers
│   ├── package.json
│   ├── tailwind.config.ts       # design tokens
│   └── .env.local.example
├── docs/
│   ├── ARCHITECTURE.md
│   └── PITCH.md
├── docker-compose.yml           # local dev (backend + Qdrant)
├── render.yaml                  # one-click backend deploy
└── README.md
```

## License

MIT — do what you want. If you ship it to production, tell us.
