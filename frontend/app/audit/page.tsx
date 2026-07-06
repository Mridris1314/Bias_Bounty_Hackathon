"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, KeyRound, Lock, Check, Loader2 } from "lucide-react";
import { createAudit, Dimension } from "@/lib/api";
import { cn } from "@/lib/utils";
import { SpotlightCard } from "@/components/SpotlightCard";
import { MagneticButton } from "@/components/MagneticButton";
import { DoorTransition } from "@/components/DoorTransition";

const DIMS: { key: Dimension; label: string; hint: string; tooltip: string }[] = [
  {
    key: "gender", label: "Gender", hint: "male · female · non-binary",
    tooltip: "Tests responses across male/female/non-binary variants of identical prompts.",
  },
  {
    key: "caste", label: "Caste (India)", hint: "SC · ST · OBC · general",
    tooltip: "Tests responses across SC/ST/OBC/general caste variants of identical prompts.",
  },
  {
    key: "religion", label: "Religion", hint: "hindu · muslim · christian · …",
    tooltip: "Tests responses across major religion variants of identical prompts.",
  },
  {
    key: "region", label: "Region", hint: "urban · rural · global north/south",
    tooltip: "Tests responses across urban/rural and global north/south variants of identical prompts.",
  },
  {
    key: "disability", label: "Disability", hint: "presence vs. absence",
    tooltip: "Tests responses with and without a disability mention in otherwise identical prompts.",
  },
  {
    key: "ethnicity", label: "Ethnicity", hint: "context-specific groups",
    tooltip: "Tests responses across context-specific ethnic group variants of identical prompts.",
  },
  {
    key: "age", label: "Age group", hint: "young · middle · senior",
    tooltip: "Tests responses across young/middle-aged/senior variants of identical prompts.",
  },
];

// Mirrors backend config.py's default MAX_PROMPTS_PER_DIMENSION — used only
// to give the user a rough estimate before launch, not a guarantee.
const PER_DIM_PROMPTS = 4;

function getCost(preset: { provider: string; badge: string }): string {
  if (preset.provider === "ollama") return "$0.00 (local)";
  if (preset.provider === "gemini" || preset.provider === "groq") return "$0.00 (free tier)";
  if (preset.provider === "custom") return "depends on endpoint";
  return `~${preset.badge} (target model calls)`;
}

type BadgeColor = "mint" | "ok" | "warn" | "muted";

const BADGE_CLASSES: Record<BadgeColor, string> = {
  mint: "bg-mint/20 text-mint border-mint/40",
  ok: "bg-ok/20 text-ok border-ok/40",
  warn: "bg-warn/20 text-warn border-warn/40",
  muted: "bg-surface-2 text-text-muted border-border",
};

const PRESETS: {
  name: string;
  provider: string;
  base_url: string;
  model: string;
  badge: string;
  badgeColor: BadgeColor;
}[] = [
  {
    name: "Ollama · Llama 3.2 3B",
    provider: "ollama",
    base_url: "http://localhost:11434/v1",
    model: "llama3.2:3b",
    badge: "LOCAL · UNLIMITED",
    badgeColor: "mint",
  },
  {
    name: "Gemini 2.0 Flash",
    provider: "gemini",
    base_url: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.0-flash",
    badge: "FAST · FREE",
    badgeColor: "ok",
  },
  {
    name: "Groq · Llama 3.1 8B",
    provider: "groq",
    base_url: "https://api.groq.com/openai/v1",
    model: "llama-3.1-8b-instant",
    badge: "FREE",
    badgeColor: "ok",
  },
  {
    name: "Groq · Llama 3.3 70B",
    provider: "groq",
    base_url: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
    badge: "SMART",
    badgeColor: "ok",
  },
  {
    name: "OpenAI · gpt-4o-mini",
    provider: "openai",
    base_url: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    badge: "$0.15/1M",
    badgeColor: "warn",
  },
  {
    name: "Anthropic · Claude Haiku",
    provider: "anthropic",
    base_url: "https://api.anthropic.com/v1",
    model: "claude-haiku-4-5",
    badge: "$0.80/1M",
    badgeColor: "warn",
  },
  {
    name: "Custom endpoint",
    provider: "custom",
    base_url: "",
    model: "",
    badge: "OpenAI-compat",
    badgeColor: "muted",
  },
];

const DOMAINS = ["general", "hiring", "lending", "healthcare", "education", "moderation"];
const JURIS = ["EU", "US", "IN", "INT"];

export default function NewAuditPage() {
  const router = useRouter();
  const [preset, setPreset] = useState(0);
  const [baseUrl, setBaseUrl] = useState(PRESETS[0].base_url);
  const [model, setModel] = useState(PRESETS[0].model);
  const [apiKey, setApiKey] = useState("");
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("hiring");
  const [dims, setDims] = useState<Dimension[]>(["gender", "religion", "region"]);
  const [juris, setJuris] = useState<string[]>(["EU", "US", "IN"]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickPreset(i: number) {
    setPreset(i);
    setBaseUrl(PRESETS[i].base_url);
    setModel(PRESETS[i].model);
  }

  function toggleDim(d: Dimension) {
    setDims((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }
  function toggleJuris(j: string) {
    setJuris((prev) => (prev.includes(j) ? prev.filter((x) => x !== j) : [...prev, j]));
  }

  async function submit() {
    setError(null);
    if (!baseUrl || !model || (!apiKey && PRESETS[preset].provider !== "ollama")) {
      setError("Target base URL, model, and API key are required.");
      return;
    }
    if (dims.length === 0) {
      setError("Pick at least one dimension.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await createAudit({
        name: name || `${model} · ${domain}`,
        target: {
          provider: PRESETS[preset].provider,
          base_url: baseUrl,
          model,
          api_key: apiKey,
        },
        dimensions: dims,
        context_domain: domain,
        jurisdictions: juris,
      });
      router.push(`/audit/${res.id}`);
    } catch (e: any) {
      setError(e.message ?? "Failed to start audit.");
    } finally {
      setSubmitting(false);
    }
  }

  const estimatedProbes = dims.length * PER_DIM_PROMPTS;

  return (
    <main className="relative min-h-screen">
      <DoorTransition label="Initializing audit environment" />
      <div className="aurora">
        <div className="aurora-blob aurora-blob-1" />
        <div className="aurora-blob aurora-blob-2" />
      </div>
      <div className="grain" />
      <div className="absolute inset-0 grid-bg pointer-events-none opacity-30" />

      <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <Link href="/" className="btn-ghost text-sm">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>
        <span className="chip-mint">new audit</span>
      </nav>

      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-24">
        <span className="eyebrow">configure</span>
        <h1 className="display mt-3 text-4xl text-text-strong">Set up the audit</h1>
        <p className="mt-2 max-w-2xl text-text-muted">
          Point BiasBounty at any OpenAI-compatible chat completions endpoint. Your
          key stays in memory only &mdash; it is never persisted to disk or logs.
        </p>

        <div className="mt-10 grid gap-8 lg:grid-cols-[2fr_1fr]">
          {/* Form column */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="space-y-8"
          >
            <Card title="Target model" caption="OpenAI-compatible chat completions API">
              <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {PRESETS.map((p, i) => (
                  <SpotlightCard
                    key={p.name}
                    onClick={() => pickPreset(i)}
                    selected={i === preset}
                    className="!p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium leading-tight text-text-strong">{p.name}</div>
                        <div className="mt-0.5 font-mono text-[10px] text-text-muted">{p.provider}</div>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide",
                          BADGE_CLASSES[p.badgeColor]
                        )}
                      >
                        {p.badge}
                      </span>
                    </div>
                    {i === preset && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 500 }}
                        className="absolute bottom-3 right-3 h-2 w-2 rounded-full bg-mint shadow-[0_0_12px_rgba(0,245,160,0.9)]"
                      />
                    )}
                  </SpotlightCard>
                ))}
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <Field label="Base URL" placeholder="http://localhost:11434/v1"
                  value={baseUrl} onChange={setBaseUrl} mono />
                <Field label="Model ID" placeholder="llama3.2:3b"
                  value={model} onChange={setModel} mono />
              </div>

              <div className="mt-3">
                <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-text-muted">
                  API key {PRESETS[preset].provider === "ollama" && "(not needed for local Ollama)"}
                </label>
                <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2.5 focus-within:border-mint/60">
                  <KeyRound className="h-4 w-4 text-text-muted" />
                  <input
                    type="password"
                    className="flex-1 bg-transparent font-mono text-sm text-text-strong outline-none placeholder:text-text-muted/70"
                    placeholder="sk-… (in memory only, never stored)"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </div>
              </div>
            </Card>

            <Card title="Audit context" caption="What is the model being used for?">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Audit name (optional)" placeholder="Hiring model — Q3 baseline"
                  value={name} onChange={setName} />
                <div>
                  <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-text-muted">
                    Deployment domain
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DOMAINS.map((d) => (
                      <Toggle key={d} on={domain === d} onClick={() => setDomain(d)}>
                        {d}
                      </Toggle>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            <Card title="Demographic dimensions" caption="Pick the axes you want probed">
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {DIMS.map((d) => {
                  const on = dims.includes(d.key);
                  return (
                    <motion.button
                      key={d.key}
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.92 }}
                      animate={on ? { boxShadow: "0 0 20px -5px rgba(0,245,160,0.5)" } : { boxShadow: "0 0 0px 0px rgba(0,245,160,0)" }}
                      transition={{ type: "spring", stiffness: 400 }}
                      onClick={() => toggleDim(d.key)}
                      title={d.tooltip}
                      className={cn(
                        "relative rounded-xl border px-4 py-3 text-left transition-colors",
                        "shine-sweep ripple-container overflow-hidden",
                        on
                          ? "border-mint bg-mint/10 text-text-strong"
                          : "border-border bg-surface/40 hover:border-mint/40"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">{d.label}</div>
                        <AnimatePresence>
                          {on && (
                            <motion.div
                              initial={{ scale: 0, rotate: -180 }}
                              animate={{ scale: 1, rotate: 0 }}
                              exit={{ scale: 0 }}
                              transition={{ type: "spring", stiffness: 500 }}
                            >
                              <Check className="h-3.5 w-3.5 text-mint" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      <div className="mt-1 font-mono text-[10px] text-text-muted">{d.hint}</div>
                    </motion.button>
                  );
                })}
              </div>
            </Card>

            <Card title="Jurisdictions" caption="Which regulations should the mapper cite?">
              <div className="flex flex-wrap gap-2">
                {JURIS.map((j) => (
                  <Toggle key={j} on={juris.includes(j)} onClick={() => toggleJuris(j)}>
                    {j}
                  </Toggle>
                ))}
              </div>
            </Card>

            {error && (
              <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {error}
              </div>
            )}
          </motion.div>

          {/* Sticky summary sidebar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="lg:sticky lg:top-24 lg:self-start"
          >
            <div className="glass-elevated p-6">
              <span className="eyebrow">configuration</span>
              <h2 className="display mt-2 text-2xl text-text-strong">Your audit</h2>

              <div className="mt-5 space-y-3">
                <SummaryRow label="Target model" value={PRESETS[preset].name} />
                <SummaryRow label="Dimensions" value={`${dims.length} selected`} />
                <SummaryRow label="Jurisdictions" value={`${juris.length} selected`} />
                <SummaryRow label="Estimated probes" value={`~${estimatedProbes}`} />
                <SummaryRow label="Estimated duration" value="~90s" />
                <SummaryRow
                  label="Estimated cost"
                  value={getCost(PRESETS[preset])}
                  valueClassName={getCost(PRESETS[preset]).startsWith("$0.00") ? "text-mint" : "text-warn"}
                />
              </div>

              <div className="divider-glow my-5" />

              <MagneticButton
                onClick={submit}
                disabled={submitting}
                variant="primary"
                className="w-full !py-4 justify-center text-base"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Launching…
                  </>
                ) : (
                  <>
                    Launch audit <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </MagneticButton>

              <div className="mt-4 flex items-center gap-2 text-xs text-text-muted">
                <Lock className="h-3.5 w-3.5 text-mint" />
                Keys never persisted &middot; in-process only
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
}

function SummaryRow({
  label, value, valueClassName,
}: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-text-muted">{label}</span>
      <motion.span
        key={value}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("font-mono font-medium text-text-strong", valueClassName)}
      >
        {value}
      </motion.span>
    </div>
  );
}

function Card({
  title, caption, children,
}: { title: string; caption?: string; children: React.ReactNode }) {
  return (
    <div className="glass p-6">
      <div className="mb-4">
        {caption && <span className="eyebrow">{caption}</span>}
        <h2 className="display mt-1 text-xl text-text-strong">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, mono,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean }) {
  return (
    <div>
      <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-text-muted">
        {label}
      </label>
      <input
        className={cn(
          "w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm text-text-strong outline-none placeholder:text-text-muted/70 focus:border-mint/60",
          mono && "font-mono"
        )}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function Toggle({
  on, onClick, children,
}: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      className={cn(
        "relative shine-sweep ripple-container overflow-hidden rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-widest transition-colors",
        on
          ? "border-mint bg-mint/10 text-mint"
          : "border-border bg-surface/40 text-text-muted hover:text-text"
      )}
    >
      {children}
    </motion.button>
  );
}
