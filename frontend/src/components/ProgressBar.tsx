import { Progress } from "@/components/ui/progress";

interface Props {
  current: number;
  total: number;
}

export default function ProgressBar({ current, total }: Props) {
  const pct = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="flex items-center gap-3 w-full">
      <Progress value={pct} className="flex-1" />
      <span className="text-xs font-mono text-muted-foreground tabular-nums">
        {current}/{total}
      </span>
    </div>
  );
}
