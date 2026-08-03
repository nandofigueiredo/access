from __future__ import annotations

from typing import Any

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


def _user_key(user: dict[str, Any]) -> str:
    meta = user.get("meta") if isinstance(user.get("meta"), dict) else {}
    mail = str(meta.get("email") or "").strip().lower()
    if "@" in mail:
        return f"mail:{mail}"
    name = str(user.get("name") or "").strip().lower()
    if "@" in name:
        return f"mail:{name}"
    return f"id:{user.get('id')}"


def _richer_user(a: dict[str, Any], b: dict[str, Any]) -> dict[str, Any]:
    a_meta = a.get("meta") if isinstance(a.get("meta"), dict) else {}
    b_meta = b.get("meta") if isinstance(b.get("meta"), dict) else {}
    a_mail = str(a_meta.get("email") or "")
    b_mail = str(b_meta.get("email") or "")
    pick, other = (b, a) if ("@" in b_mail and "@" not in a_mail) else (a, b)
    pick_meta = pick.get("meta") if isinstance(pick.get("meta"), dict) else {}
    other_meta = other.get("meta") if isinstance(other.get("meta"), dict) else {}
    email = (
        str(pick_meta.get("email") or "")
        if "@" in str(pick_meta.get("email") or "")
        else str(other_meta.get("email") or "")
        if "@" in str(other_meta.get("email") or "")
        else str(pick.get("name") or "").lower()
        if "@" in str(pick.get("name") or "")
        else str(other.get("name") or "").lower()
        if "@" in str(other.get("name") or "")
        else ""
    )
    role = str(pick_meta.get("role") or other_meta.get("role") or "") or None
    name_pick = str(pick.get("name") or "")
    name_other = str(other.get("name") or "")
    name = (
        name_other
        if "@" in name_pick and name_other and "@" not in name_other
        else name_pick
        if "@" in name_other and name_pick and "@" not in name_pick
        else name_pick or name_other
    )
    merged_meta = {**other_meta, **pick_meta}
    if email and "@" in email:
        merged_meta["email"] = email.strip().lower()
    if role:
        merged_meta["role"] = role
    out = {**other, **pick, "name": name, "meta": merged_meta}
    out["active"] = bool(pick.get("active", True)) and bool(other.get("active", True))
    return out


def _merge_catalog_users(
    server_users: list[Any],
    incoming_users: list[Any],
    delete_ids: set[str] | None = None,
) -> list[dict[str, Any]]:
    """Une usuários por e-mail. Só remove se id estiver em delete_ids."""
    merged: dict[str, dict[str, Any]] = {}
    for raw in server_users:
        if not isinstance(raw, dict):
            continue
        merged[_user_key(raw)] = raw
    for raw in incoming_users:
        if not isinstance(raw, dict):
            continue
        key = _user_key(raw)
        existing = merged.get(key)
        merged[key] = _richer_user(existing, raw) if existing else raw

    if delete_ids:
        merged = {
            k: v
            for k, v in merged.items()
            if str(v.get("id") or "") not in delete_ids
        }
    return list(merged.values())


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
    # Catálogo (usuários/perfis) só Admin N3; SMTP pode ser ajustado por SD também
    if key == "catalog" and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Somente Admin N3 pode alterar o catálogo (usuários e perfis).")
    if key != "catalog" and current_user.role not in {"admin", "ti"}:
        raise HTTPException(status_code=403, detail="Sem permissão para alterar configurações.")

    result = await db.execute(select(AppSetting).where(AppSetting.key == key))
    row = result.scalar_one_or_none()

    value: dict[str, Any] = dict(payload.value) if isinstance(payload.value, dict) else {}

    # Catálogo: une usuários com o banco (não apaga por race/stale client)
    if key == "catalog":
        server_val = row.value if row and isinstance(row.value, dict) else {}
        server_users = server_val.get("users") if isinstance(server_val.get("users"), list) else []
        incoming_users = value.get("users") if isinstance(value.get("users"), list) else []
        raw_deletes = value.pop("userDeleteIds", None)
        delete_ids = {str(x) for x in raw_deletes} if isinstance(raw_deletes, list) else set()
        value["users"] = _merge_catalog_users(server_users, incoming_users, delete_ids)

        remote_ts = str(server_val.get("updatedAt") or "")
        incoming_ts = str(value.get("updatedAt") or "")
        if remote_ts and incoming_ts and incoming_ts < remote_ts and not delete_ids:
            # Cliente antigo: mantém restante do servidor, só enriquecer users (já mergeados)
            value = {**server_val, **value, "users": value["users"], "updatedAt": remote_ts}

    if row:
        row.value = value
        row.updated_by = current_user.id
    else:
        row = AppSetting(key=key, value=value, updated_by=current_user.id)
        db.add(row)

    await db.flush()
    await write_audit_log(
        db,
        action="SETTINGS_UPDATED",
        performed_by_user_id=current_user.id,
        details={"key": key},
    )
    return SettingsOut(key=row.key, value=row.value or {}, updatedAt=row.updated_at)
