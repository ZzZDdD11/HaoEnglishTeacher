"""Whisper + text similarity pronunciation evaluator (zero-config fallback).

Used when AZURE_SPEECH_KEY is not configured. Compares a Whisper transcription
of the user's audio against the reference text via word-level alignment, and
scores how completely/accurately the user spoke the reference.
"""

import re
from difflib import SequenceMatcher

from app.schemas.evaluation import EvaluationResult, WordScoreItem
from app.services import transcription


def _normalize(text: str) -> list[str]:
    """Lowercase, strip punctuation, split into words."""
    cleaned = re.sub(r"[^\w\s]", "", text.lower())
    return cleaned.split()


def evaluate_by_similarity(
    user_audio_path: str,
    reference_text: str,
) -> EvaluationResult:
    """Evaluate pronunciation by aligning Whisper transcription to reference text.

    Scoring:
      - matched word  -> 90
      - substituted   -> 40 (issue "说错")
      - omitted       -> 40 (issue "说漏")
      - extra spoken  -> not scored, suggestion "多读"
      - overall = matched / total_reference_words * 100
    """
    model = transcription._get_model()
    result = model.transcribe(user_audio_path, word_timestamps=False)
    recognized_text = result.get("text", "").strip()

    ref_words = _normalize(reference_text)
    rec_words = _normalize(recognized_text)

    word_scores: list[WordScoreItem] = []
    matched = 0
    suggestions: list[str] = []

    for tag, i1, i2, j1, j2 in SequenceMatcher(
        None, ref_words, rec_words
    ).get_opcodes():
        if tag == "equal":
            for w in ref_words[i1:i2]:
                word_scores.append(WordScoreItem(word=w, score=90.0, issue=None))
                matched += 1
        elif tag == "replace":
            for w in ref_words[i1:i2]:
                word_scores.append(WordScoreItem(word=w, score=40.0, issue="说错"))
                suggestions.append(f"「{w}」可能说错了")
        elif tag == "delete":
            for w in ref_words[i1:i2]:
                word_scores.append(WordScoreItem(word=w, score=40.0, issue="说漏"))
                suggestions.append(f"「{w}」可能漏读了")
        elif tag == "insert":
            for w in rec_words[j1:j2]:
                suggestions.append(f"「{w}」可能多读了")

    total_ref = len(ref_words)
    overall = round(matched / total_ref * 100) if total_ref > 0 else 0.0

    return EvaluationResult(
        overall_score=float(overall),
        pronunciation_score=float(overall),
        rhythm_score=float(overall),
        intonation_score=float(overall),
        word_scores=word_scores,
        suggestions=suggestions,
    )
