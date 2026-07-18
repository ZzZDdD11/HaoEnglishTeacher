import os
from dataclasses import dataclass

import whisper


@dataclass
class WordTimestamp:
    word: str
    start_ms: int
    end_ms: int


@dataclass
class TranscriptSegment:
    sentence_index: int
    text: str
    start_ms: int
    end_ms: int
    words: list[WordTimestamp]


# Load model once at module level
_model: whisper.Whisper | None = None


def _get_model() -> whisper.Whisper:
    global _model
    if _model is None:
        _model = whisper.load_model("small")
    return _model


async def transcribe_audio(audio_path: str) -> list[TranscriptSegment]:
    """Transcribe audio file to text with word-level timestamps.

    Uses Whisper small model. Returns sentence-level segments.
    """
    if not os.path.exists(audio_path):
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    model = _get_model()
    result = model.transcribe(audio_path, word_timestamps=True)

    # Whisper returns segments; we use those as sentences
    segments = []
    for i, seg in enumerate(result["segments"]):
        words = []
        if "words" in seg:
            for w in seg["words"]:
                words.append(WordTimestamp(
                    word=w["word"].strip(),
                    start_ms=int(w["start"] * 1000),
                    end_ms=int(w["end"] * 1000),
                ))

        segments.append(TranscriptSegment(
            sentence_index=i,
            text=seg["text"].strip(),
            start_ms=int(seg["start"] * 1000),
            end_ms=int(seg["end"] * 1000),
            words=words,
        ))

    return segments
