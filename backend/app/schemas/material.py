from pydantic import BaseModel


class MaterialCreateRequest(BaseModel):
    source_url: str


class MaterialResponse(BaseModel):
    id: str
    source_type: str
    source_url: str
    title: str
    duration_seconds: float
    status: str
    created_at: str

    model_config = {"from_attributes": True}


class MaterialDetailResponse(MaterialResponse):
    transcript: list[dict] | None = None


class ProcessStatusResponse(BaseModel):
    task_id: str
    status: str  # "queued" | "processing" | "ready" | "error"
    material_id: str | None = None
    error: str | None = None
