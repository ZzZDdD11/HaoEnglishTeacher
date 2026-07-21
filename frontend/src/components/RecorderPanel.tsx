"use client";

import { Mic } from "lucide-react";
import { useWaveform } from "@/hooks/useWaveform";
import WaveformCompare from "@/components/WaveformCompare";
import { cn } from "@/lib/utils";

interface Props {
  armed: boolean;
  isRecording: boolean;
  duration: number;
  audioUrl: string | null;
  onStart: () => void;
  onStop: () => void;
}

export default function RecorderPanel({
  armed,
  isRecording,
  duration,
  audioUrl,
  onStart,
  onStop,
}: Props) {
  const userWaveform = useWaveform(audioUrl);

  const formatDuration = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-4 fade-up">
      <button
        onClick={isRecording ? onStop : onStart}
        className={cn(
          "w-full py-6 rounded-xl text-base font-medium transition-all duration-300 flex flex-col items-center justify-center gap-3",
          isRecording
            ? "bg-recording text-white pulse-recording"
            : "bg-muted/40 border border-border text-foreground hover:border-accent/40 hover:bg-accent/[0.04]"
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
            <span className="text-xs opacity-80">按空格键或点击停止</span>
          </>
        ) : (
          <>
            <Mic className="w-6 h-6" strokeWidth={1.5} />
            <span>{armed ? "按空格键开始录音" : "点击开始录音"}</span>
          </>
        )}
      </button>

      {audioUrl && (
        <WaveformCompare referenceWaveform={[]} userWaveform={userWaveform} />
      )}
    </div>
  );
}
