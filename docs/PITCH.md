# BiasBounty — Judge Pitch Kit

## 60-second demo script

> "Har production LLM ke saath ek risk hai — koi nahi janta wo bias output kab dega. EU AI Act enforcement Feb 2025 se live hai. India MeitY advisory March 2024 se effective. Companies ke paas audit tool nahi hai."
>
> _[open dashboard]_
>
> "BiasBounty ko koi bhi OpenAI-compatible LLM API do — Groq, OpenAI, apna endpoint — 5 CrewAI agents investigation start karte hain."
>
> _[click Launch, live SSE stream shows agents running]_
>
> "Agent 1 counterfactual minimal-pair battery banata hai — same prompt, sirf demographic slot swap. Agent 2 target model ko probe karta hai. Agent 3 bootstrap 95% CI ke saath bias metrics compute karta hai. Agent 4 EU AI Act, NIST, ISO 42001, MeitY se RAG karke findings ko regulation clauses se map karta hai. Agent 5 final PDF likhta hai."
>
> _[report renders — score, grade, findings with citations, remediation snippet]_
>
> "Har finding ke saath: severity, evidence, exact regulation clause, aur ek copy-pasteable system prompt patch jo bias reduce karta hai. Ye tool AI compliance ka X-ray machine hai. Zero cost — Groq free, Qdrant free, Vercel free."

## 10-slide deck outline

1. **Title** — BiasBounty · AI auditing AI · [team names]
2. **Problem** — Every LLM in production is a compliance risk. EU AI Act enforcement is live. No developer-facing audit tool exists.
3. **Insight** — The auditor should itself be agentic AI. The evaluator's rigour has to be at least as high as the system it evaluates.
4. **Solution** — 5-agent CrewAI investigation, RAG-grounded on four regulations, ships a regulator-grade PDF with a copy-pasteable fix.
5. **Live demo** — 60s screen recording; end on the metrics dashboard.
6. **What makes it rigorous** — Counterfactual minimal pairs, bootstrap 95% CIs, paired flip rate, RAG citations, no LLM regulation hallucination.
7. **What makes it unique in this hackathon** — Meta-agentic (rare), regulator-grade artefacts (unique), auto-remediation code (unique), model-comparison (unique).
8. **Tech stack** — FastAPI + CrewAI + Groq + Qdrant + BGE embeddings + Next.js. Everything free tier.
9. **Traction / go-to-market** — Every AI startup shipping to EU or India needs pre-deployment audit. Priced per-audit or per-model-tier.
10. **The ask** — Feedback, connections to compliance teams at target customers, and the vote.

## Talking points for Q&A

- **"Isn't this just prompt engineering?"** — No. Counterfactual minimal pairs plus bootstrap CIs is a formal fairness methodology used in academic benchmarks (CrowS-Pairs, StereoSet, BBQ). We're not asking an LLM if it thinks another LLM is biased.
- **"How do you avoid the LLM auditor being biased itself?"** — The auditor never judges — it computes statistical metrics from tool outputs. The LLM only sequences tool calls and composes prose. Every citation is retrieved, not remembered.
- **"What's the compute cost?"** — On Groq's free tier, a full audit uses ~250K tokens and costs ₹0. On paid tier, ~$0.20 per audit.
- **"Why not use existing benchmarks (BBQ, StereoSet)?"** — Those are static test sets and only cover English + US demographics. BiasBounty runs against the deployed model in the deployment domain, and covers India-specific dimensions (caste, region) that the standard benchmarks omit.

## Screens to have ready in the browser

1. Landing page (`/`) with agent grid visible.
2. Audit config form (`/audit`) with Groq preset pre-filled + a valid API key already pasted.
3. A pre-run completed audit (`/audit/<id>`) so you can jump to the polished result if live run stalls.
4. The generated PDF open in a second tab.

## Backup: if the live run stalls

- Explain: "The model target we're pointing at is a free-tier Groq endpoint and sometimes throttles. Here's the completed audit from the run I did an hour ago" — swap tabs.
- Judges care that the system is real and the artefact is real. A pre-run demo covers this.
