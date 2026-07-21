import { Card } from "@/components/ui/card";

interface Props {
  suggestions: string[];
}

export default function SuggestionCard({ suggestions }: Props) {
  if (suggestions.length === 0) return null;

  return (
    <Card className="border-accent/20 bg-accent/[0.04]">
      <div className="p-5">
        <h3 className="font-display text-sm uppercase tracking-[0.25em] text-accent mb-4">
          重点练习
        </h3>
        <ul className="space-y-2.5">
          {suggestions.map((s, i) => (
            <li
              key={i}
              className="text-sm text-foreground/80 flex items-start gap-3"
            >
              <span className="text-accent mt-0.5 font-mono text-xs tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="leading-relaxed">{s}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
