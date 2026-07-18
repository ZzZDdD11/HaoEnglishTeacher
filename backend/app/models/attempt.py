import uuid
from datetime import datetime

from sqlalchemy import String, Integer, Float, DateTime
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SentenceAttempt(Base):
    __tablename__ = "sentence_attempts"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    sentence_index: Mapped[int] = mapped_column(Integer, nullable=False)
    audio_recording_url: Mapped[str] = mapped_column(String(2048), default="")
    reference_audio_url: Mapped[str] = mapped_column(String(2048), default="")
    score: Mapped[float] = mapped_column(Float, default=0.0)
    word_scores_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    waveform_data_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    suggestions_json: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
