from fastapi import APIRouter
from celery.result import AsyncResult

from app.schemas.material import MaterialCreateRequest, ProcessStatusResponse
from app.tasks.process_video import process_video_task
from app.tasks.celery_app import celery_app

router = APIRouter(prefix="/process", tags=["process"])


@router.post("/video")
async def create_video_process(request: MaterialCreateRequest):
    task = process_video_task.delay(request.source_url)
    return {"task_id": task.id, "status": "queued"}


@router.get("/status/{task_id}")
async def get_process_status(task_id: str):
    result = AsyncResult(task_id, app=celery_app)

    response = ProcessStatusResponse(
        task_id=task_id,
        status="queued",
    )

    if result.state == "PENDING":
        response.status = "queued"
    elif result.state == "PROGRESS":
        response.status = "processing"
    elif result.state == "SUCCESS":
        data = result.result
        response.status = data.get("status", "ready")
        response.material_id = data.get("material_id")
    elif result.state == "FAILURE":
        response.status = "error"
        response.error = str(result.info)

    return response
