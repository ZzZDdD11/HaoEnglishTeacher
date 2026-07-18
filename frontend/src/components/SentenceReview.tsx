import type { SentenceAttempt } from "@/types";
import ScoreDisplay from "@/components/ScoreDisplay";

interface Props {
  attempt: SentenceAttempt;
  sentenceText: string;
  index: number;
}

export default function SentenceReview({ attempt, sentenceText, index }: Props) {
  const isLowScore = attempt.score < 60;

  return (
    <div className={`p-4 rounded-xl border ${isLowScore ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-400 font-mono">#{index + 1}</span>
            <span className="text-sm text-gray-500">
              {isLowScore ? "⚠️ 需要改进" : "✅ 不错"}
            </span>
          </div>
          <p className="text-gray-800 font-medium">{sentenceText}</p>

          {attempt.word_scores && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {attempt.word_scores.map((ws, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center px-2 py-0.5 rounded text-sm ${
                    ws.score >= 80
                      ? "bg-green-100 text-green-700"
                      : ws.score >= 60
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {ws.word}
                  {ws.issue && (
                    <span className="ml-1 text-xs opacity-70">{ws.issue}</span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>

        <ScoreDisplay score={attempt.score} />
      </div>
    </div>
  );
}
