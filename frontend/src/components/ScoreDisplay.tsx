import { cn } from "@/lib/utils";

interface Props {
  score: number;
  label?: string;
  size?: "sm" | "lg";
}

export default function ScoreDisplay({ score, label, size = "lg" }: Props) {
  const color =
    score >= 80
      ? "text-accent"
      : score >= 60
      ? "text-warning"
      : "text-danger";

  const sz = size === "lg" ? "text-6xl" : "text-3xl";

  return (
    <div className="text-center">
      {label && (
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">
          {label}
        </div>
      )}
      <div className={cn("font-mono font-bold tabular-nums leading-none", sz, color)}>
        {Math.round(score)}
        <span className="text-sm font-normal text-muted-foreground ml-1">/100</span>
      </div>
    </div>
  );
}
