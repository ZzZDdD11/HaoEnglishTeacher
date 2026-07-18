import os
import subprocess
from dataclasses import dataclass

import yt_dlp

from app.config import settings


@dataclass
class VideoInfo:
    title: str
    duration_seconds: float


async def download_video(url: str) -> str:
    """Download video audio and convert to WAV 16kHz mono.

    Returns path to the output WAV file.
    """
    os.makedirs(settings.upload_dir, exist_ok=True)

    output_template = os.path.join(settings.upload_dir, "%(id)s.%(ext)s")

    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": output_template,
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "wav",
            }
        ],
        "quiet": True,
        "no_warnings": True,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            video_id = info["id"]
            title = info.get("title", "")
            duration = info.get("duration", 0.0)
    except Exception as e:
        raise ValueError(f"Cannot extract video: {e}")

    wav_path = os.path.join(settings.upload_dir, f"{video_id}.wav")

    # Convert to 16kHz mono if needed
    wav_path = _convert_to_mono_16k(wav_path)

    return wav_path


def _convert_to_mono_16k(input_path: str) -> str:
    """Convert audio to 16kHz mono WAV using ffmpeg."""
    output_path = input_path.replace(".wav", "_16k.wav")

    cmd = [
        "ffmpeg", "-y",
        "-i", input_path,
        "-ac", "1",
        "-ar", "16000",
        "-sample_fmt", "s16",
        output_path,
    ]
    subprocess.run(cmd, capture_output=True, check=True)

    # Replace original with converted
    os.replace(output_path, input_path)
    return input_path
