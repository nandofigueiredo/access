from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models.settings import AppSetting
from app.models.user import User
from app.schemas import SettingsOut, SettingsUpdate
from app.services.audit import write_audit_log

router = APIRouter(prefix="/settings", tags=["Settings"])

ALLOWED_KEYS = {"catalog", "smtp"}


@router.get("/{key}", response_model=SettingsOut)
async def get_setting(
    key: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SettingsOut:
    _ = current_user
    if key not in ALLOWED_KEYS:
        raise HTTPException(status_code=404, detail="Chave de configuração inválida.")

    result = await db.execute(select(AppSetting).where(AppSetting.key == key))
    row = result.scalar_one_or_none()
    if not row:
        return SettingsOut(key=key, value={}, updatedAt=None)
    return SettingsOut(key=row.key, value=row.value or {}, updatedAt=row.updated_at)


@router.put("/{key}", response_model=SettingsOut)
async def put_setting(
    key: str,
    payload: SettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SettingsOut:
    if key not in ALLOWED_KEYS:
        raise HTTPException(status_code=404, detail="Chave de configuração inválida.")
    if current_user.role not in {"admin", "ti"}:
        raise HTTPException(status_code=403, detail="Sem permissão para alterar configurações.")

    result = await db.execute(select(AppSetting).where(AppSetting.key == key))
    row = result.scalar_one_or_none()
    if row:
        row.value = payload.value
        row.updated_by = current_user.id
    else:
        row = AppSetting(key=key, value=payload.value, updated_by=current_user.id)
        db.add(row)

    await db.flush()
    await write_audit_log(
        db,
        action="SETTINGS_UPDATED",
        performed_by_user_id=current_user.id,
        details={"key": key},
    )
    return SettingsOut(key=row.key, value=row.value or {}, updatedAt=row.updated_at)
