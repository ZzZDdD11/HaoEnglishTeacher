import os
import uuid
import threading
from dataclasses import dataclass

from fastapi import APIRouter

from app.schemas.material import MaterialCreateRequest, ProcessStatusResponse
from app.services.video import download_video
from app.services.transcription import transcribe_audio, TranscriptSegment
from app.models.material import Material
from app.db.database import async_session

router = APIRouter(prefix="/process", tags=["process"])

# Simple in-memory task store for MVP
_task_store: dict[str, dict] = {}


@dataclass
class ProcessingResult:
    segments: list[TranscriptSegment]
    error: str | None = None


def _download_and_transcribe(task_id: str, source_url: str):
    """Run download + transcription in a background thread (no DB access)."""
    try:
        _task_store[task_id] = {"status": "processing", "material_id": None}

        audio_path = download_video(source_url)
        segments = transcribe_audio(audio_path)

        _task_store[task_id] = {
            "status": "ready_to_save",
            "material_id": None,
            "segments": segments,
            "source_url": source_url,
            "audio_path": audio_path,
        }

    except Exception as e:
        _task_store[task_id] = {"status": "error", "material_id": None, "error": str(e)}


@router.post("/video")
async def create_video_process(request: MaterialCreateRequest):
    task_id = str(uuid.uuid4())
    _task_store[task_id] = {"status": "queued", "material_id": None}

    thread = threading.Thread(target=_download_and_transcribe, args=(task_id, request.source_url))
    thread.start()

    return {"task_id": task_id, "status": "queued"}


@router.get("/status/{task_id}")
async def get_process_status(task_id: str):
    info = _task_store.get(task_id, {"status": "queued", "material_id": None, "error": None})

    # If processing is done, save to DB in the main event loop
    if info.get("status") == "ready_to_save" and not info.get("material_id"):
        material_id = str(uuid.uuid4())
        segments = info["segments"]
        source_url = info["source_url"]
        audio_filename = os.path.basename(info.get("audio_path", ""))

        async with async_session() as db:
            material = Material(
                id=material_id,
                source_type="youtube" if ("youtube.com" in source_url or "youtu.be" in source_url) else "bilibili",
                source_url=source_url,
                title="",
                duration_seconds=sum(s.end_ms - s.start_ms for s in segments) / 1000.0,
                transcript_json={
                    "segments": [
                        {
                            "sentence_index": s.sentence_index,
                            "text": s.text,
                            "start_ms": s.start_ms,
                            "end_ms": s.end_ms,
                            "words": [
                                {"word": w.word, "start_ms": w.start_ms, "end_ms": w.end_ms}
                                for w in s.words
                            ]
                        }
                        for s in segments
                    ]
                },
                audio_filename=audio_filename,
                status="ready",
            )
            db.add(material)
            await db.commit()

        _task_store[task_id] = {"status": "ready", "material_id": material_id}
        info = _task_store[task_id]

    return ProcessStatusResponse(
        task_id=task_id,
        status=info.get("status", "queued"),
        material_id=info.get("material_id"),
        error=info.get("error"),
    )
