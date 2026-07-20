from app.schemas.attempt import AttemptResponse


def test_attempt_response_has_optional_sentence_text():
    resp = AttemptResponse(
        id="abc",
        session_id="sess",
        sentence_index=0,
        score=80.0,
        word_scores=[],
        suggestions=[],
        created_at="2026-07-20T00:00:00",
    )
    assert resp.sentence_text is None
