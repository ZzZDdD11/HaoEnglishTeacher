"use client";

import { useEffect, useRef } from "react";

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

  const isYouTube =
    sourceUrl.includes("youtube.com") || sourceUrl.includes("youtu.be");
  const isBilibili = sourceUrl.includes("bilibili.com");

  // Drive the <audio> element: seek to start, play, pause at end
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioSrc) return;

    const startSec = startMs ? startMs / 1000 : 0;
    const endSec = endMs ? endMs / 1000 : undefined;

    const onLoadedMetadata = () => {
      audio.currentTime = startSec;
      audio.play().catch(() => {
        /* autoplay may be blocked; user gesture will retry via replay */
      });
    };

    const onTimeUpdate = () => {
      if (endSec !== undefined && audio.currentTime >= endSec) {
        audio.pause();
        onAudioEnded?.();
      }
    };

    const onEnded = () => {
      onAudioEnded?.();
    };

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, [audioSrc, startMs, endMs, onAudioEnded]);

  // Build iframe embed URL (muted video track)
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
    // B站 embed has no mute param; video audio may overlap. See design 3.4.
    iframeSrc = `https://player.bilibili.com/player.html?bvid=${bvid}&autoplay=1`;
  }

  return (
    <div className="space-y-2">
      {iframeSrc && (
        <div className="aspect-video rounded-xl overflow-hidden bg-black">
          <iframe
            src={iframeSrc}
            className="w-full h-full"
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
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
