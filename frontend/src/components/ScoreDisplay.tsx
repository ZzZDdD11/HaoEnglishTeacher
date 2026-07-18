interface Props {
  score: number;
  label?: string;
}

export default function ScoreDisplay({ score, label }: Props) {
  const getColor = (s: number) => {
    if (s >= 80) return "text-green-600";
    if (s >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="text-center">
      {label && <div className="text-xs text-gray-500 mb-1">{label}</div>}
      <div className={`text-3xl font-bold ${getColor(score)}`}>
        {Math.round(score)}
      </div>
      <div className="text-xs text-gray-400">分</div>
    </div>
  );
}
