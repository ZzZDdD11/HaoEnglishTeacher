"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

interface Props {
  sourceUrl: string;
  audioSrc?: string;
  startMs?: number;
  endMs?: number;
  onAudioEnded?: () => void;
}

export interface VideoPlayerHandle {
  /** Start (or restart) playback of the reference audio for the current sentence. */
  play: () => void;
  /** Skip the remainder of playback, as if it had ended naturally. */
  skip: () => void;
}

/**
 * Only YouTube's embed API supports seeking to a start/end time AND muting
 * the video track (`start`, `end`, `mute` params). Bilibili's embed exposes
 * neither: it always plays from the beginning and always plays its own
 * audio — there is no way to keep it in sync with a per-sentence reference
 * audio track, and its audio would always overlap with ours.
 *
 * So: YouTube gets the dual-track experience (muted video + our audio).
 * Everything else falls back to audio-only — no video iframe, ever.
 */
const VideoPlayer = forwardRef<VideoPlayerHandle, Props>(function VideoPlayer(
  { sourceUrl, audioSrc, startMs, endMs, onAudioEnded },
  ref
) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [iframeNonce, setIframeNonce] = useState(0);

  const isYouTube =
    sourceUrl.includes("youtube.com") || sourceUrl.includes("youtu.be");

  // Wire up the audio element for the current sentence. Does NOT autoplay —
  // playback only starts when play() is called imperatively (Space key).
  useEffect(() => {
    setIsPlaying(false);
    setIframeNonce((n) => n + 1);

    const audio = audioRef.current;
    if (!audio || !audioSrc) return;

    const startSec = startMs ? startMs / 1000 : 0;
    const endSec = endMs ? endMs / 1000 : undefined;

    const stopAndNotify = () => {
      setIsPlaying(false);
      onAudioEnded?.();
    };

    const onLoadedMetadata = () => {
      audio.currentTime = startSec;
    };
    const onTimeUpdate = () => {
      if (endSec !== undefined && audio.currentTime >= endSec) {
        audio.pause();
        stopAndNotify();
      }
    };
    const onEnded = () => stopAndNotify();

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, [audioSrc, startMs, endMs, onAudioEnded]);

  useImperativeHandle(
    ref,
    () => ({
      play: () => {
        const audio = audioRef.current;
        if (!audio) return;
        setIsPlaying(true);
        setIframeNonce((n) => n + 1);
        const startSec = startMs ? startMs / 1000 : 0;
        audio.currentTime = startSec;
        audio.play().catch(() => {});
      },
      skip: () => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.pause();
        setIsPlaying(false);
        onAudioEnded?.();
      },
    }),
    [startMs, onAudioEnded]
  );

  let iframeSrc = "";
  if (isYouTube) {
    const videoId = extractYouTubeId(sourceUrl);
    const startSec = startMs ? Math.floor(startMs / 1000) : 0;
    const endSec = endMs ? Math.floor(endMs / 1000) : undefined;
    iframeSrc = `https://www.youtube.com/embed/${videoId}?start=${startSec}&autoplay=1&mute=1&controls=0&rel=0${
      endSec ? `&end=${endSec}` : ""
    }`;
  }

  // YouTube: show the muted video while playing, swap to the "跟读中"
  // placeholder once recording starts (video stopped).
  const showVideoIframe = isYouTube && iframeSrc && isPlaying;

  return (
    <div className="space-y-2">
      <div className="aspect-video rounded-xl overflow-hidden bg-black border border-border ring-1 ring-inset ring-white/5">
        {showVideoIframe ? (
          <iframe
            key={iframeNonce}
            src={iframeSrc}
            className="w-full h-full"
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <div className="flex items-end gap-0.5 h-5">
              {[0, 120, 240, 360].map((delay) => (
                <span
                  key={delay}
                  className={`eq-bar w-1 h-full ${isPlaying ? "bg-accent" : "bg-recording"}`}
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
            <span className="text-xs uppercase tracking-[0.2em] font-mono">
              {isPlaying ? "播放中" : "跟读中"}
            </span>
          </div>
        )}
      </div>
      {audioSrc && (
        <audio ref={audioRef} src={audioSrc} className="hidden" preload="auto" />
      )}
    </div>
  );
});

export default VideoPlayer;

function extractYouTubeId(url: string): string {
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
  if (shortMatch) return shortMatch[1];
  const longMatch = url.match(/[?&]v=([a-zA-Z0-9_-]+)/);
  if (longMatch) return longMatch[1];
  return "";
}
