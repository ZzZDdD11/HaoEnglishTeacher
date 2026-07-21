"use client";

import { useState } from "react";
import { cn, scoreVariant } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { WordScore } from "@/types";

interface Props {
  wordScores: WordScore[];
}

/**
 * Renders per-word score badges. Clicking a word toggles an inline detail
 * popover showing its score and issue (e.g. "漏读") — the data was already
 * being computed by the backend but previously only shown as plain text.
 */
export default function WordScoreList({ wordScores }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="flex flex-wrap gap-1.5">
      {wordScores.map((ws, i) => {
        const variant = scoreVariant(ws.score);
        const isOpen = openIndex === i;
        return (
          <div key={i} className="relative">
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : i)}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
            >
              <Badge variant={variant} className="cursor-pointer">
                {ws.word}
              </Badge>
            </button>
            {isOpen && (
              <div
                className={cn(
                  "absolute z-10 top-full left-0 mt-1.5 whitespace-nowrap rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg score-reveal"
                )}
              >
                <div className="font-mono tabular-nums text-foreground">
                  得分 {Math.round(ws.score)}
                </div>
                {ws.issue && (
                  <div className="text-muted-foreground mt-0.5">{ws.issue}</div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
