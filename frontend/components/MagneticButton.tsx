"use client";
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface MagneticButtonProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost";
}

export function MagneticButton({
  children,
  className,
  onClick,
  disabled,
  variant = "primary",
}: MagneticButtonProps) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!btnRef.current || disabled) return;
    const rect = btnRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    setPos({ x: x * 0.25, y: y * 0.25 });
  };

  const handleMouseLeave = () => {
    setPos({ x: 0, y: 0 });
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!btnRef.current || disabled) return;
    const rect = btnRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();
    setRipples((prev) => [...prev, { id, x, y }]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 700);
    onClick?.();
  };

  const variantClasses = {
    primary: cn(
      "bg-mint text-bg shadow-[0_0_0_1px_rgba(0,245,160,0.4),0_10px_40px_-10px_rgba(0,245,160,0.7)]",
      "btn-glow-pulse"
    ),
    secondary: "border border-border bg-surface/60 text-text hover:border-mint/50",
    ghost: "text-text-muted hover:text-mint",
  };

  return (
    <motion.button
      ref={btnRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      disabled={disabled}
      animate={pos}
      transition={{ type: "spring", stiffness: 200, damping: 15 }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.95, rotateX: 10 }}
      style={{ transformPerspective: 600 }}
      className={cn(
        "relative overflow-hidden inline-flex items-center gap-2 rounded-lg",
        "px-5 py-2.5 font-medium transition-all duration-200",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        variantClasses[variant],
        className
      )}
    >
      {ripples.map((r) => (
        <span
          key={r.id}
          className="ripple"
          style={{
            left: r.x - 20,
            top: r.y - 20,
            width: 40,
            height: 40,
          }}
        />
      ))}
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </motion.button>
  );
}
