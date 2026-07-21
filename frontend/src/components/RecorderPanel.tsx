"use client";

import { useEffect, useRef } from "react";
import { useRecorder } from "@/hooks/useRecorder";
import { useWaveform } from "@/hooks/useWaveform";
import WaveformCompare from "@/components/WaveformCompare";
import { cn } from "@/lib/utils";

interface Props {
  onRecordingComplete: (blob: Blob) => void;
  disabled?: boolean;
  autoStart?: boolean;
}

export default function RecorderPanel({
  onRecordingComplete,
  disabled,
  autoStart = false,
}: Props) {
  const { start, stop, audioBlob, isRecording, duration, audioUrl } = useRecorder();
  const userWaveform = useWaveform(audioUrl);

  const handleToggleRecording = async () => {
    if (isRecording) {
      stop();
    } else {
      await start();
    }
  };

  useEffect(() => {
    if (autoStart && !isRecording) {
      start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  const prevBlobRef = useRef<Blob | null>(null);
  useEffect(() => {
    if (audioBlob && audioBlob !== prevBlobRef.current) {
      prevBlobRef.current = audioBlob;
      onRecordingComplete(audioBlob);
    }
  }, [audioBlob, onRecordingComplete]);

  const formatDuration = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-4 fade-up">
      <button
        onClick={handleToggleRecording}
        disabled={disabled}
        className={cn(
          "w-full py-6 rounded-xl text-base font-medium transition-all duration-300 flex flex-col items-center justify-center gap-3",
          isRecording
            ? "bg-recording text-white pulse-recording"
            : "bg-muted/40 border border-border text-foreground hover:border-accent/40 hover:bg-accent/[0.04]",
          disabled && "opacity-40 cursor-not-allowed"
        )}
      >
        {isRecording ? (
          <>
            <div className="flex items-end gap-1 h-6">
              <span className="eq-bar w-1 h-full bg-white" style={{ animationDelay: "0ms" }} />
              <span className="eq-bar w-1 h-full bg-white" style={{ animationDelay: "120ms" }} />
              <span className="eq-bar w-1 h-full bg-white" style={{ animationDelay: "240ms" }} />
              <span className="eq-bar w-1 h-full bg-white" style={{ animationDelay: "360ms" }} />
              <span className="eq-bar w-1 h-full bg-white" style={{ animationDelay: "480ms" }} />
            </div>
            <span className="font-mono tabular-nums">{formatDuration(duration)}</span>
            <span className="text-xs opacity-80">说话后自动停止</span>
          </>
        ) : (
          <>
            <span className="text-2xl">🎙</span>
            <span>{autoStart ? "准备录音" : "点击开始录音"}</span>
          </>
        )}
      </button>

      {audioUrl && (
        <WaveformCompare
          referenceWaveform={[]}
          userWaveform={userWaveform}
        />
      )}
    </div>
  );
}
