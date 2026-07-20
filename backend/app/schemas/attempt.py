from datetime import datetime

from pydantic import BaseModel


class AttemptCreateRequest(BaseModel):
    session_id: str
    sentence_index: int
    score: float
    word_scores: list[dict] = []
    suggestions: list[str] = []


class AttemptResponse(BaseModel):
    id: str
    session_id: str
    sentence_index: int
    score: float
    word_scores: list[dict] | None = None
    suggestions: list[str] | None = None
    sentence_text: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
