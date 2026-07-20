"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { guestStorage } from "@/lib/storage";
import VideoPlayer from "@/components/VideoPlayer";
import RecorderPanel from "@/components/RecorderPanel";
import ScoreDisplay from "@/components/ScoreDisplay";
import ProgressBar from "@/components/ProgressBar";
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

  // When sentence changes (and autoFlow on), start playing
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

  // After showing score, auto-advance after 3s if autoFlow on
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
        <div className="animate-spin h-8 w-8 border-2 border-gray-300 border-t-blue-500 rounded-full" />
      </div>
    );
  }

  if (error || !material || !material.transcript) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-red-500">{error || "素材加载失败"}</p>
        <button onClick={() => router.push("/")} className="text-blue-600 hover:underline">
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
          className="text-gray-500 hover:text-gray-700"
        >
          ← 返回素材
        </button>
        <h2 className="font-semibold text-gray-800 truncate max-w-md">
          {material.title || "练习中"}
        </h2>
        <span className="text-sm text-gray-500">
          第 {currentIndex + 1}/{total} 句 · {phaseLabel(phase)}
        </span>
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

          <div className="p-4 bg-white rounded-xl border border-gray-200 min-h-[80px]">
            <p className="text-lg font-medium text-gray-800">
              {currentSentence?.text || "—"}
            </p>
          </div>
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
            <div className="flex items-center gap-2 text-sm text-gray-500 justify-center">
              <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
              正在评估发音...
            </div>
          )}

          {phase === "showing_score" && lastAttempt && (
            <div className="p-4 bg-white rounded-xl border border-gray-200 space-y-4">
              <ScoreDisplay score={lastAttempt.score} label="本句得分" />
              {lastAttempt.word_scores && lastAttempt.word_scores.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 mb-2">逐词评分</div>
                  <div className="flex flex-wrap gap-2">
                    {lastAttempt.word_scores.map((ws, i) => (
                      <span
                        key={i}
                        className={`px-2 py-1 rounded text-sm font-medium ${
                          ws.score >= 80
                            ? "bg-green-100 text-green-700"
                            : ws.score >= 60
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {ws.word} {Math.round(ws.score)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {lastAttempt.suggestions && lastAttempt.suggestions.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 mb-2">纠音建议</div>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                    {lastAttempt.suggestions.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar: auto-flow controls + navigation */}
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex-1 max-w-md">
          <ProgressBar current={currentIndex + 1} total={total} />
        </div>

        <div className="flex items-center gap-3 flex-wrap justify-center">
          <button
            onClick={() => setAutoFlow((a) => !a)}
            className={`px-3 py-2 rounded-lg text-sm font-medium ${
              autoFlow
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {autoFlow ? "⏸ 暂停自动" : "▶ 开启自动"}
          </button>

          <button
            onClick={handleReRecord}
            disabled={phase !== "showing_score"}
            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            🔁 重录
          </button>

          <button
            onClick={() => setReplayKey((k) => k + 1)}
            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
          >
            ▶ 重播
          </button>

          <button
            onClick={() => goToSentence(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            ⏮
          </button>

          {currentIndex < total - 1 ? (
            <button
              onClick={() => goToSentence(currentIndex + 1)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              下一句 ⏭
            </button>
          ) : (
            <button
              onClick={handleComplete}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm"
            >
              完成 ✓
            </button>
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
