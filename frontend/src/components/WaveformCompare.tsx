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
  const renderWaveform = (data: number[], color: string, opacity: number) => {
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
        opacity={opacity}
      />
    ));
  };

  return (
    <div className="space-y-3">
      <div>
        <span className="text-xs text-gray-500 mb-1 block">原声波形</span>
        <div className="bg-gray-100 rounded-lg overflow-hidden" style={{ height }}>
          <svg width="100%" height={height} preserveAspectRatio="none">
            {renderWaveform(referenceWaveform, "#22c55e", 0.6)}
          </svg>
        </div>
      </div>
      <div>
        <span className="text-xs text-gray-500 mb-1 block">你的录音</span>
        <div className="bg-gray-100 rounded-lg overflow-hidden" style={{ height }}>
          <svg width="100%" height={height} preserveAspectRatio="none">
            {renderWaveform(userWaveform, "#ef4444", 0.6)}
          </svg>
        </div>
      </div>
    </div>
  );
}
