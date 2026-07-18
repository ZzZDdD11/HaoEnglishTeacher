import os

import azure.cognitiveservices.speech as speechsdk

from app.config import settings
from app.schemas.evaluation import EvaluationResult, WordScoreItem
from app.services.suggestion import generate_suggestions


async def evaluate_pronunciation(
    reference_audio_path: str,
    user_audio_path: str,
    reference_text: str,
) -> EvaluationResult:
    """Compare user pronunciation to reference using Azure Speech API.

    Requires AZURE_SPEECH_KEY and AZURE_SPEECH_REGION env vars.
    """
    if not settings.azure_speech_key:
        raise ValueError("Azure Speech key not configured")

    speech_config = speechsdk.SpeechConfig(
        subscription=settings.azure_speech_key,
        region=settings.azure_speech_region,
    )

    # Build pronunciation assessment config
    pronunciation_config = speechsdk.PronunciationAssessmentConfig(
        reference_text=reference_text,
        grading_system=speechsdk.PronunciationAssessmentGradingSystem.HundredMark,
        granularity=speechsdk.PronunciationAssessmentGranularity.Word,
    )
    pronunciation_config.enable_prosody_assessment()

    # Recognize user audio
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

    # Overall scores
    pron_info = data.get("NBest", [{}])[0]
    pron_score = pron_info.get("PronunciationAssessment", {}).get("PronScore", 0.0)

    # Word-level scores
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

    # Prosody scores
    prosody = data.get("NBest", [{}])[0].get("PronunciationAssessment", {}).get("ProsodyScore", 0.0)

    # Generate suggestions from word scores
    suggestions = generate_suggestions(word_scores)

    return EvaluationResult(
        overall_score=pron_score,
        pronunciation_score=pron_score,
        rhythm_score=prosody,  # Azure doesn't split rhythm/intonation in basic mode
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
