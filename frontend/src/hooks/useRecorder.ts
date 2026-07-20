"use client";

import { useState, useRef, useCallback } from "react";

interface UseRecorderReturn {
  start: () => Promise<void>;
  stop: () => void;
  audioBlob: Blob | null;
  isRecording: boolean;
  duration: number;
  audioUrl: string | null;
}

const SILENCE_THRESHOLD = 0.02; // RMS threshold for "silence"
const SILENCE_DURATION_MS = 1500; // 1.5s of silence => stop
const MAX_RECORDING_MS = 30000; // 30s hard cap

export function useRecorder(): UseRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const maxTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const silenceStartRef = useRef<number>(0);

  const cleanupVad = () => {
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  };

  const stop = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    cleanupVad();
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    chunksRef.current = [];
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4",
    });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
      setAudioBlob(blob);
      setAudioUrl(URL.createObjectURL(blob));
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      cleanupVad();
      if (maxTimerRef.current) {
        clearTimeout(maxTimerRef.current);
        maxTimerRef.current = null;
      }
      stream.getTracks().forEach((t) => t.stop());
    };

    mediaRecorderRef.current = mediaRecorder;
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    startTimeRef.current = Date.now();
    mediaRecorder.start();
    setIsRecording(true);

    // Duration timer
    timerRef.current = setInterval(() => {
      setDuration(Date.now() - startTimeRef.current);
    }, 100);

    // VAD: AnalyserNode monitors volume, auto-stop after sustained silence
    try {
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.fftSize);
      silenceStartRef.current = 0;

      vadIntervalRef.current = setInterval(() => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteTimeDomainData(data);
        // Compute RMS
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);

        if (rms < SILENCE_THRESHOLD) {
          if (silenceStartRef.current === 0) {
            silenceStartRef.current = Date.now();
          } else if (Date.now() - silenceStartRef.current >= SILENCE_DURATION_MS) {
            // Sustained silence -> stop
            stop();
          }
        } else {
          silenceStartRef.current = 0;
        }
      }, 100);
    } catch {
      // AudioContext unavailable; VAD disabled, manual stop only
    }

    // Hard cap: 30s
    maxTimerRef.current = setTimeout(() => {
      stop();
    }, MAX_RECORDING_MS);
  }, [stop]);

  return { start, stop, audioBlob, isRecording, duration, audioUrl };
}
