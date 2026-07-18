"use client";

import { useState, useEffect } from "react";

export function useWaveform(audioUrl: string | null): number[] {
  const [waveform, setWaveform] = useState<number[]>([]);

  useEffect(() => {
    if (!audioUrl) {
      setWaveform([]);
      return;
    }

    let cancelled = false;

    const loadWaveform = async () => {
      try {
        const audioContext = new AudioContext();
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        const channelData = audioBuffer.getChannelData(0);
        // Downsample to ~100 points
        const points = 100;
        const blockSize = Math.floor(channelData.length / points);
        const data: number[] = [];

        for (let i = 0; i < points; i++) {
          let sum = 0;
          const start = i * blockSize;
          const end = Math.min(start + blockSize, channelData.length);
          for (let j = start; j < end; j++) {
            sum += Math.abs(channelData[j]);
          }
          data.push(sum / (end - start));
        }

        // Normalize
        const max = Math.max(...data, 0.0001);
        const normalized = data.map((v) => v / max);

        if (!cancelled) {
          setWaveform(normalized);
        }

        audioContext.close();
      } catch {
        if (!cancelled) setWaveform([]);
      }
    };

    loadWaveform();
    return () => { cancelled = true; };
  }, [audioUrl]);

  return waveform;
}
