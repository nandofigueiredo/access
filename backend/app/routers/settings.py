from __future__ import annotations

import copy
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.auth import get_current_user
from app.database import get_db
from app.models.settings import AppSetting
from app.models.user import User
from app.schemas import SettingsOut, SettingsUpdate, SmtpTestOut
from app.services.audit import write_audit_log
from app.services.email_smtp import send_smtp_email

router = APIRouter(prefix="/settings", tags=["Settings"])

ALLOWED_KEYS = {"catalog", "smtp"}
_BR_TZ = ZoneInfo("America/Sao_Paulo")


@router.post("/smtp/test", response_model=SmtpTestOut)
async def test_smtp(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SmtpTestOut:
    """Envia e-mail de teste usando a config SMTP gravada em app_settings."""
    if current_user.role not in {"admin", "ti"}:
        raise HTTPException(status_code=403, detail="Sem permissão para testar SMTP.")

    result = await db.execute(select(AppSetting).where(AppSetting.key == "smtp"))
    row = result.scalar_one_or_none()
    cfg = row.value if row and isinstance(row.value, dict) else {}
    to_addr = str(cfg.get("serviceDeskInbox") or cfg.get("fromEmail") or current_user.email or "").strip()
    if not to_addr or "@" not in to_addr:
        raise HTTPException(status_code=422, detail="Defina Service Desk ou e-mail remetente antes do teste.")

    agora = datetime.now(_BR_TZ).strftime("%d/%m/%Y %H:%M:%S")
    send_result = await send_smtp_email(
        db,
        to=[to_addr],
        subject="[Teste] Portal TI — SMTP Workflow",
        body=(
            f"Teste de envio SMTP do Portal TI.\n"
            f"Usuário: {current_user.email}\n"
            f"Horário: {agora}\n"
            f"Modo teste na config: {bool(cfg.get('testMode', True))}\n"
            f"SMTP enabled: {bool(cfg.get('enabled'))}\n"
        ),
    )
    status = str(send_result.get("status") or "failed")
    ok = bool(send_result.get("ok"))
    detail = (
        f"Simulado para {to_addr} (desmarque Modo teste + habilite SMTP para envio real)."
        if status == "sent_simulated"
        else f"Enviado para {to_addr}."
        if ok
        else str(send_result.get("error") or "Falha no envio SMTP.")
    )
    return SmtpTestOut(
        ok=ok,
        status=status,
        to=list(send_result.get("to") or [to_addr]),
        subject=str(send_result.get("subject") or ""),
        error=None if ok else str(send_result.get("error") or detail),
        detail=detail,
    )


def _user_key(user: dict[str, Any]) -> str:
    meta = user.get("meta") if isinstance(user.get("meta"), dict) else {}
    mail = str(meta.get("email") or "").strip().lower()
    if "@" in mail:
        return f"mail:{mail}"
    name = str(user.get("name") or "").strip().lower()
    if "@" in name:
        return f"mail:{name}"
    return f"id:{user.get('id')}"


def _richer_user(existing: dict[str, Any], incoming: dict[str, Any]) -> dict[str, Any]:
    """Incoming vence em role/e-mail/status; completa o que faltar com o existente."""
    a_meta = existing.get("meta") if isinstance(existing.get("meta"), dict) else {}
    b_meta = incoming.get("meta") if isinstance(incoming.get("meta"), dict) else {}

    def _mail(meta: dict[str, Any], row: dict[str, Any]) -> str:
        m = str(meta.get("email") or "").strip().lower()
        if "@" in m:
            return m
        n = str(row.get("name") or "").strip().lower()
        return n if "@" in n else ""

    email = _mail(b_meta, incoming) or _mail(a_meta, existing)
    role = str(b_meta.get("role") or a_meta.get("role") or "").strip() or None

    name_in = str(incoming.get("name") or "")
    name_ex = str(existing.get("name") or "")
    if "@" in name_in and name_ex and "@" not in name_ex:
        name = name_ex
    elif name_in:
        name = name_in
    else:
        name = name_ex

    meta = {**a_meta, **b_meta}
    if email:
        meta["email"] = email
    if role:
        meta["role"] = role

    out = {
        **existing,
        **incoming,
        "id": incoming.get("id") or existing.get("id"),
        "name": name,
        "meta": meta,
        "description": incoming.get("description") or existing.get("description"),
        "active": bool(incoming.get("active", existing.get("active", True))),
        "sortOrder": incoming.get("sortOrder", existing.get("sortOrder", 0)),
    }
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
        # Cópia rasa para não mutar JSONB ligado à sessão async
        merged[_user_key(raw)] = copy.deepcopy(raw)
    for raw in incoming_users:
        if not isinstance(raw, dict):
            continue
        key = _user_key(raw)
        incoming = copy.deepcopy(raw)
        existing = merged.get(key)
        merged[key] = _richer_user(existing, incoming) if existing else incoming

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
    # Cópia: evita greenlet ao serializar JSONB da sessão
    return SettingsOut(key=row.key, value=copy.deepcopy(row.value or {}), updatedAt=row.updated_at)


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

    value: dict[str, Any] = copy.deepcopy(payload.value) if isinstance(payload.value, dict) else {}

    # Catálogo: une usuários com o banco (não apaga por race/stale client)
    if key == "catalog":
        server_val = copy.deepcopy(row.value) if row and isinstance(row.value, dict) else {}
        server_users = server_val.get("users") if isinstance(server_val.get("users"), list) else []
        incoming_users = value.get("users") if isinstance(value.get("users"), list) else []
        raw_deletes = value.pop("userDeleteIds", None)
        delete_ids = {str(x) for x in raw_deletes} if isinstance(raw_deletes, list) else set()
        value["users"] = _merge_catalog_users(server_users, incoming_users, delete_ids)

        remote_ts = str(server_val.get("updatedAt") or "")
        incoming_ts = str(value.get("updatedAt") or "")
        if remote_ts and incoming_ts and incoming_ts < remote_ts and not delete_ids:
            # Cliente antigo: preserva campos do servidor e users já mergeados
            merged_users = value["users"]
            value = {**server_val, **value, "users": merged_users, "updatedAt": remote_ts}

    if row:
        row.value = value
        row.updated_by = current_user.id
        flag_modified(row, "value")
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
    await db.refresh(row)
    return SettingsOut(key=row.key, value=copy.deepcopy(row.value or {}), updatedAt=row.updated_at)
