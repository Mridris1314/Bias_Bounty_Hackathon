"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const DOOR_EASE = [0.76, 0, 0.24, 1] as const;

/**
 * Full-screen 3D blast-door reveal, played once on mount. Two panels start
 * fully closed (meeting at the center) and swing open on a hinge — real
 * rotateY + perspective, not a flat slide — to reveal the page underneath.
 * The visual payoff for clicking "Launch an audit" on the landing page.
 * Self-contained: drop it at the top of a page and it plays itself out, no
 * cross-page state required.
 */
export function DoorTransition({ label = "Initializing audit environment" }: { label?: string }) {
  const [phase, setPhase] = useState<"closed" | "opening" | "done">("closed");

  useEffect(() => {
    const open = setTimeout(() => setPhase("opening"), 260);
    const done = setTimeout(() => setPhase("done"), 260 + 900);
    return () => {
      clearTimeout(open);
      clearTimeout(done);
    };
  }, []);

  if (phase === "done") return null;
  const isOpening = phase === "opening";

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[100] overflow-hidden [perspective:1800px]"
    >
      {/* seam flare — a bright crack of light right as the doors pull apart */}
      <motion.div
        initial={{ opacity: 0, scaleY: 0.3 }}
        animate={
          isOpening
            ? { opacity: [0, 1, 0], scaleY: [0.3, 1.4, 1.8] }
            : { opacity: 0, scaleY: 0.3 }
        }
        transition={{ duration: 0.55, times: [0, 0.3, 1], ease: "easeOut" }}
        className="absolute inset-y-0 left-1/2 z-10 w-32 -translate-x-1/2 bg-mint-glow blur-2xl"
      />

      {/* left door */}
      <motion.div
        initial={{ rotateY: "0deg", x: "0%" }}
        animate={isOpening ? { rotateY: "-32deg", x: "-100%" } : { rotateY: "0deg", x: "0%" }}
        transition={{ duration: 0.9, ease: DOOR_EASE }}
        style={{ transformOrigin: "left center", transformStyle: "preserve-3d" }}
        className="absolute inset-y-0 left-0 w-1/2 border-r border-mint/25 bg-bg-elevated shadow-[16px_0_60px_rgba(0,0,0,0.65)]"
      >
        <div className="absolute inset-0 bg-grid opacity-[0.15]" />
        <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-mint/70 to-transparent" />
        <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-mint/10 to-transparent" />
      </motion.div>

      {/* right door */}
      <motion.div
        initial={{ rotateY: "0deg", x: "0%" }}
        animate={isOpening ? { rotateY: "32deg", x: "100%" } : { rotateY: "0deg", x: "0%" }}
        transition={{ duration: 0.9, ease: DOOR_EASE }}
        style={{ transformOrigin: "right center", transformStyle: "preserve-3d" }}
        className="absolute inset-y-0 right-0 w-1/2 border-l border-mint/25 bg-bg-elevated shadow-[-16px_0_60px_rgba(0,0,0,0.65)]"
      >
        <div className="absolute inset-0 bg-grid opacity-[0.15]" />
        <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-mint/70 to-transparent" />
        <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-mint/10 to-transparent" />
      </motion.div>

      <AnimatePresence>
        {phase === "closed" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, rotateX: 6 }}
            animate={{ opacity: 1, scale: 1, rotateX: 0 }}
            exit={{ opacity: 0, scale: 1.15, filter: "blur(8px)" }}
            transition={{ duration: 0.35 }}
            style={{ transformStyle: "preserve-3d" }}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4"
          >
            <span className="pulse-ring chip-mint">
              <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-mint" />
              BiasBounty
            </span>
            <span className="font-mono text-xs uppercase tracking-[0.3em] text-text-dim">
              {label}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
