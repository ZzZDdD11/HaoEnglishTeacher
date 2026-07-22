"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Play,
  RotateCcw,
  Check,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { guestStorage } from "@/lib/storage";
import { usePracticeFlow } from "@/hooks/usePracticeFlow";
import VideoPlayer from "@/components/VideoPlayer";
import RecorderPanel from "@/components/RecorderPanel";
import ScoreDisplay from "@/components/ScoreDisplay";
import ProgressBar from "@/components/ProgressBar";
import WordScoreList from "@/components/WordScoreList";
import SentenceSidebar from "@/components/SentenceSidebar";
import ShortcutsPanel from "@/components/ShortcutsPanel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Material, SentenceAttempt } from "@/types";
import type { Phase } from "@/hooks/usePracticeFlow";

const SHORTCUTS_SEEN_KEY = "shadowing_shortcuts_seen";

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
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const currentSentence = material?.transcript?.[currentIndex];
  const lastAttempt = attempts[currentIndex];
  const total = material?.transcript?.length ?? 0;

  useEffect(() => {
    loadMaterial();
  }, [materialId]);

  useEffect(() => {
    if (!localStorage.getItem(SHORTCUTS_SEEN_KEY)) {
      setShortcutsOpen(true);
      localStorage.setItem(SHORTCUTS_SEEN_KEY, "1");
    }
  }, []);

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

  const goToSentence = (index: number) => {
    if (index >= 0 && index < total) setCurrentIndex(index);
  };

  const handleAttemptRecorded = (index: number, attempt: SentenceAttempt) => {
    setAttempts((prev) => ({ ...prev, [index]: attempt }));
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

  const handleAdvance = () => {
    if (currentIndex < total - 1) {
      goToSentence(currentIndex + 1);
    } else {
      handleComplete();
    }
  };

  const flow = usePracticeFlow({
    sessionId,
    currentSentence,
    currentIndex,
    onAttemptRecorded: handleAttemptRecorded,
    onAdvance: handleAdvance,
  });

  // "?" toggles the shortcuts panel from anywhere on the page.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "?") return;
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      setShortcutsOpen((v) => !v);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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

  return (
    <main className="max-w-6xl mx-auto py-6 px-4">
      <ShortcutsPanel open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          返回
        </button>
        <h2 className="font-display text-lg text-foreground truncate max-w-md">
          {material.title || "练习中"}
        </h2>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {currentIndex + 1}/{total}
          </span>
          <Badge variant={badgeVariant(flow.phase)}>{phaseLabel(flow.phase)}</Badge>
          <button
            onClick={() => setShortcutsOpen(true)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="操作说明"
          >
            <HelpCircle className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Current action hint */}
      <div className="mb-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <kbd className="px-2 py-1 rounded border border-border bg-muted/40 font-mono">Space</kbd>
        <span>{spaceHint(flow.phase)}</span>
      </div>

      {/* Main content: video + sentence list, sidebar recorder/feedback */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-4">
          <VideoPlayer
            ref={flow.videoRef}
            key={currentIndex}
            sourceUrl={material.source_url}
            audioSrc={`/api/materials/${materialId}/audio`}
            startMs={currentSentence?.start_ms}
            endMs={currentSentence?.end_ms}
            onAudioEnded={flow.onAudioEnded}
          />

          <Card className="p-5" key={`sentence-${currentIndex}`}>
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2 font-mono">
              Sentence {currentIndex + 1}
            </div>
            <p className="font-display text-xl text-foreground leading-snug slide-in">
              {currentSentence?.text || "—"}
            </p>
          </Card>

          <SentenceSidebar
            sentences={material.transcript}
            attempts={attempts}
            currentIndex={currentIndex}
            onSelect={goToSentence}
          />
        </div>

        <div className="space-y-4 lg:sticky lg:top-6">
          {(flow.phase === "ready" || flow.phase === "playing") && (
            <Card className="p-8 flex flex-col items-center gap-3 text-muted-foreground">
              <Play className="w-6 h-6" strokeWidth={1.5} />
              <span className="text-sm">
                {flow.phase === "playing" ? "播放中..." : "按空格键播放原声"}
              </span>
            </Card>
          )}

          {(flow.phase === "armed" || flow.phase === "recording") && currentSentence && (
            <RecorderPanel
              armed={flow.phase === "armed"}
              isRecording={flow.recorder.isRecording}
              duration={flow.recorder.duration}
              audioUrl={flow.recorder.audioUrl}
              onStart={flow.actions.startRecording}
              onStop={flow.actions.stopRecording}
            />
          )}

          {flow.phase === "evaluating" && (
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

          {flow.phase === "error" && (
            <Card className="p-8 flex flex-col items-center gap-4 border-warning/30 score-reveal">
              <AlertTriangle className="w-6 h-6 text-warning" strokeWidth={1.5} />
              <div className="text-center space-y-1">
                <p className="text-sm text-foreground">
                  {flow.errorKind === "mic" ? "无法访问麦克风" : "评分失败"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {flow.errorKind === "mic"
                    ? "请检查浏览器麦克风权限后重试"
                    : "网络或服务异常，可重试或跳过本句"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="accent" size="sm" onClick={flow.actions.retry}>
                  按空格重试
                </Button>
                <Button variant="outline" size="sm" onClick={flow.actions.skipSentence}>
                  跳过本句
                </Button>
              </div>
            </Card>
          )}

          {flow.phase === "showing_score" && lastAttempt && (
            <Card className="p-6 space-y-5 score-reveal">
              <ScoreDisplay score={lastAttempt.score} label="本句得分" />

              {lastAttempt.word_scores && lastAttempt.word_scores.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2 font-mono">
                    逐词评分 · 点击查看详情
                  </div>
                  <WordScoreList wordScores={lastAttempt.word_scores} />
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

      {/* Bottom bar: navigation */}
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex-1 max-w-md w-full">
          <ProgressBar current={currentIndex + 1} total={total} />
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={flow.actions.reRecord}
            disabled={flow.phase !== "showing_score"}
          >
            <RotateCcw className="w-4 h-4" strokeWidth={1.5} />
            重录
          </Button>

          <Button variant="outline" size="sm" onClick={() => flow.videoRef.current?.play()}>
            <Play className="w-4 h-4" strokeWidth={1.5} />
            重播
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => goToSentence(currentIndex - 1)}
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
          </Button>

          {currentIndex < total - 1 ? (
            <Button variant="default" size="sm" onClick={() => goToSentence(currentIndex + 1)}>
              下一句
              <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
            </Button>
          ) : (
            <Button variant="accent" size="sm" onClick={handleComplete}>
              完成
              <Check className="w-4 h-4" strokeWidth={1.5} />
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
    case "armed":
      return "待录音";
    case "recording":
      return "录音中";
    case "evaluating":
      return "评估中";
    case "showing_score":
      return "查看分数";
    case "error":
      return "出错了";
    default:
      return "待播放";
  }
}

function badgeVariant(phase: Phase): "accent" | "danger" | "warning" {
  if (phase === "recording") return "danger";
  if (phase === "evaluating") return "warning";
  if (phase === "error") return "danger";
  return "accent";
}

function spaceHint(phase: Phase): string {
  switch (phase) {
    case "ready":
      return "播放原声";
    case "armed":
      return "开始录音";
    case "recording":
      return "停止录音";
    case "showing_score":
      return "下一句";
    case "error":
      return "重试";
    default:
      return "请稍候";
  }
}
