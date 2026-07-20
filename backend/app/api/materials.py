import os

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.database import get_db
from app.models.material import Material
from app.schemas.material import MaterialResponse, MaterialDetailResponse

router = APIRouter(prefix="/materials", tags=["materials"])


@router.get("")
async def list_materials(db: AsyncSession = Depends(get_db)) -> list[MaterialResponse]:
    result = await db.execute(
        select(Material).order_by(Material.created_at.desc()).limit(20)
    )
    materials = result.scalars().all()
    return [MaterialResponse.model_validate(m) for m in materials]


@router.get("/{material_id}")
async def get_material(
    material_id: str,
    db: AsyncSession = Depends(get_db),
) -> MaterialDetailResponse:
    result = await db.execute(select(Material).where(Material.id == material_id))
    material = result.scalar_one_or_none()
    if material is None:
        raise HTTPException(status_code=404, detail="Material not found")

    resp = MaterialDetailResponse.model_validate(material)
    resp.transcript = material.transcript_json.get("segments", []) if material.transcript_json else None
    return resp


@router.get("/{material_id}/audio")
async def get_material_audio(
    material_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Serve the reference audio WAV file for a material."""
    result = await db.execute(select(Material).where(Material.id == material_id))
    material = result.scalar_one_or_none()
    if material is None:
        raise HTTPException(status_code=404, detail="Material not found")

    if not material.audio_filename:
        raise HTTPException(status_code=404, detail="Audio not available")

    audio_path = os.path.join(settings.upload_dir, material.audio_filename)
    if not os.path.exists(audio_path):
        raise HTTPException(status_code=404, detail="Audio file not found")

    return FileResponse(audio_path, media_type="audio/wav")
