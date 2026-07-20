"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import ScoreDisplay from "@/components/ScoreDisplay";
import SentenceReview from "@/components/SentenceReview";
import SuggestionCard from "@/components/SuggestionCard";
import type { PracticeReport } from "@/types";

export default function ReportPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [report, setReport] = useState<PracticeReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadReport();
  }, [sessionId]);

  const loadReport = async () => {
    try {
      const data = await apiClient.getReport(sessionId);
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载报告失败");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-2 border-gray-300 border-t-blue-500 rounded-full" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-red-500">{error || "报告不存在"}</p>
        <button onClick={() => router.push("/")} className="text-blue-600 hover:underline">
          返回首页
        </button>
      </div>
    );
  }

  const allSuggestions = report.attempts.flatMap((a) => a.suggestions || []);
  const uniqueSuggestions = [...new Set(allSuggestions)];

  return (
    <main className="max-w-3xl mx-auto py-8 px-4">
      {/* Header */}
      <button onClick={() => router.push("/")} className="text-gray-500 hover:text-gray-700 mb-6">
        ← 返回首页
      </button>

      <h1 className="text-2xl font-bold mb-2">📊 练习报告</h1>
      <p className="text-gray-500 mb-8">{report.material_title}</p>

      {/* Overall scores */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="p-4 bg-white rounded-xl border border-gray-200 text-center">
          <ScoreDisplay score={report.session.overall_score || 0} label="总分" />
        </div>
        <div className="p-4 bg-white rounded-xl border border-gray-200 text-center">
          <ScoreDisplay score={report.session.pronunciation_score || 0} label="发音" />
        </div>
        <div className="p-4 bg-white rounded-xl border border-gray-200 text-center">
          <ScoreDisplay score={report.session.rhythm_score || 0} label="节奏" />
        </div>
      </div>

      {/* Suggestions */}
      {uniqueSuggestions.length > 0 && (
        <div className="mb-8">
          <SuggestionCard suggestions={uniqueSuggestions} />
        </div>
      )}

      {/* Sentence-by-sentence review */}
      <section>
        <h2 className="text-lg font-semibold mb-4">逐句回顾</h2>
        <div className="space-y-3">
          {report.attempts.map((attempt) => (
            <SentenceReview
              key={attempt.id}
              attempt={attempt}
              sentenceText={
                attempt.sentence_text ?? `第 ${attempt.sentence_index + 1} 句`
              }
              index={attempt.sentence_index}
            />
          ))}
        </div>
      </section>

      {/* Actions */}
      <div className="mt-8 flex gap-4">
        <button
          onClick={() =>
            router.push(`/practice/${report.session.material_id}`)
          }
          className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700"
        >
          重新练习
        </button>
      </div>
    </main>
  );
}
