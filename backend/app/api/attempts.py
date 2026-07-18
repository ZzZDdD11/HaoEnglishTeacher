import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.attempt import SentenceAttempt
from app.schemas.attempt import AttemptCreateRequest, AttemptResponse

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
