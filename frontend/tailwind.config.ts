import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Arctic Mint palette
        bg: "#0A0B0D",
        "bg-elevated": "#0F1116",
        surface: "#12141A",
        "surface-2": "#1A1D26",
        "surface-3": "#232733",
        border: "#2A2E3B",
        "border-strong": "#3A3F50",
        text: "#F0F2F5",
        "text-strong": "#FFFFFF",
        "text-muted": "#8B92A5",
        "text-dim": "#5A6072",
        mint: {
          DEFAULT: "#00F5A0",
          bright: "#3AFFB8",
          dim: "#00B378",
          glow: "rgba(0, 245, 160, 0.15)",
        },
        salmon: {
          DEFAULT: "#FF6B6B",
          dim: "#CC5555",
        },
        ok: "#4ADE80",
        warn: "#FBBF24",
        danger: "#F87171",
        info: "#60A5FA",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "Inter", "system-ui"],
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"],
      },
      backgroundImage: {
        "grid": "linear-gradient(rgba(42,46,59,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(42,46,59,0.4) 1px, transparent 1px)",
        "mint-glow":
          "radial-gradient(ellipse at top, rgba(0,245,160,0.18), transparent 60%)",
      },
      backgroundSize: {
        "grid": "42px 42px",
      },
      keyframes: {
        pulse_ring: {
          "0%, 100%": { opacity: "0.6", transform: "scale(1)" },
          "50%": { opacity: "0.15", transform: "scale(1.4)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.6", filter: "brightness(1)" },
          "50%": { opacity: "1", filter: "brightness(1.3)" },
        },
        shine: {
          "0%": { backgroundPosition: "0% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "slide-up-fade": {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "scale-in": {
          "0%": { transform: "scale(0.9)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "text-shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "aurora-drift": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "33%": { transform: "translate(40px, -60px) scale(1.15)" },
          "66%": { transform: "translate(-30px, 30px) scale(0.9)" },
        },
      },
      animation: {
        pulse_ring: "pulse_ring 2s ease-in-out infinite",
        shimmer: "shimmer 2.4s linear infinite",
        float: "float 6s ease-in-out infinite",
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
        shine: "shine 6s linear infinite",
        "slide-up-fade": "slide-up-fade 0.6s ease-out both",
        "scale-in": "scale-in 0.4s ease-out both",
        "text-shimmer": "text-shimmer 2.4s linear infinite",
        "aurora-drift-1": "aurora-drift 25s ease-in-out infinite",
        "aurora-drift-2": "aurora-drift 30s ease-in-out infinite 5s",
        "aurora-drift-3": "aurora-drift 35s ease-in-out infinite 10s",
      },
    },
  },
  plugins: [],
};

export default config;
