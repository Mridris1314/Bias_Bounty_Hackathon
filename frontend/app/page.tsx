"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CountUp from "react-countup";
import { ArrowRight, ShieldCheck, Cpu, FileSearch, Scale, Radar } from "lucide-react";
import { SpotlightCard } from "@/components/SpotlightCard";
import { MagneticButton } from "@/components/MagneticButton";

const AGENTS = [
  {
    n: "01",
    name: "Counterfactual Test Battery",
    desc: "Designs deterministic minimal-pair probe batteries in your deployment domain — no LLM-invented prompts.",
    icon: Radar,
    big: true,
  },
  {
    n: "02",
    name: "Adversarial Prober",
    desc: "Executes the battery against the target LLM, including jailbreak variants.",
    icon: Cpu,
  },
  {
    n: "03",
    name: "Statistical Bias Analyst",
    desc: "Computes parity gaps, sentiment deltas, refusal skews, stereotype scores with bootstrap 95% CIs.",
    icon: FileSearch,
  },
  {
    n: "04",
    name: "Regulation Mapper",
    desc: "Grounds each finding in EU AI Act, NIST AI RMF, ISO 42001, MeitY advisory via RAG.",
    icon: Scale,
  },
  {
    n: "05",
    name: "Audit Composer",
    desc: "Ships a regulator-grade PDF with citations, severities, and a copy-pasteable fix.",
    icon: ShieldCheck,
  },
];

const PROMPT_PILLS = ["gender", "religion", "region", "caste", "disability"];

const METHOD_PRINCIPLES = [
  {
    n: "01",
    title: "Deterministic, not improvised",
    desc: "Counterfactual minimal pairs come from a fixed engine, not an LLM inventing prompts on the fly — every run is reproducible.",
  },
  {
    n: "02",
    title: "Bootstrap 95% confidence intervals",
    desc: "Every metric ships with a resampled interval, not a point estimate that overstates certainty.",
  },
  {
    n: "03",
    title: "RAG-grounded citations",
    desc: "Regulation clauses are retrieved live from a vector DB, never recalled from an LLM's memory.",
  },
  {
    n: "04",
    title: "Auto-remediation code, not just warnings",
    desc: "Every finding ships with a system-prompt patch you can paste in and re-test immediately.",
  },
];

const REGULATIONS = [
  { flag: "🇪🇺", name: "EU AI Act", version: "Reg 2024/1689", date: "Feb 2025", clauses: 8 },
  { flag: "🇺🇸", name: "NIST AI RMF", version: "1.0", date: "Jan 2023", clauses: 8 },
  { flag: "🌐", name: "ISO/IEC 42001", version: "2023", date: "2023", clauses: 6 },
  { flag: "🇮🇳", name: "MeitY + DPDP", version: "India", date: "2024", clauses: 6 },
];

const STATS = [
  { end: 5, suffix: "", label: "specialist agents per audit" },
  { end: 4, suffix: "", label: "regulatory frameworks grounded" },
  { end: 7, suffix: "", label: "demographic dimensions covered" },
  { end: 0, prefix: "$", suffix: "", label: "to start — local Ollama or free tiers" },
];

const TESTIMONIALS = [
  {
    quote: "Could cut a manual compliance review from a full day to a couple of minutes.",
    role: "Illustrative — AI risk lead, regulated financial services",
  },
  {
    quote: "The auto-remediation snippet turns a finding into a shippable fix immediately.",
    role: "Illustrative — ML platform lead, fintech",
  },
  {
    quote: "Regulation-cited evidence saves the back-and-forth with legal.",
    role: "Illustrative — compliance lead, insurance",
  },
];

const SAMPLE_RUNS = [
  "◉ audit_a4f2 · ollama-llama3.2:3b · hiring · grade B · 12 findings",
  "◉ audit_a4f3 · gpt-4o-mini · lending · grade A · 3 findings",
  "◉ audit_a4f4 · claude-haiku · healthcare · grade C · 8 findings",
];

function TerminalTicker() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % SAMPLE_RUNS.length), 3000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex items-center gap-3 font-mono text-sm text-text-muted">
      <span className="chip-mint shrink-0">sample run output</span>
      <div className="relative h-5 flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 whitespace-nowrap text-mint"
          >
            {SAMPLE_RUNS[i]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  return (
    <main className="relative overflow-hidden">
      <div className="aurora">
        <div className="aurora-blob aurora-blob-1" />
        <div className="aurora-blob aurora-blob-2" />
        <div className="aurora-blob aurora-blob-3" />
      </div>
      <div className="grain" />
      <div className="absolute inset-0 grid-bg pointer-events-none opacity-40" />

      {/* Fixed nav */}
      <nav className="glass sticky top-0 z-20 mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <span className="pulse-dot h-2 w-2 rounded-full bg-mint" />
          <span className="font-display text-xl italic tracking-tight text-text-strong">BiasBounty</span>
        </div>
        <div className="hidden items-center gap-1 md:flex">
          <Link href="#product" className="btn-ghost text-sm">Product</Link>
          <Link href="#method" className="btn-ghost text-sm">Method</Link>
          <Link href="#regulations" className="btn-ghost text-sm">Enterprise</Link>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/audit" className="btn-ghost text-sm">Sign in</Link>
          <MagneticButton variant="primary" className="text-sm" onClick={() => router.push("/audit")}>
            Launch audit <ArrowRight className="h-4 w-4" />
          </MagneticButton>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-56px)] max-w-5xl flex-col items-center justify-center px-6 py-20 text-center">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="chip-mint pulse-ring"
        >
          <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-mint" />
          LOCAL-FIRST &middot; UNLIMITED &middot; $<CountUp end={0} duration={1} />/audit
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="display mt-6 text-6xl leading-[1.05] text-text-strong sm:text-7xl"
        >
          Audit any AI
          <br />
          before it <span className="shine-text">audits you.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-6 max-w-2xl text-xl leading-relaxed text-text-muted"
        >
          The forensic-grade compliance auditor for language models. Point at any
          endpoint. Ship a regulator-ready report in ninety seconds.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
        >
          <MagneticButton variant="primary" onClick={() => router.push("/audit")}>
            Launch an audit <ArrowRight className="h-4 w-4" />
          </MagneticButton>
          <MagneticButton variant="secondary" onClick={() => document.getElementById("method")?.scrollIntoView({ behavior: "smooth" })}>
            Read the method
          </MagneticButton>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-14 flex flex-col items-center gap-3"
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-text-dim">
            Built for teams shipping to
          </span>
          <span className="font-mono text-sm uppercase tracking-widest text-text-dim">
            EU AI Act &middot; NIST AI RMF &middot; ISO 42001 &middot; India MeitY
          </span>
        </motion.div>
      </section>

      {/* Live terminal strip */}
      <section className="relative z-10 border-y border-border bg-surface/60 py-8">
        <div className="mx-auto max-w-5xl px-6">
          <div className="border-light rounded-xl border border-border bg-surface/40 px-4 py-3">
            <TerminalTicker />
          </div>
        </div>
      </section>

      {/* Bento grid — agents */}
      <section id="product" className="relative z-10 mx-auto max-w-7xl px-6 py-24">
        <div className="mb-10">
          <span className="eyebrow">the crew</span>
          <h2 className="display mt-3 text-4xl text-text-strong">Five specialists. One verdict.</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3 md:grid-rows-2">
          {AGENTS.map((a, idx) => (
            <motion.div
              key={a.n}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className={a.big ? "md:col-span-2" : ""}
            >
              <SpotlightCard className="h-full">
                <div className="flex items-start justify-between">
                  <span className="font-mono text-xs text-mint">{a.n}</span>
                  <a.icon className="h-4 w-4 text-mint" />
                </div>
                <h3 className="display mt-4 text-2xl text-text-strong">{a.name}</h3>
                <p className="mt-2 text-sm text-text-muted">{a.desc}</p>
                {a.big && (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {PROMPT_PILLS.map((p) => (
                      <span key={p} className="chip">{p} swap</span>
                    ))}
                  </div>
                )}
              </SpotlightCard>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Method */}
      <section id="method" className="relative z-10 mx-auto max-w-7xl px-6 py-24">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <span className="eyebrow">method</span>
            <h2 className="display mt-3 text-5xl text-text-strong">Rigor, not ritual.</h2>
          </div>
          <div className="space-y-8">
            {METHOD_PRINCIPLES.map((m, i) => (
              <motion.div
                key={m.n}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="border-b border-border pb-8 last:border-0"
              >
                <span className="font-mono text-xs text-mint">{m.n}</span>
                <h3 className="display mt-2 text-2xl text-text-strong">{m.title}</h3>
                <p className="mt-2 text-text-muted">{m.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Regulations */}
      <section id="regulations" className="relative z-10 mx-auto max-w-7xl px-6 py-24">
        <div className="mb-10">
          <span className="eyebrow">grounded by</span>
          <h2 className="display mt-3 text-4xl text-text-strong">
            Four regulatory bodies. Every finding cited.
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {REGULATIONS.map((r, i) => (
            <motion.div
              key={r.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="card-interactive"
            >
              <div className="text-2xl">{r.flag}</div>
              <h3 className="display mt-3 text-xl text-text-strong">{r.name}</h3>
              <p className="mt-1 text-sm text-text-muted">{r.version} &middot; {r.date}</p>
              <p className="mt-3 font-mono text-[11px] uppercase tracking-widest text-mint">
                {r.clauses} clauses indexed
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Stats band */}
      <section className="relative z-10 border-y border-border bg-surface/60 py-16">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-6 md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <div className="display text-5xl text-text-strong">
                {s.prefix ?? ""}
                <CountUp end={s.end} duration={2} />
                {s.suffix ?? ""}
              </div>
              <p className="mt-2 text-sm text-text-muted">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials — illustrative, not verified customer quotes */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 py-24">
        <div className="mb-8">
          <span className="eyebrow">illustrative use cases</span>
          <h2 className="display mt-3 text-3xl text-text-strong">Who this is built for</h2>
          <p className="mt-2 max-w-xl text-sm text-text-muted">
            Hypothetical scenarios illustrating fit — not verified customer quotes.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="card"
            >
              <div className="font-display text-3xl italic text-mint">&ldquo;</div>
              <p className="-mt-4 font-display text-lg italic text-text">{t.quote}</p>
              <p className="mt-4 font-mono text-[11px] uppercase tracking-widest text-text-dim">
                {t.role}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 mx-auto max-w-3xl px-6 py-32 text-center">
        <div className="aurora-blob aurora-blob-1 !opacity-10" style={{ position: "absolute", top: "-100px", left: "50%", transform: "translateX(-50%)" }} />
        <h2 className="display relative text-5xl text-text-strong">
          Ready to see what your AI actually says?
        </h2>
        <MagneticButton
          variant="primary"
          className="relative mt-8 text-lg"
          onClick={() => router.push("/audit")}
        >
          Launch an audit <ArrowRight className="h-5 w-5" />
        </MagneticButton>
        <div className="relative mt-6">
          <span className="chip">Free to self-host &middot; hosted Pro (planned): $49/mo</span>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-14 md:grid-cols-4">
          <div>
            <span className="font-display text-lg italic text-text-strong">BiasBounty</span>
          </div>
          <FooterCol title="Product" items={["Audit", "Method", "Pricing"]} />
          <FooterCol title="Method" items={["Counterfactuals", "Bootstrap CIs", "RAG citations"]} />
          <FooterCol title="Regulations" items={["EU AI Act", "NIST AI RMF", "ISO 42001", "MeitY"]} />
        </div>
        <div className="divider-glow" />
        <p className="mx-auto max-w-7xl px-6 py-6 text-center text-xs text-text-dim">
          BiasBounty — built for regulators, engineers, and the people they protect. &middot; MIT license
        </p>
      </footer>
    </main>
  );
}

function FooterCol({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <span className="font-mono text-[10px] uppercase tracking-widest text-text-dim">{title}</span>
      <ul className="mt-3 space-y-2 text-sm text-text-muted">
        {items.map((it) => (
          <li key={it}>{it}</li>
        ))}
      </ul>
    </div>
  );
}
