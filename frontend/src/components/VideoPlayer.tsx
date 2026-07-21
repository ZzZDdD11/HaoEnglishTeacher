"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  sourceUrl: string;
  audioSrc?: string;
  startMs?: number;
  endMs?: number;
  onAudioEnded?: () => void;
}

export default function VideoPlayer({
  sourceUrl,
  audioSrc,
  startMs,
  endMs,
  onAudioEnded,
}: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [videoStopped, setVideoStopped] = useState(false);

  const isYouTube =
    sourceUrl.includes("youtube.com") || sourceUrl.includes("youtu.be");
  const isBilibili = sourceUrl.includes("bilibili.com");

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioSrc) return;

    // Reset video state on sentence change
    setVideoStopped(false);

    const startSec = startMs ? startMs / 1000 : 0;
    const endSec = endMs ? endMs / 1000 : undefined;

    const stopVideoAndNotify = () => {
      setVideoStopped(true);
      onAudioEnded?.();
    };

    const onLoadedMetadata = () => {
      audio.currentTime = startSec;
      audio.play().catch(() => {});
    };

    const onTimeUpdate = () => {
      if (endSec !== undefined && audio.currentTime >= endSec) {
        audio.pause();
        stopVideoAndNotify();
      }
    };

    const onEnded = () => stopVideoAndNotify();

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, [audioSrc, startMs, endMs, onAudioEnded]);

  let iframeSrc = "";
  if (isYouTube) {
    const videoId = extractYouTubeId(sourceUrl);
    const startSec = startMs ? Math.floor(startMs / 1000) : 0;
    const endSec = endMs ? Math.floor(endMs / 1000) : undefined;
    iframeSrc = `https://www.youtube.com/embed/${videoId}?start=${startSec}&autoplay=1&mute=1&controls=0&rel=0${
      endSec ? `&end=${endSec}` : ""
    }`;
  } else if (isBilibili) {
    const bvid = extractBilibiliId(sourceUrl);
    iframeSrc = `https://player.bilibili.com/player.html?bvid=${bvid}&autoplay=1`;
  }

  return (
    <div className="space-y-2">
      {iframeSrc && (
        <div className="aspect-video rounded-xl overflow-hidden bg-black border border-border ring-1 ring-inset ring-white/5">
          {videoStopped ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <div className="flex items-end gap-0.5 h-5">
                <span className="eq-bar w-1 h-full bg-recording" style={{ animationDelay: "0ms" }} />
                <span className="eq-bar w-1 h-full bg-recording" style={{ animationDelay: "120ms" }} />
                <span className="eq-bar w-1 h-full bg-recording" style={{ animationDelay: "240ms" }} />
                <span className="eq-bar w-1 h-full bg-recording" style={{ animationDelay: "360ms" }} />
              </div>
              <span className="text-xs uppercase tracking-[0.2em] font-mono">跟读中</span>
            </div>
          ) : (
            <iframe
              src={iframeSrc}
              className="w-full h-full"
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
          )}
        </div>
      )}
      {audioSrc && (
        <audio ref={audioRef} src={audioSrc} className="hidden" preload="auto" />
      )}
    </div>
  );
}

function extractYouTubeId(url: string): string {
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
  if (shortMatch) return shortMatch[1];
  const longMatch = url.match(/[?&]v=([a-zA-Z0-9_-]+)/);
  if (longMatch) return longMatch[1];
  return "";
}

function extractBilibiliId(url: string): string {
  const match = url.match(/bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/);
  return match ? match[1] : "";
}
