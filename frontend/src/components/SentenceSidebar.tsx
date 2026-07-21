"use client";

import { useEffect, useRef } from "react";
import { cn, scoreVariant } from "@/lib/utils";
import type { SentenceAttempt, TranscriptSentence } from "@/types";

interface Props {
  sentences: TranscriptSentence[];
  attempts: Record<number, SentenceAttempt>;
  currentIndex: number;
  onSelect: (index: number) => void;
}

const dotColorMap = {
  accent: "bg-accent",
  warning: "bg-warning",
  danger: "bg-danger",
} as const;

/** Scrollable list of every sentence in the material, for jumping directly
 * to any sentence instead of stepping through with prev/next only. */
export default function SentenceSidebar({
  sentences,
  attempts,
  currentIndex,
  onSelect,
}: Props) {
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentIndex]);

  return (
    <div className="max-h-[420px] overflow-y-auto rounded-xl border border-border bg-card/50">
      {sentences.map((s, i) => {
        const attempt = attempts[i];
        const isActive = i === currentIndex;
        return (
          <button
            key={i}
            ref={isActive ? activeRef : undefined}
            onClick={() => onSelect(i)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm border-l-2 transition-colors",
              isActive
                ? "border-accent bg-accent/[0.06] text-foreground"
                : "border-transparent text-muted-foreground hover:bg-muted/30 hover:text-foreground"
            )}
          >
            <span className="font-mono text-xs tabular-nums w-6 shrink-0">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="flex-1 truncate">{s.text}</span>
            {attempt ? (
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full shrink-0",
                  dotColorMap[scoreVariant(attempt.score)]
                )}
              />
            ) : (
              <span className="w-3.5 h-3.5 shrink-0 rounded-full border border-border" />
            )}
          </button>
        );
      })}
    </div>
  );
}
