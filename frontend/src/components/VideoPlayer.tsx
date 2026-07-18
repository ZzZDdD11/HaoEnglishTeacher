"use client";

interface Props {
  sourceUrl: string;
  startMs?: number;
  endMs?: number;
  onEnded?: () => void;
}

export default function VideoPlayer({ sourceUrl, startMs, endMs, onEnded }: Props) {
  // YouTube embed
  const isYouTube = sourceUrl.includes("youtube.com") || sourceUrl.includes("youtu.be");

  if (isYouTube) {
    const videoId = extractYouTubeId(sourceUrl);
    const startSec = startMs ? Math.floor(startMs / 1000) : 0;
    const endSec = endMs ? Math.floor(endMs / 1000) : undefined;

    const embedUrl = `https://www.youtube.com/embed/${videoId}?start=${startSec}&autoplay=1&controls=1&rel=0${endSec ? `&end=${endSec}` : ""}`;

    return (
      <div className="aspect-video rounded-xl overflow-hidden bg-black">
        <iframe
          src={embedUrl}
          className="w-full h-full"
          allow="autoplay; encrypted-media"
          allowFullScreen
        />
      </div>
    );
  }

  // B站 embed
  if (sourceUrl.includes("bilibili.com")) {
    const bvid = extractBilibiliId(sourceUrl);
    return (
      <div className="aspect-video rounded-xl overflow-hidden bg-black">
        <iframe
          src={`https://player.bilibili.com/player.html?bvid=${bvid}&autoplay=1`}
          className="w-full h-full"
          allow="autoplay"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div className="aspect-video rounded-xl bg-gray-200 flex items-center justify-center text-gray-400">
      无法播放此视频
    </div>
  );
}

function extractYouTubeId(url: string): string {
  // Handle youtu.be/XXX and youtube.com/watch?v=XXX
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
