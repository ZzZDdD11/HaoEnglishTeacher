import uuid
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.session import PracticeSession
from app.schemas.session import SessionCreateRequest, SessionResponse, SessionUpdateRequest

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("")
async def create_session(
    request: SessionCreateRequest,
    db: AsyncSession = Depends(get_db),
) -> SessionResponse:
    session = PracticeSession(
        id=str(uuid.uuid4()),
        material_id=request.material_id,
        mode=request.mode,
        status="in_progress",
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return SessionResponse.model_validate(session)


@router.get("/{session_id}")
async def get_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
) -> SessionResponse:
    result = await db.execute(
        select(PracticeSession).where(PracticeSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Session not found")
    return SessionResponse.model_validate(session)


@router.patch("/{session_id}")
async def update_session(
    session_id: str,
    request: SessionUpdateRequest,
    db: AsyncSession = Depends(get_db),
) -> SessionResponse:
    result = await db.execute(
        select(PracticeSession).where(PracticeSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Session not found")

    if request.status == "completed":
        session.status = "completed"
        session.completed_at = datetime.utcnow()

        # Calculate overall scores from attempts
        from app.models.attempt import SentenceAttempt
        attempt_result = await db.execute(
            select(SentenceAttempt).where(SentenceAttempt.session_id == session_id)
        )
        attempts = attempt_result.scalars().all()
        if attempts:
            scores = [a.score for a in attempts]
            session.overall_score = sum(scores) / len(scores)
            session.pronunciation_score = session.overall_score
            session.rhythm_score = session.overall_score
            session.intonation_score = session.overall_score

    await db.commit()
    await db.refresh(session)
    return SessionResponse.model_validate(session)


@router.get("/{session_id}/report")
async def get_session_report(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    # Get session
    result = await db.execute(
        select(PracticeSession).where(PracticeSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Session not found")

    # Get attempts
    from app.models.attempt import SentenceAttempt
    from app.models.material import Material

    attempt_result = await db.execute(
        select(SentenceAttempt)
        .where(SentenceAttempt.session_id == session_id)
        .order_by(SentenceAttempt.sentence_index)
    )
    attempts = attempt_result.scalars().all()

    # Get material title
    mat_result = await db.execute(
        select(Material).where(Material.id == session.material_id)
    )
    material = mat_result.scalar_one_or_none()

    from app.schemas.attempt import AttemptResponse

    return {
        "session": SessionResponse.model_validate(session).model_dump(),
        "attempts": [
            AttemptResponse.model_validate(a).model_dump() for a in attempts
        ],
        "material_title": material.title if material else "",
    }
