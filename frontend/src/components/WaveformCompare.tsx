"use client";

interface Props {
  referenceWaveform: number[];
  userWaveform: number[];
  height?: number;
}

export default function WaveformCompare({
  referenceWaveform,
  userWaveform,
  height = 120,
}: Props) {
  const renderWaveform = (data: number[], color: string) => {
    if (data.length === 0) return null;
    const width = 100 / data.length;
    return data.map((val, i) => (
      <rect
        key={i}
        x={`${i * width}%`}
        y={`${(1 - val) * 100}%`}
        width={`${width}%`}
        height={`${val * 100}%`}
        fill={color}
        opacity={0.7}
        rx="1"
      />
    ));
  };

  return (
    <div className="space-y-3">
      <div>
        <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1.5 block">
          原声
        </span>
        <div
          className="bg-muted/40 rounded-lg overflow-hidden border border-border"
          style={{ height }}
        >
          <svg width="100%" height={height} preserveAspectRatio="none">
            {renderWaveform(referenceWaveform, "hsl(var(--accent))")}
          </svg>
        </div>
      </div>
      <div>
        <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1.5 block">
          你的录音
        </span>
        <div
          className="bg-muted/40 rounded-lg overflow-hidden border border-border"
          style={{ height }}
        >
          <svg width="100%" height={height} preserveAspectRatio="none">
            {renderWaveform(userWaveform, "hsl(var(--recording))")}
          </svg>
        </div>
      </div>
    </div>
  );
}
