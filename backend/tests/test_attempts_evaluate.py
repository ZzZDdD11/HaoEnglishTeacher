import io
from datetime import datetime
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.db.database import get_db
from app.schemas.evaluation import EvaluationResult


class FakeSession:
    """In-memory AsyncSession substitute for testing."""

    def __init__(self):
        self.added = []
        self.committed = False

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        self.committed = True

    async def refresh(self, obj):
        obj.created_at = datetime.utcnow()

    async def close(self):
        pass


@pytest.mark.asyncio
async def test_evaluate_and_create_attempt_success(monkeypatch):
    fake_session = FakeSession()

    async def override_get_db():
        yield fake_session

    app.dependency_overrides[get_db] = override_get_db

    fake_result = EvaluationResult(
        overall_score=85.0,
        pronunciation_score=85.0,
        rhythm_score=85.0,
        intonation_score=85.0,
        word_scores=[],
        suggestions=["keep going"],
    )
    monkeypatch.setattr(
        "app.api.attempts.evaluate_pronunciation",
        AsyncMock(return_value=fake_result),
    )
    monkeypatch.setattr("app.api.attempts.os.makedirs", lambda *a, **k: None)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post(
            "/attempts/evaluate",
            files={"audio": ("recording.wav", io.BytesIO(b"fake-audio"), "audio/wav")},
            data={
                "reference_text": "hello world",
                "session_id": "sess-1",
                "sentence_index": "0",
            },
        )

    app.dependency_overrides.clear()

    assert resp.status_code == 200
    body = resp.json()
    assert body["score"] == 85.0
    assert body["session_id"] == "sess-1"
    assert body["sentence_index"] == 0
    assert body["suggestions"] == ["keep going"]
    assert fake_session.committed is True
    assert len(fake_session.added) == 1


@pytest.mark.asyncio
async def test_evaluate_and_create_attempt_missing_reference_text(monkeypatch):
    fake_session = FakeSession()

    async def override_get_db():
        yield fake_session

    app.dependency_overrides[get_db] = override_get_db
    monkeypatch.setattr("app.api.attempts.os.makedirs", lambda *a, **k: None)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post(
            "/attempts/evaluate",
            files={"audio": ("recording.wav", io.BytesIO(b"fake-audio"), "audio/wav")},
            data={
                "reference_text": "",
                "session_id": "sess-1",
                "sentence_index": "0",
            },
        )

    app.dependency_overrides.clear()

    # Empty reference_text is rejected at the endpoint with 400
    assert resp.status_code == 400
    assert fake_session.committed is False
    assert len(fake_session.added) == 0


@pytest.mark.asyncio
async def test_evaluate_and_create_attempt_evaluation_failure_rolls_back(monkeypatch):
    """When evaluation fails, no attempt is written (atomicity)."""
    fake_session = FakeSession()

    async def override_get_db():
        yield fake_session

    app.dependency_overrides[get_db] = override_get_db
    monkeypatch.setattr(
        "app.api.attempts.evaluate_pronunciation",
        AsyncMock(side_effect=RuntimeError("whisper blew up")),
    )
    monkeypatch.setattr("app.api.attempts.os.makedirs", lambda *a, **k: None)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post(
            "/attempts/evaluate",
            files={"audio": ("recording.wav", io.BytesIO(b"fake-audio"), "audio/wav")},
            data={
                "reference_text": "hello world",
                "session_id": "sess-1",
                "sentence_index": "0",
            },
        )

    app.dependency_overrides.clear()

    assert resp.status_code == 500
    assert fake_session.committed is False
    assert len(fake_session.added) == 0
