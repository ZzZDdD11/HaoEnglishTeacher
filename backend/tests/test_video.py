import os

import pytest

from app.services.video import download_video, VideoInfo


@pytest.mark.asyncio
async def test_download_video_youtube():
    """Integration test — requires network and yt-dlp."""
    url = "https://www.youtube.com/watch?v=jNQXAC9IVRw"  # "Me at the zoo" — short, always available
    audio_path = await download_video(url)

    assert os.path.exists(audio_path)
    assert audio_path.endswith(".wav")

    # Cleanup
    os.remove(audio_path)


@pytest.mark.asyncio
async def test_download_video_invalid_url():
    url = "https://example.com/not-a-video"
    with pytest.raises(ValueError, match="Cannot extract video"):
        await download_video(url)
