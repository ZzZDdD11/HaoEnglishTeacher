import os
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.database import get_db
from app.models.attempt import SentenceAttempt
from app.schemas.attempt import AttemptCreateRequest, AttemptResponse
from app.services.evaluation import evaluate_pronunciation

router = APIRouter(prefix="/attempts", tags=["attempts"])


@router.post("")
async def create_attempt(
    request: AttemptCreateRequest,
    db: AsyncSession = Depends(get_db),
) -> AttemptResponse:
    attempt = SentenceAttempt(
        id=str(uuid.uuid4()),
        session_id=request.session_id,
        sentence_index=request.sentence_index,
        score=request.score,
        word_scores_json={"words": request.word_scores},
        suggestions_json=request.suggestions,
    )
    db.add(attempt)
    await db.commit()
    await db.refresh(attempt)

    resp = AttemptResponse.model_validate(attempt)
    resp.word_scores = request.word_scores
    resp.suggestions = request.suggestions
    return resp


@router.post("/evaluate")
async def evaluate_and_create_attempt(
    audio: UploadFile = File(...),
    reference_text: str = Form(""),
    session_id: str = Form(...),
    sentence_index: int = Form(...),
    db: AsyncSession = Depends(get_db),
) -> AttemptResponse:
    """Atomically evaluate pronunciation and persist the attempt.

    Single transaction: if evaluation fails, no attempt is written.
    """
    if not reference_text.strip():
        raise HTTPException(status_code=400, detail="reference_text is required")

    os.makedirs(settings.upload_dir, exist_ok=True)

    user_audio_id = str(uuid.uuid4())
    user_audio_path = os.path.join(settings.upload_dir, f"user_{user_audio_id}.wav")
    content = await audio.read()
    with open(user_audio_path, "wb") as f:
        f.write(content)

    try:
        result = await evaluate_pronunciation(user_audio_path, reference_text)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"evaluation failed: {exc}")

    attempt = SentenceAttempt(
        id=str(uuid.uuid4()),
        session_id=session_id,
        sentence_index=sentence_index,
        score=result.overall_score,
        word_scores_json={"words": [w.model_dump() for w in result.word_scores]},
        suggestions_json=result.suggestions,
        audio_recording_url=user_audio_path,
    )
    db.add(attempt)
    await db.commit()
    await db.refresh(attempt)

    resp = AttemptResponse.model_validate(attempt)
    resp.word_scores = [w.model_dump() for w in result.word_scores]
    resp.suggestions = result.suggestions
    return resp
