import azure.cognitiveservices.speech as speechsdk

from app.config import settings
from app.schemas.evaluation import EvaluationResult, WordScoreItem
from app.services.suggestion import generate_suggestions
from app.services import whisper_similarity


async def evaluate_pronunciation(
    user_audio_path: str,
    reference_text: str,
) -> EvaluationResult:
    """Evaluate user pronunciation.

    Uses Azure Speech Pronunciation Assessment when AZURE_SPEECH_KEY is
    configured; otherwise falls back to Whisper + text similarity (the
    zero-config default that requires no external signup).
    """
    if not reference_text.strip():
        raise ValueError("reference_text is required")

    if settings.azure_speech_key:
        return await _evaluate_azure(user_audio_path, reference_text)
    return whisper_similarity.evaluate_by_similarity(user_audio_path, reference_text)


async def _evaluate_azure(
    user_audio_path: str,
    reference_text: str,
) -> EvaluationResult:
    """Azure Speech Pronunciation Assessment (requires AZURE_SPEECH_KEY)."""
    if not settings.azure_speech_key:
        raise ValueError("Azure Speech key not configured")

    speech_config = speechsdk.SpeechConfig(
        subscription=settings.azure_speech_key,
        region=settings.azure_speech_region,
    )

    pronunciation_config = speechsdk.PronunciationAssessmentConfig(
        reference_text=reference_text,
        grading_system=speechsdk.PronunciationAssessmentGradingSystem.HundredMark,
        granularity=speechsdk.PronunciationAssessmentGranularity.Word,
    )
    pronunciation_config.enable_prosody_assessment()

    audio_config = speechsdk.AudioConfig(filename=user_audio_path)
    recognizer = speechsdk.SpeechRecognizer(
        speech_config=speech_config,
        audio_config=audio_config,
    )
    pronunciation_config.apply_to(recognizer)

    result = recognizer.recognize_once()

    if result.reason == speechsdk.ResultReason.RecognizedSpeech:
        return _parse_pronunciation_result(result)
    elif result.reason == speechsdk.ResultReason.NoMatch:
        raise ValueError("No speech could be recognized in the audio")
    else:
        raise ValueError(f"Speech recognition failed: {result.reason}")


def _parse_pronunciation_result(result) -> EvaluationResult:
    """Extract scores from Azure pronunciation assessment result."""
    json_result = result.properties.get(
        speechsdk.PropertyId.SpeechServiceResponse_JsonResult
    )

    import json
    data = json.loads(json_result)

    pron_info = data.get("NBest", [{}])[0]
    pron_score = pron_info.get("PronunciationAssessment", {}).get("PronScore", 0.0)

    words = pron_info.get("Words", [])
    word_scores = []
    for w in words:
        wscore = w.get("PronunciationAssessment", {}).get("AccuracyScore", 0.0)
        word_text = w.get("Word", "")
        issue = None
        if wscore < 70:
            error_type = w.get("PronunciationAssessment", {}).get("ErrorType", "")
            if error_type:
                issue = _describe_issue(word_text, error_type)
        word_scores.append(WordScoreItem(word=word_text, score=wscore, issue=issue))

    prosody = (
        data.get("NBest", [{}])[0]
        .get("PronunciationAssessment", {})
        .get("ProsodyScore", 0.0)
    )

    suggestions = generate_suggestions(word_scores)

    return EvaluationResult(
        overall_score=pron_score,
        pronunciation_score=pron_score,
        rhythm_score=prosody,
        intonation_score=prosody,
        word_scores=word_scores,
        suggestions=suggestions,
    )


def _describe_issue(word: str, error_type: str) -> str:
    """Map Azure error types to Chinese descriptions."""
    descriptions = {
        "Mispronunciation": f"「{word}」发音不准",
        "Omission": f"「{word}」遗漏了部分音节",
        "Insertion": f"「{word}」多加了一些音",
        "UnexpectedBreak": f"「{word}」中断不当",
        "MissingBreak": f"「{word}」缺少停顿",
        "Monotone": f"「{word}」语调太平",
    }
    return descriptions.get(error_type, f"「{word}」发音需改进")
