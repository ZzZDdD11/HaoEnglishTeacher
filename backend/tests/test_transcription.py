import pytest

from app.services.transcription import transcribe_audio, TranscriptSegment


@pytest.mark.asyncio
async def test_transcribe_audio(tmp_path):
    # Create a minimal valid WAV file (silence) for whisper to process
    import subprocess
    test_wav = tmp_path / "test.wav"
    subprocess.run([
        "ffmpeg", "-y", "-f", "lavfi",
        "-i", "anullsrc=r=16000:cl=mono",
        "-t", "1",
        "-ac", "1", "-ar", "16000",
        str(test_wav)
    ], capture_output=True, check=True)

    result = transcribe_audio(str(test_wav))
    assert isinstance(result, list)


@pytest.mark.asyncio
async def test_transcribe_audio_not_found():
    with pytest.raises(FileNotFoundError):
        transcribe_audio("/nonexistent/path.wav")
