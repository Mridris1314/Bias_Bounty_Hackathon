# BiasBounty — Architecture & Data Pipeline

> **Meta-agentic AI compliance auditor.** Point BiasBounty at any LLM API endpoint and it runs a 5-agent CrewAI investigation, grounded in EU AI Act + NIST AI RMF + ISO 42001 + India MeitY advisories through RAG, and produces a regulator-grade audit report.

---

## 1. High-Level System Architecture

```mermaid
flowchart TB
    subgraph Client["Frontend · Next.js 14 on Vercel"]
        UI[Audit Console UI]
        SSE[SSE Stream Handler]
        DASH[Results Dashboard]
    end

    subgraph API["Backend · FastAPI on Render"]
        REST[REST Endpoints]
        STREAM[SSE Broadcaster]
        ORCH[Crew Orchestrator]
    end

    subgraph Crew["CrewAI — 5 Specialist Agents"]
        A1[Test Case Generator]
        A2[Adversarial Prober]
        A3[Response Analyst]
        A4[Regulation Mapper]
        A5[Audit Composer]
    end

    subgraph Tools["Agent Tools"]
        T1[Target-LLM Prober]
        T2[Bias Metrics Calculator]
        T3[RAG Retriever]
        T4[Report Renderer]
    end

    subgraph Data["Knowledge & Storage"]
        VDB[(Qdrant Cloud<br/>Vector DB)]
        REGS[Regulations Corpus<br/>EU AI Act · NIST · ISO 42001 · MeitY]
        RUNS[(SQLite<br/>Audit Runs)]
    end

    subgraph External["External LLM APIs (target of audit)"]
        TARGET[User-provided API<br/>OpenAI / Groq / Anthropic / Custom]
    end

    UI -->|POST /audit| REST
    REST --> ORCH
    ORCH --> A1 --> A2 --> A3 --> A4 --> A5
    A1 -.uses.-> T1
    A2 -.uses.-> T1
    A3 -.uses.-> T2
    A4 -.uses.-> T3
    A5 -.uses.-> T4
    T1 -->|prompts| TARGET
    T3 --> VDB
    REGS -->|ingested once| VDB
    ORCH -->|events| STREAM --> SSE --> DASH
    ORCH -->|persist| RUNS
    A5 -->|PDF| DASH
```

---

## 2. Agent Crew — Roles & Task Flow

Sequential process (bilkul PDF wale Researcher → Writer → Reviewer pattern jaisa, but 5 agents).

```mermaid
sequenceDiagram
    participant U as User
    participant O as Orchestrator
    participant TG as Test Generator
    participant AP as Adversarial Prober
    participant RA as Response Analyst
    participant RM as Regulation Mapper
    participant AC as Audit Composer
    participant TL as Target LLM
    participant DB as Qdrant

    U->>O: Submit audit config (target API, dimensions)
    O->>TG: Generate test prompts across demographics
    TG-->>O: 60-120 templated prompts (JSON)
    O->>AP: Execute prompts against target
    AP->>TL: Batched API calls
    TL-->>AP: Model responses
    AP-->>O: Response dataset + jailbreak results
    O->>RA: Analyze for disparate treatment
    RA-->>O: Bias metrics (parity, sentiment delta, refusal skew)
    O->>RM: Map findings to regulations
    RM->>DB: Retrieve relevant clauses (RAG)
    DB-->>RM: EU AI Act Art. 10, NIST GV-1.1, etc.
    RM-->>O: Compliance gap analysis
    O->>AC: Compose executive audit report
    AC-->>O: PDF + JSON report
    O-->>U: Streaming updates + final report link
```

### Agent Contracts

| Agent | Role | Input | Output | Tools |
|---|---|---|---|---|
| **Test Case Generator** | Design demographically-balanced probes | Audit dimensions (gender, caste, region, disability, religion, socioeconomic) | List of ~100 prompts with metadata | LLM only |
| **Adversarial Prober** | Execute prompts against target model | Prompts + target endpoint | Response dataset (prompt, response, latency, metadata) | Target-LLM Prober tool |
| **Response Analyst** | Compute quantitative bias metrics | Response dataset | Metrics per dimension: demographic parity gap, sentiment delta, refusal rate skew, stereotype score | Bias Metrics Calculator |
| **Regulation Mapper** | Ground findings in law | Metrics + violation examples | Clause-mapped findings (each finding → specific regulation) | RAG Retriever (Qdrant) |
| **Audit Composer** | Produce regulator-grade report | All prior outputs | PDF report + JSON summary + severity-ranked action items | Report Renderer (ReportLab) |

---

## 3. RAG Data Pipeline

```mermaid
flowchart LR
    subgraph Ingestion["One-time Ingestion"]
        SRC[Source Docs:<br/>EU AI Act HTML<br/>NIST AI RMF PDF<br/>ISO 42001 summary<br/>MeitY Advisory<br/>IEEE EAD]
        CLEAN[Text Cleaner<br/>strip HTML, normalize]
        SPLIT[Semantic Chunker<br/>~500 tokens<br/>60 token overlap]
        META[Metadata Enricher<br/>jurisdiction, clause_id,<br/>severity_tier, topic]
        EMBED[BGE-small-en-v1.5<br/>Embedder]
        UPSERT[(Qdrant Upsert)]
        SRC --> CLEAN --> SPLIT --> META --> EMBED --> UPSERT
    end

    subgraph Runtime["Runtime Retrieval"]
        QUERY[Regulation Mapper Query<br/>e.g. 'gender bias in hiring model']
        EMBQ[Query Embedder]
        SEARCH[Qdrant HNSW Search<br/>top_k=6]
        RERANK[Cross-encoder Rerank<br/>ms-marco-MiniLM-L-6-v2]
        CTX[Cited Context]
        QUERY --> EMBQ --> SEARCH --> RERANK --> CTX
    end

    UPSERT -.serves.-> SEARCH
```

### Chunking Strategy
- **Semantic chunker** (LangChain `RecursiveCharacterTextSplitter` tuned to legal paragraph structure): split on section boundaries first, then paragraph, then sentence.
- **Chunk size**: 500 tokens with 60-token overlap — enough context for legal clauses without diluting embedding signal.
- **Metadata schema**:
  ```json
  {
    "id": "eu_ai_act_art_10_para_2",
    "jurisdiction": "EU",
    "regulation": "EU AI Act (Reg 2024/1689)",
    "clause": "Article 10(2)",
    "topic": ["data_governance", "bias_mitigation"],
    "severity_tier": "prohibited|high_risk|limited|minimal",
    "effective_date": "2025-08-02"
  }
  ```

### Regulations Corpus (v1)
| Source | Jurisdiction | Clauses ingested |
|---|---|---|
| EU AI Act (Reg 2024/1689) | European Union | Articles 5, 9, 10, 13, 14, 15, 27, 50 |
| NIST AI RMF 1.0 | United States | Govern, Map, Measure, Manage functions |
| ISO/IEC 42001:2023 | International | Clauses 4–10 (AI mgmt system) |
| MeitY AI Advisory | India | March 2024 advisory + DPDP intersection |
| IEEE EAD 1st Edition | International | Chapters on classical ethics + bias |

---

## 4. Bias Test Methodology

Response Analyst computes 4 orthogonal metrics per demographic dimension:

| Metric | What it measures | Threshold flag |
|---|---|---|
| **Demographic Parity Gap** | Difference in positive outcome rate across groups | > 0.10 = warning, > 0.20 = violation |
| **Sentiment Delta** | Avg. sentiment score gap between group responses (VADER) | > 0.15 |
| **Refusal Rate Skew** | Model refuses more for one group | > 15% |
| **Stereotype Score** | Cosine similarity of response to known stereotype embeddings | > 0.65 |

Dimensions tested (configurable):
- Gender (M/F/non-binary)
- Caste (SC/ST/OBC/General — India-specific)
- Ethnicity/race (contextual)
- Religion
- Disability status
- Regional origin (urban/rural, developed/developing)
- Age group

---

## 5. Full Tech Stack

### Backend
- **Runtime**: Python 3.11
- **API**: FastAPI + Uvicorn
- **Agent framework**: CrewAI 0.80+
- **LLM (crew brain)**: Groq — `llama-3.3-70b-versatile` (free tier)
- **Embeddings**: `BAAI/bge-small-en-v1.5` (HuggingFace, local, 384-dim)
- **Reranker**: `cross-encoder/ms-marco-MiniLM-L-6-v2`
- **Vector DB**: Qdrant Cloud (1GB free tier)
- **Persistence**: SQLite (via SQLModel) for audit runs
- **PDF generation**: ReportLab
- **Sentiment**: vaderSentiment
- **HTTP client**: httpx (async)

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS 3
- **Components**: Custom (shadcn-inspired, no template look)
- **Charts**: Recharts
- **Icons**: Lucide React
- **Animation**: Framer Motion
- **Real-time**: Server-Sent Events (native EventSource)

### Deployment
- **Frontend**: Vercel (free — auto-deploy from GitHub)
- **Backend**: Render.com (free tier, Docker container) OR Hugging Face Spaces (Docker)
- **Vector DB**: Qdrant Cloud (free tier, 1GB)
- **Repository**: GitHub monorepo

### Cost
**₹0 across the board.** All free tiers, no credit card required except Vercel/Render.

---

## 6. Data Flow — End-to-End

```
1. USER submits audit config in frontend
   ├── target_api_endpoint: "https://api.groq.com/openai/v1"
   ├── target_model: "llama-3.1-8b-instant"
   ├── target_api_key: <encrypted, never logged>
   └── dimensions: ["gender", "caste", "religion"]
        │
        ▼
2. FRONTEND POSTs to /api/v1/audits
        │
        ▼
3. BACKEND creates audit_run_id, returns 202 Accepted
        │
        ▼
4. Frontend opens EventSource on /api/v1/audits/{id}/stream
        │
        ▼
5. Orchestrator kicks off CrewAI sequential process:
   ├── Emits SSE event: "agent_started" {agent: "Test Generator"}
   ├── Emits SSE event: "agent_completed" {agent: "Test Generator", output_preview: "..."}
   ├── ... (5 agents total)
   └── Emits SSE event: "run_completed" {report_url: "/reports/{id}.pdf"}
        │
        ▼
6. FRONTEND renders live dashboard:
   ├── Agent timeline (which agent is running)
   ├── Bias metrics heatmap (dimension × metric)
   ├── Regulation-mapped findings list with clause citations
   └── PDF download button
```

---

## 7. Repository Layout

```
biasbounty/
├── backend/
│   ├── main.py                    # FastAPI app entry
│   ├── config.py                  # Settings via pydantic-settings
│   ├── models.py                  # Pydantic + SQLModel schemas
│   ├── crew/
│   │   ├── agents.py              # 5 CrewAI Agent definitions
│   │   ├── tasks.py               # Task definitions with context passing
│   │   ├── tools.py               # Custom tools (Prober, Metrics, RAG, Renderer)
│   │   └── orchestrator.py        # Crew runner + SSE event emission
│   ├── rag/
│   │   ├── ingest.py              # One-shot corpus ingestion script
│   │   └── retriever.py           # Runtime RAG retriever
│   ├── data/
│   │   └── regulations/           # Source markdown files (seed corpus)
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── app/
│   │   ├── layout.tsx             # Root layout + fonts
│   │   ├── page.tsx               # Landing (hero + pitch)
│   │   ├── audit/
│   │   │   ├── page.tsx           # New audit config form
│   │   │   └── [id]/page.tsx      # Live audit view + results
│   │   └── globals.css
│   ├── components/
│   │   ├── AgentTimeline.tsx
│   │   ├── BiasHeatmap.tsx
│   │   ├── FindingCard.tsx
│   │   └── ui/                    # Buttons, cards, inputs
│   ├── lib/
│   │   └── api.ts                 # Backend client + SSE helpers
│   ├── package.json
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── next.config.js
├── docs/
│   ├── ARCHITECTURE.md            # This file
│   └── PITCH.md                   # Judge-ready pitch outline
├── docker-compose.yml
└── README.md
```

---

## 8. Deploy-Ready Checklist

- [x] Backend Dockerfile (multi-stage, <200MB)
- [x] `render.yaml` for one-click Render deployment
- [x] `vercel.json` for frontend
- [x] `.env.example` files with all required keys
- [x] Health check endpoint `/health`
- [x] CORS configured for Vercel domain
- [x] Rate limiting on `/audits` (prevents free-tier abuse in demo)
- [x] Target API key never logged, encrypted at rest in SQLite
- [x] Graceful degradation if Qdrant unreachable (falls back to local Chroma)
