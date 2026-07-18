"use client";

import { useEffect, useRef } from "react";
import { useRecorder } from "@/hooks/useRecorder";
import { useWaveform } from "@/hooks/useWaveform";
import WaveformCompare from "@/components/WaveformCompare";

interface Props {
  onRecordingComplete: (blob: Blob) => void;
  disabled?: boolean;
}

export default function RecorderPanel({ onRecordingComplete, disabled }: Props) {
  const { start, stop, audioBlob, isRecording, duration, audioUrl } = useRecorder();
  const userWaveform = useWaveform(audioUrl);

  const handleToggleRecording = async () => {
    if (isRecording) {
      stop();
    } else {
      await start();
    }
  };

  // Auto-submit when recording stops
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
    <div className="space-y-4">
      <button
        onClick={handleToggleRecording}
        disabled={disabled}
        className={`w-full py-4 rounded-xl text-lg font-bold transition-all ${
          isRecording
            ? "bg-red-500 text-white animate-pulse"
            : "bg-blue-600 text-white hover:bg-blue-700"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {isRecording ? `🔴 录音中 ${formatDuration(duration)} — 点击停止` : "🎤 点击开始录音"}
      </button>

      {audioUrl && (
        <WaveformCompare
          referenceWaveform={[]} // Will be filled from material data
          userWaveform={userWaveform}
        />
      )}
    </div>
  );
}
