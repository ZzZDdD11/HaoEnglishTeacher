import { cn } from "@/lib/utils";
import type { SentenceAttempt } from "@/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ScoreDisplay from "@/components/ScoreDisplay";

interface Props {
  attempt: SentenceAttempt;
  sentenceText: string;
  index: number;
}

export default function SentenceReview({ attempt, sentenceText, index }: Props) {
  const isLowScore = attempt.score < 60;

  return (
    <Card
      className={cn(
        "fade-up overflow-hidden",
        isLowScore ? "border-danger/30" : "border-border"
      )}
    >
      <div className="p-4 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {String(index + 1).padStart(2, "0")}
            </span>
            <Badge variant={isLowScore ? "danger" : "accent"}>
              {isLowScore ? "需改进" : "不错"}
            </Badge>
          </div>
          <p className="font-display text-lg text-foreground leading-snug">
            {sentenceText}
          </p>

          {attempt.word_scores && attempt.word_scores.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {attempt.word_scores.map((ws, i) => (
                <Badge
                  key={i}
                  variant={
                    ws.score >= 80 ? "accent" : ws.score >= 60 ? "warning" : "danger"
                  }
                >
                  {ws.word}
                  {ws.issue && (
                    <span className="ml-1 opacity-60 text-[10px]">{ws.issue}</span>
                  )}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <ScoreDisplay score={attempt.score} size="sm" />
      </div>
    </Card>
  );
}
