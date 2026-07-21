"use client";

import { cn, scoreVariant } from "@/lib/utils";
import { useCountUp } from "@/hooks/useCountUp";

interface Props {
  score: number;
  label?: string;
  size?: "sm" | "lg";
  /** Animate from 0 to score on mount. Defaults to true for size="lg". */
  animate?: boolean;
}

const colorMap = {
  accent: "text-accent",
  warning: "text-warning",
  danger: "text-danger",
} as const;

const strokeMap = {
  accent: "hsl(var(--accent))",
  warning: "hsl(var(--warning))",
  danger: "hsl(var(--danger))",
} as const;

export default function ScoreDisplay({ score, label, size = "lg", animate }: Props) {
  const variant = scoreVariant(score);
  const shouldAnimate = animate ?? size === "lg";
  const animated = useCountUp(score, shouldAnimate ? 700 : 0);

  const isLarge = size === "lg";
  const dim = isLarge ? 128 : 64;
  const stroke = isLarge ? 8 : 5;
  const radius = dim / 2 - stroke;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(1, animated / 100));

  return (
    <div className="flex flex-col items-center gap-2">
      {label && (
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          {label}
        </div>
      )}
      <div className="relative" style={{ width: dim, height: dim }}>
        <svg width={dim} height={dim} className="-rotate-90">
          <circle
            cx={dim / 2}
            cy={dim / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={stroke}
          />
          <circle
            cx={dim / 2}
            cy={dim / 2}
            r={radius}
            fill="none"
            stroke={strokeMap[variant]}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.16,1,0.3,1)" }}
          />
        </svg>
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center font-mono font-bold tabular-nums",
            isLarge ? "text-3xl" : "text-lg",
            colorMap[variant]
          )}
        >
          {Math.round(animated)}
        </div>
      </div>
    </div>
  );
}
