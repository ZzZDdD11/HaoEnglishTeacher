"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { guestStorage } from "@/lib/storage";
import VideoPlayer from "@/components/VideoPlayer";
import RecorderPanel from "@/components/RecorderPanel";
import ScoreDisplay from "@/components/ScoreDisplay";
import ProgressBar from "@/components/ProgressBar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Material, TranscriptSentence, SentenceAttempt } from "@/types";

type Phase = "idle" | "playing" | "recording" | "evaluating" | "showing_score";

export default function PracticePage() {
  const params = useParams();
  const router = useRouter();
  const materialId = params.id as string;

  const [material, setMaterial] = useState<Material | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [attempts, setAttempts] = useState<Record<number, SentenceAttempt>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [autoFlow, setAutoFlow] = useState(true);
  const [replayKey, setReplayKey] = useState(0);

  const autoFlowRef = useRef(autoFlow);
  autoFlowRef.current = autoFlow;

  const currentSentence: TranscriptSentence | undefined =
    material?.transcript?.[currentIndex];
  const lastAttempt = attempts[currentIndex];

  useEffect(() => {
    loadMaterial();
  }, [materialId]);

  const loadMaterial = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getMaterial(materialId);
      setMaterial(data);
      const session = await apiClient.createSession({
        material_id: materialId,
        mode: "sentence_by_sentence",
      });
      setSessionId(session.id);
      guestStorage.addSession(session.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (material && currentSentence) {
      setPhase("playing");
    }
  }, [currentIndex, replayKey, material, currentSentence]);

  const handleAudioEnded = useCallback(() => {
    if (!autoFlowRef.current) return;
    setPhase("recording");
  }, []);

  const handleRecordingComplete = useCallback(
    async (blob: Blob) => {
      if (!sessionId || !currentSentence) return;
      setPhase("evaluating");
      try {
        const result = await apiClient.submitAttempt(
          sessionId,
          blob,
          currentSentence.sentence_index,
          currentSentence.text
        );
        setAttempts((prev) => ({ ...prev, [currentIndex]: result.attempt }));
        setPhase("showing_score");
      } catch (err) {
        setError("评分失败，请重试");
        setPhase("showing_score");
      }
    },
    [sessionId, currentSentence, currentIndex]
  );

  useEffect(() => {
    if (phase !== "showing_score" || !autoFlow) return;
    const total = material?.transcript?.length ?? 0;
    const timer = setTimeout(() => {
      if (currentIndex < total - 1) {
        setCurrentIndex((i) => i + 1);
      } else {
        handleComplete();
      }
    }, 3000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, autoFlow, currentIndex, material]);

  const goToSentence = (index: number) => {
    if (!material?.transcript) return;
    if (index >= 0 && index < material.transcript.length) {
      setCurrentIndex(index);
      setPhase("idle");
    }
  };

  const handleReRecord = () => {
    setPhase("recording");
  };

  const handleComplete = async () => {
    if (!sessionId) return;
    try {
      await apiClient.completeSession(sessionId);
    } catch {
      /* proceed to report even if complete fails */
    }
    router.push(`/report/${sessionId}`);
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

  if (error || !material || !material.transcript) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-danger">{error || "素材加载失败"}</p>
        <button onClick={() => router.push("/")} className="text-accent hover:underline">
          返回首页
        </button>
      </div>
    );
  }

  const total = material.transcript.length;

  return (
    <main className="max-w-6xl mx-auto py-6 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.push("/")}
          className="text-muted-foreground hover:text-foreground transition-colors text-sm"
        >
          ← 返回
        </button>
        <h2 className="font-display text-lg text-foreground truncate max-w-md">
          {material.title || "练习中"}
        </h2>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {currentIndex + 1}/{total}
          </span>
          <Badge variant={phase === "recording" ? "danger" : phase === "evaluating" ? "warning" : "accent"}>
            {phaseLabel(phase)}
          </Badge>
        </div>
      </div>

      {/* Main content: video + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Video + sentence */}
        <div className="space-y-4">
          <VideoPlayer
            key={`${currentIndex}-${replayKey}`}
            sourceUrl={material.source_url}
            audioSrc={`/api/materials/${materialId}/audio`}
            startMs={currentSentence?.start_ms}
            endMs={currentSentence?.end_ms}
            onAudioEnded={handleAudioEnded}
          />

          <Card className="p-5 fade-up" key={currentIndex}>
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2 font-mono">
              Sentence {currentIndex + 1}
            </div>
            <p className="font-display text-xl text-foreground leading-snug">
              {currentSentence?.text || "—"}
            </p>
          </Card>
        </div>

        {/* Right: Recorder + feedback */}
        <div className="space-y-4">
          {phase === "recording" && currentSentence && (
            <RecorderPanel
              onRecordingComplete={handleRecordingComplete}
              disabled={false}
              autoStart={true}
            />
          )}

          {phase === "evaluating" && (
            <Card className="p-8 flex flex-col items-center gap-3">
              <div className="flex items-end gap-0.5 h-6">
                <span className="eq-bar w-1 h-full bg-accent" style={{ animationDelay: "0ms" }} />
                <span className="eq-bar w-1 h-full bg-accent" style={{ animationDelay: "120ms" }} />
                <span className="eq-bar w-1 h-full bg-accent" style={{ animationDelay: "240ms" }} />
                <span className="eq-bar w-1 h-full bg-accent" style={{ animationDelay: "360ms" }} />
                <span className="eq-bar w-1 h-full bg-accent" style={{ animationDelay: "480ms" }} />
              </div>
              <span className="text-sm text-muted-foreground">正在评估发音...</span>
            </Card>
          )}

          {phase === "showing_score" && lastAttempt && (
            <Card className="p-6 space-y-5 fade-up">
              <ScoreDisplay score={lastAttempt.score} label="本句得分" />

              {lastAttempt.word_scores && lastAttempt.word_scores.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2 font-mono">
                    逐词评分
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {lastAttempt.word_scores.map((ws, i) => (
                      <Badge
                        key={i}
                        variant={
                          ws.score >= 80
                            ? "accent"
                            : ws.score >= 60
                            ? "warning"
                            : "danger"
                        }
                      >
                        {ws.word} {Math.round(ws.score)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {lastAttempt.suggestions && lastAttempt.suggestions.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2 font-mono">
                    纠音建议
                  </div>
                  <ul className="space-y-1.5">
                    {lastAttempt.suggestions.map((s, i) => (
                      <li key={i} className="text-sm text-foreground/80 flex items-start gap-2">
                        <span className="text-accent mt-0.5 font-mono text-xs">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* Bottom bar: auto-flow controls + navigation */}
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex-1 max-w-md w-full">
          <ProgressBar current={currentIndex + 1} total={total} />
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-center">
          <Button
            variant={autoFlow ? "accent" : "outline"}
            size="sm"
            onClick={() => setAutoFlow((a) => !a)}
          >
            {autoFlow ? "⏸ 自动" : "▶ 手动"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleReRecord}
            disabled={phase !== "showing_score"}
          >
            🔁 重录
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setReplayKey((k) => k + 1)}
          >
            ▶ 重播
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => goToSentence(currentIndex - 1)}
            disabled={currentIndex === 0}
          >
            ⏮
          </Button>

          {currentIndex < total - 1 ? (
            <Button
              variant="default"
              size="sm"
              onClick={() => goToSentence(currentIndex + 1)}
            >
              下一句 ⏭
            </Button>
          ) : (
            <Button variant="accent" size="sm" onClick={handleComplete}>
              完成 ✓
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}

function phaseLabel(phase: Phase): string {
  switch (phase) {
    case "playing":
      return "播放中";
    case "recording":
      return "录音中";
    case "evaluating":
      return "评估中";
    case "showing_score":
      return "查看分数";
    default:
      return "";
  }
}
