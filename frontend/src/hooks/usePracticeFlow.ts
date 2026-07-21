"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { useRecorder } from "@/hooks/useRecorder";
import type { VideoPlayerHandle } from "@/components/VideoPlayer";
import type { SentenceAttempt, TranscriptSentence } from "@/types";

export type Phase =
  | "ready" // sentence loaded, waiting for user to play reference audio
  | "playing" // reference audio playing
  | "armed" // playback finished, waiting for user to start recording
  | "recording" // recording user's voice
  | "evaluating" // submitting + scoring
  | "showing_score" // result visible, waiting for user to advance
  | "error"; // mic permission or scoring failed

export type ErrorKind = "mic" | "submit" | null;

interface UsePracticeFlowParams {
  sessionId: string | null;
  currentSentence: TranscriptSentence | undefined;
  currentIndex: number;
  onAttemptRecorded: (index: number, attempt: SentenceAttempt) => void;
  /** Called when the user is done with the current sentence and wants to move on. */
  onAdvance: () => void;
}

/**
 * Owns the entire lifecycle of practicing a single sentence: playing the
 * reference audio, recording the user, submitting for evaluation, and
 * surfacing errors with a retry path. One hook instance per practice page;
 * re-run its internal reset whenever the sentence changes.
 */
export function usePracticeFlow({
  sessionId,
  currentSentence,
  currentIndex,
  onAttemptRecorded,
  onAdvance,
}: UsePracticeFlowParams) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [errorKind, setErrorKind] = useState<ErrorKind>(null);

  const videoRef = useRef<VideoPlayerHandle>(null);
  const recorder = useRecorder();

  // Tracks which sentence a recording belongs to, so that if the user
  // switches sentences mid-recording, the resulting blob (which arrives
  // asynchronously via MediaRecorder.onstop) is discarded instead of being
  // submitted against the wrong sentence.
  const recordingIndexRef = useRef<number | null>(null);
  const pendingBlobRef = useRef<Blob | null>(null);
  const prevBlobRef = useRef<Blob | null>(null);

  // Reset to "ready" whenever the sentence changes, and stop any recording
  // that was still in progress for the sentence we're leaving.
  useEffect(() => {
    if (recorder.isRecording) {
      recorder.stop();
    }
    recordingIndexRef.current = null;
    pendingBlobRef.current = null;
    setErrorKind(null);
    setPhase("ready");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  const play = useCallback(() => {
    if (phase !== "ready") return;
    videoRef.current?.play();
    setPhase("playing");
  }, [phase]);

  const handleAudioEnded = useCallback(() => {
    setPhase("armed");
  }, []);

  const startRecording = useCallback(async () => {
    if (phase !== "armed") return;
    try {
      recordingIndexRef.current = currentIndex;
      await recorder.start();
      setPhase("recording");
    } catch (err) {
      recordingIndexRef.current = null;
      setErrorKind("mic");
      setPhase("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentIndex]);

  const stopRecording = useCallback(() => {
    if (phase !== "recording") return;
    recorder.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const submit = useCallback(
    (blob: Blob) => {
      if (!sessionId || !currentSentence) return;
      const targetIndex = currentIndex;
      setPhase("evaluating");
      apiClient
        .submitAttempt(sessionId, blob, currentSentence.sentence_index, currentSentence.text)
        .then((result) => {
          if (recordingIndexRef.current !== targetIndex && targetIndex !== currentIndex) return;
          pendingBlobRef.current = null;
          onAttemptRecorded(targetIndex, result.attempt);
          setPhase("showing_score");
        })
        .catch(() => {
          pendingBlobRef.current = blob;
          setErrorKind("submit");
          setPhase("error");
        });
    },
    [sessionId, currentSentence, currentIndex, onAttemptRecorded]
  );

  // When the recorder produces a blob (via VAD auto-stop or manual stop),
  // submit it — but only if it belongs to the sentence we're still on.
  useEffect(() => {
    if (!recorder.audioBlob || recorder.audioBlob === prevBlobRef.current) return;
    prevBlobRef.current = recorder.audioBlob;

    if (recordingIndexRef.current !== currentIndex) {
      // User switched sentences mid-recording; discard.
      return;
    }
    submit(recorder.audioBlob);
  }, [recorder.audioBlob, currentIndex, submit]);

  const reRecord = useCallback(() => {
    if (phase !== "showing_score") return;
    setPhase("armed");
  }, [phase]);

  const retry = useCallback(() => {
    if (phase !== "error") return;
    if (errorKind === "submit" && pendingBlobRef.current) {
      const blob = pendingBlobRef.current;
      setErrorKind(null);
      submit(blob);
    } else {
      // Mic permission error: let the user try starting the recording again.
      setErrorKind(null);
      setPhase("armed");
    }
  }, [phase, errorKind, submit]);

  const skipSentence = useCallback(() => {
    setErrorKind(null);
    onAdvance();
  }, [onAdvance]);

  const advance = useCallback(() => {
    if (phase !== "showing_score") return;
    onAdvance();
  }, [phase, onAdvance]);

  // Space bar drives the whole flow.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      e.preventDefault();

      switch (phase) {
        case "ready":
          play();
          break;
        case "armed":
          startRecording();
          break;
        case "recording":
          stopRecording();
          break;
        case "showing_score":
          advance();
          break;
        case "error":
          retry();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, play, startRecording, stopRecording, advance, retry]);

  return {
    phase,
    errorKind,
    videoRef,
    recorder: {
      isRecording: recorder.isRecording,
      duration: recorder.duration,
      audioUrl: recorder.audioUrl,
    },
    onAudioEnded: handleAudioEnded,
    actions: { play, startRecording, stopRecording, reRecord, retry, skipSentence, advance },
  };
}
