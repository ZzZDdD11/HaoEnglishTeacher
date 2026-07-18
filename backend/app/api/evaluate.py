import os
import uuid

from fastapi import APIRouter, UploadFile, File, Form

from app.config import settings
from app.services.evaluation import evaluate_pronunciation
from app.schemas.evaluation import EvaluationResult

router = APIRouter(prefix="/evaluate", tags=["evaluate"])


@router.post("/pronunciation")
async def evaluate_pronunciation_endpoint(
    audio: UploadFile = File(...),
    reference_text: str = Form(...),
    reference_audio_url: str = Form(""),
) -> EvaluationResult:
    """Evaluate user pronunciation against reference text."""
    os.makedirs(settings.upload_dir, exist_ok=True)

    # Save user audio
    user_audio_id = str(uuid.uuid4())
    user_audio_path = os.path.join(settings.upload_dir, f"user_{user_audio_id}.wav")

    content = await audio.read()
    with open(user_audio_path, "wb") as f:
        f.write(content)

    # If reference audio is provided, use it; otherwise use user audio path for both
    # (Azure assessment only needs user audio + reference text)
    ref_audio_path = reference_audio_url or user_audio_path

    result = await evaluate_pronunciation(
        reference_audio_path=ref_audio_path,
        user_audio_path=user_audio_path,
        reference_text=reference_text,
    )

    return result
