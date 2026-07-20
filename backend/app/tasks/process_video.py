import os

from app.tasks.celery_app import celery_app
from app.services.video import download_video
from app.services.transcription import transcribe_audio
from app.models.material import Material
from app.db.database import async_session
from dataclasses import asdict
import uuid


def _audio_filename_from_path(audio_path: str) -> str:
    """Extract the wav filename from the full path returned by download_video."""
    return os.path.basename(audio_path)


@celery_app.task(bind=True)
def process_video_task(self, source_url: str):
    """Download video, extract audio, transcribe, save to DB."""
    material_id = str(uuid.uuid4())

    self.update_state(state="processing", meta={"material_id": material_id})

    try:
        # Step 1: Download + extract audio
        audio_path = download_video(source_url)

        # Step 2: Transcribe
        segments = transcribe_audio(audio_path)

        # Step 3: Save to DB
        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        async def save():
            async with async_session() as db:
                material = Material(
                    id=material_id,
                    source_type="youtube" if "youtube.com" in source_url or "youtu.be" in source_url else "bilibili",
                    source_url=source_url,
                    title="",  # Will be filled from video info
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
                    audio_filename=_audio_filename_from_path(audio_path),
                    status="ready",
                )
                db.add(material)
                await db.commit()

                return material_id

        loop.run_until_complete(save())

        return {"material_id": material_id, "status": "ready"}

    except Exception as e:
        self.update_state(state="error", meta={"error": str(e)})
        return {"material_id": material_id, "status": "error", "error": str(e)}
