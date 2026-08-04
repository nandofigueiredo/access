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

CATALOG_LIST_KEYS = (
    "departments",
    "positions",
    "workModes",
    "hardwareProfiles",
    "peripherals",
    "basePlatforms",
    "specificSystems",
    "units",
    "managers",
    "ticketStatuses",
    "returnMethods",
    "assetTypes",
    "onboardingChecklist",
    "offboardingChecklist",
    "users",
    "serviceQueues",
    "emailTemplates",
    "termTemplates",
    "allowedDomains",
    "formFields",
)


def _merge_items_by_id(
    server_items: list[Any],
    incoming_items: list[Any],
    delete_ids: set[str] | None = None,
) -> list[dict[str, Any]]:
    """Une itens de catálogo por id. Incoming vence; delete_ids remove."""
    merged: dict[str, dict[str, Any]] = {}
    for raw in server_items:
        if not isinstance(raw, dict):
            continue
        sid = str(raw.get("id") or "").strip()
        if not sid or (delete_ids and sid in delete_ids):
            continue
        merged[sid] = copy.deepcopy(raw)
    for raw in incoming_items:
        if not isinstance(raw, dict):
            continue
        sid = str(raw.get("id") or "").strip()
        if not sid:
            continue
        if delete_ids and sid in delete_ids:
            merged.pop(sid, None)
            continue
        incoming = copy.deepcopy(raw)
        existing = merged.get(sid)
        merged[sid] = {**existing, **incoming} if existing else incoming
    if delete_ids:
        for did in delete_ids:
            merged.pop(did, None)
    return list(merged.values())


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

    # Catálogo: une TODAS as listas por id (não só users) — evita race apagar gestores/unidades
    if key == "catalog":
        server_val = copy.deepcopy(row.value) if row and isinstance(row.value, dict) else {}
        raw_user_deletes = value.pop("userDeleteIds", None)
        user_delete_ids = {str(x) for x in raw_user_deletes} if isinstance(raw_user_deletes, list) else set()
        raw_item_deletes = value.pop("itemDeleteIds", None)
        item_deletes: dict[str, set[str]] = {}
        if isinstance(raw_item_deletes, dict):
            for list_key, ids in raw_item_deletes.items():
                if isinstance(ids, list):
                    item_deletes[str(list_key)] = {str(x) for x in ids}

        for list_key in CATALOG_LIST_KEYS:
            server_list = server_val.get(list_key) if isinstance(server_val.get(list_key), list) else []
            incoming_list = value.get(list_key) if isinstance(value.get(list_key), list) else []
            if list_key == "users":
                value["users"] = _merge_catalog_users(server_list, incoming_list, user_delete_ids)
            else:
                deletes = item_deletes.get(list_key, set())
                value[list_key] = _merge_items_by_id(server_list, incoming_list, deletes)

        # sla: incoming se presente, senão servidor
        if not isinstance(value.get("sla"), dict) and isinstance(server_val.get("sla"), dict):
            value["sla"] = copy.deepcopy(server_val["sla"])

        # Campos escalares do servidor que o cliente omitiu
        for meta_key in ("updatedAt",):
            if meta_key not in value and meta_key in server_val:
                value[meta_key] = server_val[meta_key]

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
