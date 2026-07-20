from app.services import whisper_similarity
from app.services.whisper_similarity import evaluate_by_similarity, _normalize


def test_normalize_strips_punctuation_and_lowercases():
    assert _normalize("Hello, World!") == ["hello", "world"]


def test_evaluate_perfect_match(monkeypatch):
    class FakeModel:
        def transcribe(self, path, **kwargs):
            return {"text": "hello world"}

    monkeypatch.setattr(whisper_similarity.transcription, "_get_model", lambda: FakeModel())

    result = evaluate_by_similarity("/fake.wav", "hello world")

    assert result.overall_score == 100.0
    assert len(result.word_scores) == 2
    assert all(ws.score == 90.0 for ws in result.word_scores)
    assert result.suggestions == []


def test_evaluate_missing_word(monkeypatch):
    class FakeModel:
        def transcribe(self, path, **kwargs):
            return {"text": "hello"}

    monkeypatch.setattr(whisper_similarity.transcription, "_get_model", lambda: FakeModel())

    result = evaluate_by_similarity("/fake.wav", "hello world")

    assert result.overall_score == 50.0
    issues = {ws.word: ws.issue for ws in result.word_scores}
    assert issues["world"] == "说漏"


def test_evaluate_all_wrong(monkeypatch):
    class FakeModel:
        def transcribe(self, path, **kwargs):
            return {"text": "foo bar"}

    monkeypatch.setattr(whisper_similarity.transcription, "_get_model", lambda: FakeModel())

    result = evaluate_by_similarity("/fake.wav", "hello world")

    assert result.overall_score == 0.0


def test_evaluate_insertion_suggestion(monkeypatch):
    class FakeModel:
        def transcribe(self, path, **kwargs):
            return {"text": "hello extra world"}

    monkeypatch.setattr(whisper_similarity.transcription, "_get_model", lambda: FakeModel())

    result = evaluate_by_similarity("/fake.wav", "hello world")

    assert result.overall_score == 100.0
    assert any("多读" in s for s in result.suggestions)
