import pytest

from app.services.evaluation import evaluate_pronunciation
from app.config import settings
from app.schemas.evaluation import EvaluationResult


@pytest.mark.asyncio
async def test_evaluate_requires_reference_text():
    with pytest.raises(ValueError, match="reference_text"):
        await evaluate_pronunciation("/fake/user.wav", "")


@pytest.mark.asyncio
async def test_evaluate_empty_reference_text():
    with pytest.raises(ValueError, match="reference_text"):
        await evaluate_pronunciation("/fake/user.wav", "   ")


@pytest.mark.asyncio
async def test_evaluate_no_key_falls_back_to_whisper(monkeypatch):
    """Without AZURE_SPEECH_KEY, evaluation falls back to Whisper similarity."""
    if settings.azure_speech_key:
        pytest.skip("Azure key configured — Azure path tested separately")

    from app.services import whisper_similarity

    fake_result = EvaluationResult(
        overall_score=100.0,
        pronunciation_score=100.0,
        rhythm_score=100.0,
        intonation_score=100.0,
        word_scores=[],
        suggestions=[],
    )
    monkeypatch.setattr(
        whisper_similarity,
        "evaluate_by_similarity",
        lambda path, text: fake_result,
    )

    result = await evaluate_pronunciation("/fake/user.wav", "hello world")

    assert isinstance(result, EvaluationResult)
    assert result.overall_score == 100.0
