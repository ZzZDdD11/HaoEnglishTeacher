from pydantic import BaseModel


class SessionCreateRequest(BaseModel):
    material_id: str
    mode: str = "sentence_by_sentence"


class SessionResponse(BaseModel):
    id: str
    material_id: str
    mode: str
    status: str
    overall_score: float | None = None
    pronunciation_score: float | None = None
    rhythm_score: float | None = None
    intonation_score: float | None = None
    completed_at: str | None = None
    created_at: str

    model_config = {"from_attributes": True}


class SessionUpdateRequest(BaseModel):
    status: str | None = None
