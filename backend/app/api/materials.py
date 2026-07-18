from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Material not found")

    resp = MaterialDetailResponse.model_validate(material)
    resp.transcript = material.transcript_json.get("segments", []) if material.transcript_json else None
    return resp
