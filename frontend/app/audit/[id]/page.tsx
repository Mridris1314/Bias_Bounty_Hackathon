"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CountUp from "react-countup";
import confetti from "canvas-confetti";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  ArrowLeft, Loader2, CheckCircle2, AlertTriangle, Download, XCircle,
  Copy, Check, Link as LinkIcon,
} from "lucide-react";
import { getAudit, openAuditStream, reportPdfUrl, SSEEvent } from "@/lib/api";
import { cn } from "@/lib/utils";
import { MagneticButton } from "@/components/MagneticButton";
import { DoorTransition } from "@/components/DoorTransition";

const AGENT_ORDER = [
  "Test Case Generator",
  "Adversarial Prober",
  "Statistical Bias Analyst",
  "Regulation Mapper",
  "Audit Composer",
];

const THINKING_MESSAGES = [
  "Analyzing prompts...",
  "Probing target model...",
  "Cross-referencing EU AI Act...",
  "Computing bootstrap intervals...",
  "Retrieving regulation clauses...",
  "Composing regulator-grade report...",
];

type AgentState = "pending" | "running" | "done";

function playChime() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.8);
  } catch { /* ignore — audio not critical */ }
}

export default function AuditRunPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [agents, setAgents] = useState<Record<string, { state: AgentState; preview?: string }>>(
    Object.fromEntries(AGENT_ORDER.map((a) => [a, { state: "pending" }]))
  );
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("connecting");
  const [retryInfo, setRetryInfo] = useState<{ attempt: number; wait_seconds: number } | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [bounce, setBounce] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const cur = await getAudit(id);
        if (cur?.report && !cancelled) {
          setReport(cur.report);
          setStatus("completed");
          setAgents((s) => {
            const next = { ...s };
            AGENT_ORDER.forEach((a) => (next[a] = { state: "done" }));
            return next;
          });
        }
        if (cur?.error) setError(cur.error);
      } catch { /* ignore */ }
    })();

    const close = openAuditStream(id, (ev: SSEEvent) => {
      if (cancelled) return;
      if (ev.event === "run_started") {
        setStatus("running");
        setProvider((ev.data as any).provider ?? null);
        setAgents((s) => ({ ...s, [AGENT_ORDER[0]]: { state: "running" } }));
      } else if (ev.event === "agent_completed") {
        const label = (ev.data as any).agent as string;
        const step = (ev.data as any).step as number;
        setAgents((s) => {
          const next = { ...s };
          if (label && next[label]) {
            next[label] = { state: "done", preview: (ev.data as any).output_preview };
          }
          const nextLabel = AGENT_ORDER[step];
          if (nextLabel && next[nextLabel]?.state === "pending") {
            next[nextLabel] = { state: "running" };
          }
          return next;
        });
      } else if (ev.event === "run_completed") {
        setReport(ev.data);
        setStatus("completed");
        setAgents((s) => {
          const next = { ...s };
          AGENT_ORDER.forEach((a) => (next[a] = { state: "done" }));
          return next;
        });
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.65 },
          colors: ["#00F5A0", "#FF6B6B", "#FBBF24"],
        });
        playChime();
        setBounce(true);
        setTimeout(() => setBounce(false), 400);
      } else if (ev.event === "run_failed") {
        setError((ev.data as any).error || "Audit failed.");
        setStatus("failed");
      } else if (ev.event === "retry_wait") {
        setRetryInfo(ev.data as any);
      }
    });

    return () => {
      cancelled = true;
      close();
    };
  }, [id]);

  return (
    <main className="relative min-h-screen">
      <DoorTransition label="Spinning up the crew" />
      <div className="aurora">
        <div className="aurora-blob aurora-blob-1" />
        <div className="aurora-blob aurora-blob-3" />
      </div>
      <div className="grain" />
      <div className="absolute inset-0 grid-bg pointer-events-none opacity-30" />

      <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <Link href="/audit" className="btn-ghost text-sm">
          <ArrowLeft className="h-4 w-4" /> Audit &middot; {id}
        </Link>
        <div className="flex items-center gap-2">
          {provider && <span className="chip">via {provider}</span>}
          <StatusChip status={status} />
          {report && !error && (
            <>
              <ShareButton runId={id} />
              <MagneticButton
                variant="primary"
                className="text-sm"
                onClick={() => window.open(reportPdfUrl(id), "_blank")}
              >
                <Download className="h-4 w-4" /> Download PDF
              </MagneticButton>
            </>
          )}
        </div>
      </nav>

      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-24">
        <div>
          <span className="eyebrow">audit run</span>
          <h1 className="display mt-3 text-3xl text-text-strong">
            {report?.target_model ?? "Running…"}
          </h1>
          {report?.executive_summary && (
            <p className="mt-3 max-w-3xl text-text-muted">{report.executive_summary}</p>
          )}
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        {retryInfo && status === "running" && (
          <div className="mt-6 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
            Retry attempt {retryInfo.attempt} &mdash; waiting {retryInfo.wait_seconds}s
          </div>
        )}

        {/* Cinematic split screen: timeline 40% + results 60% */}
        <div className="mt-10 grid gap-6 lg:grid-cols-[2fr_3fr]">
          <div className="glass p-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="eyebrow">crew progress</span>
              <span className="font-mono text-[11px] uppercase tracking-widest text-text-muted">
                sequential
              </span>
            </div>
            <ol className="relative space-y-3">
              {AGENT_ORDER.map((label, i) => {
                const s = agents[label];
                return (
                  <AgentRow
                    key={label}
                    index={i + 1}
                    label={label}
                    state={s.state}
                    preview={s.preview}
                    isLast={i === AGENT_ORDER.length - 1}
                  />
                );
              })}
            </ol>
          </div>

          <div className="space-y-6">
            <VerdictCard report={report} bounce={bounce} />

            {report?.metrics_matrix && Object.keys(report.metrics_matrix).length > 0 && (
              <div className="glass-elevated p-6">
                <span className="eyebrow">metrics</span>
                <h2 className="display mt-1 text-xl text-text-strong">Bias metrics matrix</h2>
                <MetricsChart matrix={report.metrics_matrix} />
              </div>
            )}
          </div>
        </div>

        {/* Findings */}
        {report?.findings?.length > 0 && (
          <div className="mt-10">
            <div className="mb-4">
              <span className="eyebrow">findings · regulation-mapped</span>
              <h2 className="display mt-1 text-2xl text-text-strong">What we found</h2>
            </div>
            <div className="grid gap-4">
              {report.findings.map((f: any, i: number) => (
                <FindingCard key={i} finding={f} index={i} />
              ))}
            </div>
          </div>
        )}

        {/* Top actions */}
        {report?.top_actions?.length > 0 && (
          <div className="mt-10 glass p-6">
            <span className="eyebrow">action queue</span>
            <h2 className="display mt-1 text-xl text-text-strong">Ship-list for engineering</h2>
            <ol className="mt-4 space-y-2">
              {report.top_actions.map((a: string, i: number) => (
                <li key={i} className="flex gap-3 rounded-xl border border-border bg-surface/40 px-4 py-3 text-sm">
                  <span className="font-mono text-xs text-mint">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-text">{a}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {report?.remediation_snippet && <RemediationPanel snippet={report.remediation_snippet} />}
      </section>
    </main>
  );
}

function RemediationPanel({ snippet }: { snippet: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }
  return (
    <div className="mt-10 glass p-6">
      <div className="flex items-start justify-between">
        <div>
          <span className="eyebrow">auto-remediation</span>
          <h2 className="display mt-1 text-xl text-text-strong">System prompt patch</h2>
          <p className="mt-1 text-sm text-text-muted">
            Prepend to system prompt to mitigate detected bias, then re-run the audit to verify.
          </p>
        </div>
        <button onClick={copy} className="btn-ghost text-sm">
          {copied ? <Check className="h-4 w-4 text-mint" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="mt-4 max-h-[420px] overflow-auto rounded-xl border border-border bg-surface-3 p-4 font-mono text-[12px] leading-relaxed text-text">
        {snippet}
      </pre>
    </div>
  );
}

function ShareButton({ runId }: { runId: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      const url = `${window.location.origin}/audit/${runId}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }
  return (
    <MagneticButton onClick={copy} variant="secondary" className="text-sm">
      {copied ? <Check className="h-4 w-4 text-mint" /> : <LinkIcon className="h-4 w-4" />}
      {copied ? "Link copied" : "Share"}
    </MagneticButton>
  );
}

// ------------------------------------------------------------------
function AgentRow({
  index, label, state, preview, isLast,
}: { index: number; label: string; state: AgentState; preview?: string; isLast: boolean }) {
  const [msgIdx, setMsgIdx] = useState(0);
  useEffect(() => {
    if (state !== "running") return;
    const id = setInterval(() => setMsgIdx((v) => (v + 1) % THINKING_MESSAGES.length), 2000);
    return () => clearInterval(id);
  }, [state]);

  const icon =
    state === "done" ? <CheckCircle2 className="h-4 w-4 text-mint" /> :
    state === "running" ? <Loader2 className="h-4 w-4 animate-spin text-mint" /> :
    <div className="h-4 w-4 rounded-full border border-dashed border-text-dim" />;

  return (
    <li className="relative">
      {!isLast && <div className="absolute left-[27px] top-10 h-[calc(100%+4px)] w-px divider-glow" />}
      <motion.div
        animate={
          state === "running"
            ? {
                scale: 1.02,
                boxShadow: [
                  "0 0 20px -5px rgba(0,245,160,0.3)",
                  "0 0 40px -5px rgba(0,245,160,0.6)",
                  "0 0 20px -5px rgba(0,245,160,0.3)",
                ],
              }
            : { scale: 1, boxShadow: "none" }
        }
        transition={
          state === "running"
            ? { boxShadow: { duration: 2, repeat: Infinity }, scale: { type: "spring", stiffness: 300 } }
            : { type: "spring", stiffness: 300 }
        }
        className={cn(
          "relative rounded-xl border p-4 transition-colors",
          state === "running" && "border-mint/50 bg-surface/60 border-light",
          state === "done" && "border-border bg-surface/40",
          state === "pending" && "border-dashed border-border bg-transparent"
        )}
      >
        <div className="flex items-center gap-3">
          <span className="relative flex items-center justify-center">
            {state === "running" && <span className="pulse-dot absolute h-4 w-4 rounded-full bg-mint" />}
            <span className="font-mono text-[11px] text-text-muted">{String(index).padStart(2, "0")}</span>
          </span>
          {icon}
          <div className="flex-1 display text-base text-text-strong">{label}</div>
          {state === "running" && <span className="chip-mint">running</span>}
        </div>
        {state === "running" && (
          <div className="mt-2 h-4 overflow-hidden pl-9">
            <AnimatePresence mode="wait">
              <motion.p
                key={msgIdx}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3 }}
                className="font-mono text-[11px] text-text-dim"
              >
                {THINKING_MESSAGES[msgIdx]}
              </motion.p>
            </AnimatePresence>
          </div>
        )}
        {preview && state === "done" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-3 overflow-hidden rounded-lg bg-surface-2 p-3 font-mono text-[11px] leading-relaxed text-text-muted"
          >
            {preview.slice(0, 260)}{preview.length > 260 ? "…" : ""}
          </motion.div>
        )}
      </motion.div>
    </li>
  );
}

function VerdictCard({ report, bounce }: { report: any; bounce: boolean }) {
  if (!report || report.error) {
    return (
      <div className="glass-elevated flex min-h-[220px] items-center justify-center p-6">
        <div className="text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-mint" />
          <p className="mt-3 text-sm text-text-muted">Verdict pending crew completion.</p>
        </div>
      </div>
    );
  }
  const score = Number(report.overall_score ?? 0);
  const grade = report.grade ?? "?";
  const tone = score >= 80 ? "mint" : score >= 60 ? "warn" : "danger";
  const toneCls = tone === "mint" ? "text-mint" : tone === "warn" ? "text-warn" : "text-danger";
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={bounce ? { opacity: 1, scale: [1, 1.05, 1], y: 0 } : { opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      className="glass-elevated pulse-ring border-mint/40 p-6"
    >
      <span className="eyebrow">verdict</span>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-surface-2 p-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-text-muted">score</div>
          <div className={cn("mt-2 display text-5xl", toneCls)}>
            <CountUp end={score} duration={1.5} decimals={0} />
          </div>
          <div className="mt-1 text-xs text-text-muted">out of 100</div>
        </div>
        <div className="rounded-xl border border-border bg-surface-2 p-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-text-muted">grade</div>
          <div className={cn("mt-2 display text-5xl animate-glow-pulse", toneCls)}>{grade}</div>
          <div className="mt-1 text-xs text-text-muted">{report.findings?.length ?? 0} findings</div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="chip">prompts: {report.prompts_run ?? "—"}</span>
        <span className="chip">duration: {report.duration_s ?? "—"}s</span>
      </div>
    </motion.div>
  );
}

function MetricsChart({ matrix }: { matrix: Record<string, any> }) {
  const data = useMemo(
    () =>
      Object.entries(matrix).map(([dim, m]: any) => ({
        dimension: dim,
        parity: m.parity_gap ?? 0,
        parity_ci: m.parity_gap_ci,
        sentiment: m.sentiment_delta ?? 0,
        sentiment_ci: m.sentiment_delta_ci,
        refusal: m.refusal_skew ?? 0,
        stereotype: m.stereotype_score ?? 0,
      })),
    [matrix]
  );
  return (
    <div className="mt-4 h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid stroke="#2A2E3B" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="dimension" stroke="#8B92A5" tick={{ fontFamily: "monospace", fontSize: 11 }} />
          <YAxis stroke="#8B92A5" tick={{ fontFamily: "monospace", fontSize: 11 }} />
          <Tooltip
            cursor={{ fill: "rgba(0,245,160,0.05)" }}
            contentStyle={{
              background: "#1A1D26",
              border: "1px solid #2A2E3B",
              borderRadius: 12,
              fontFamily: "monospace",
              fontSize: 12,
            }}
            formatter={(value: any, name: any, ctx: any) => {
              const ci = name === "Parity gap" ? ctx.payload.parity_ci
                : name === "Sentiment Δ" ? ctx.payload.sentiment_ci
                : undefined;
              if (ci) return [`${value} (CI ${ci[0].toFixed(2)}–${ci[1].toFixed(2)})`, name];
              return [value, name];
            }}
          />
          <Bar dataKey="parity" fill="#00F5A0" name="Parity gap" radius={[3, 3, 0, 0]} animationDuration={800} />
          <Bar dataKey="sentiment" fill="#FF6B6B" name="Sentiment Δ" radius={[3, 3, 0, 0]} animationDuration={800} animationBegin={100} />
          <Bar dataKey="refusal" fill="#FBBF24" name="Refusal skew" radius={[3, 3, 0, 0]} animationDuration={800} animationBegin={200} />
          <Bar dataKey="stereotype" fill="#F87171" name="Stereotype" radius={[3, 3, 0, 0]} animationDuration={800} animationBegin={300} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function FindingCard({ finding, index }: { finding: any; index: number }) {
  const sev = String(finding.severity ?? "info").toLowerCase();
  const sevBorder =
    sev === "critical" || sev === "high" ? "border-l-danger" :
    sev === "medium" ? "border-l-warn" :
    sev === "low" ? "border-l-mint" : "border-l-border";
  const sevCls =
    sev === "critical" || sev === "high" ? "text-danger border-danger/40" :
    sev === "medium" ? "text-warn border-warn/40" :
    sev === "low" ? "text-mint border-mint/40" : "text-text-muted";
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1 }}
      className={cn("card border-l-[3px] p-5", sevBorder)}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className={cn("chip", sevCls)}>{sev}</span>
            <span className="chip">{finding.dimension}</span>
          </div>
          <h3 className="display mt-3 text-xl text-text-strong">{finding.title}</h3>
          <p className="mt-2 text-sm text-text-muted">{finding.summary}</p>
        </div>
        {sev === "critical" || sev === "high" ? (
          <XCircle className="h-5 w-5 shrink-0 text-danger" />
        ) : sev === "medium" ? (
          <AlertTriangle className="h-5 w-5 shrink-0 text-warn" />
        ) : (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-mint" />
        )}
      </div>

      {finding.regulations?.length > 0 && (
        <div className="mt-4 rounded-xl border border-border bg-surface-2 p-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
            regulations mapped
          </div>
          <ul className="mt-2 space-y-2">
            {finding.regulations.slice(0, 3).map((r: any, i: number) => (
              <li key={i} className="text-sm">
                <span className="font-mono text-[11px] text-mint">
                  {r.jurisdiction === "INT" ? "Global" : r.jurisdiction} · {r.regulation} · {r.clause}
                </span>
                <p className="mt-1 font-display italic text-text-muted">
                  &ldquo;{(r.excerpt ?? "").slice(0, 240)}…&rdquo;
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {finding.evidence_examples?.length > 0 && (
        <details className="mt-3 rounded-xl border border-border bg-surface/40 p-4">
          <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-widest text-text-muted">
            evidence · {finding.evidence_examples.length} examples
          </summary>
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-3 space-y-3"
          >
            {finding.evidence_examples.map((e: any, i: number) => (
              <div key={i} className="rounded-lg bg-surface-2 p-3 text-xs">
                <div className="font-mono text-[10px] uppercase tracking-widest text-mint">
                  {e.group}
                </div>
                <div className="mt-1 text-text-muted">
                  <span className="text-text-strong">Prompt: </span>{e.prompt}
                </div>
                <div className="mt-1 text-text-muted">
                  <span className="text-text-strong">Response: </span>{e.response}
                </div>
              </div>
            ))}
          </motion.div>
        </details>
      )}

      {finding.recommendation && (
        <div className="mt-4 rounded-xl border border-mint/30 bg-mint/10 p-4 text-sm">
          <span className="font-mono text-[10px] uppercase tracking-widest text-mint">
            recommendation
          </span>
          <p className="mt-1 text-text">{finding.recommendation}</p>
        </div>
      )}
    </motion.div>
  );
}

function StatusChip({ status }: { status: string }) {
  const cls = status === "completed" ? "!text-mint !border-mint/40"
    : status === "failed" ? "!text-danger !border-danger/40"
    : "!text-mint !border-mint/40";
  return <span className={cn("chip", cls, status === "running" && "pulse-dot")}>{status}</span>;
}
