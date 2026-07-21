"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import ScoreDisplay from "@/components/ScoreDisplay";
import SentenceReview from "@/components/SentenceReview";
import SuggestionCard from "@/components/SuggestionCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
        <div className="flex items-end gap-0.5 h-5">
          <span className="eq-bar w-1 h-full bg-accent" style={{ animationDelay: "0ms" }} />
          <span className="eq-bar w-1 h-full bg-accent" style={{ animationDelay: "150ms" }} />
          <span className="eq-bar w-1 h-full bg-accent" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-danger">{error || "报告不存在"}</p>
        <button onClick={() => router.push("/")} className="text-accent hover:underline">
          返回首页
        </button>
      </div>
    );
  }

  const allSuggestions = report.attempts.flatMap((a) => a.suggestions || []);
  const uniqueSuggestions = [...new Set(allSuggestions)];

  return (
    <main className="max-w-3xl mx-auto py-12 px-4">
      <button
        onClick={() => router.push("/")}
        className="text-muted-foreground hover:text-foreground text-sm mb-8 transition-colors"
      >
        ← 返回首页
      </button>

      <div className="mb-10 fade-up">
        <div className="text-[10px] uppercase tracking-[0.4em] text-accent mb-2 font-mono">
          Practice Report
        </div>
        <h1 className="font-display text-4xl font-bold mb-2">练习报告</h1>
        <p className="text-muted-foreground">{report.material_title}</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-10 fade-up" style={{ animationDelay: "100ms" }}>
        <Card className="p-5">
          <ScoreDisplay score={report.session.overall_score || 0} label="总分" />
        </Card>
        <Card className="p-5">
          <ScoreDisplay score={report.session.pronunciation_score || 0} label="发音" />
        </Card>
        <Card className="p-5">
          <ScoreDisplay score={report.session.rhythm_score || 0} label="节奏" />
        </Card>
      </div>

      {uniqueSuggestions.length > 0 && (
        <div className="mb-10 fade-up" style={{ animationDelay: "150ms" }}>
          <SuggestionCard suggestions={uniqueSuggestions} />
        </div>
      )}

      <section className="fade-up" style={{ animationDelay: "200ms" }}>
        <h2 className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-4 font-mono">
          逐句回顾
        </h2>
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

      <div className="mt-10 fade-up">
        <Button
          variant="accent"
          className="w-full"
          onClick={() => router.push(`/practice/${report.session.material_id}`)}
        >
          重新练习
        </Button>
      </div>
    </main>
  );
}
