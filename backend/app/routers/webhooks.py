"""Webhook GLPI + sync pelo banco MySQL do GLPI."""

from __future__ import annotations

import hmac
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.config import Settings, get_settings
from app.database import get_db
from app.models.offboarding import OffboardingRequest
from app.models.onboarding import OnboardingRequest
from app.models.user import User
from app.schemas import GlpiDbSyncOut, GlpiWebhookIn, GlpiWebhookOut
from app.services.audit import write_audit_log
from app.services.glpi_db import ping_glpi_db, sync_glpi_numbers_from_db
from app.services.glpi_notify import extract_glpi_ticket_number, extract_portal_ticket_id
from app.services.sanitizer import sanitize_text

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


def _check_secret(
    secret_header: str | None,
    settings: Settings,
) -> None:
    expected = (settings.glpi_webhook_secret or "").strip()
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GLPI_WEBHOOK_SECRET não configurado no backend.",
        )
    provided = (secret_header or "").strip()
    if not provided or not hmac.compare_digest(provided, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Webhook secret inválido.")


@router.post("/glpi-ticket", response_model=GlpiWebhookOut)
async def glpi_ticket_webhook(
    payload: GlpiWebhookIn,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    x_glpi_webhook_secret: str | None = Header(default=None, alias="X-Glpi-Webhook-Secret"),
) -> GlpiWebhookOut:
    _check_secret(x_glpi_webhook_secret, settings)

    portal_id = (payload.portalTicketId or "").strip().upper() or extract_portal_ticket_id(
        payload.subject, payload.body
    )
    glpi_num = (payload.glpiTicketNumber or "").strip() or extract_glpi_ticket_number(
        payload.subject, payload.body, payload.glpiTicketNumber
    )

    if not portal_id:
        raise HTTPException(
            status_code=422,
            detail="portalTicketId ausente e não encontrado em subject/body ([PORTAL:ONB-…]).",
        )
    if not glpi_num:
        raise HTTPException(
            status_code=422,
            detail="glpiTicketNumber ausente e não encontrado no texto (ex.: Ticket #12345).",
        )

    glpi_num = sanitize_text(glpi_num, max_len=64) or glpi_num

    row: OnboardingRequest | OffboardingRequest | None = None
    if portal_id.startswith("ONB"):
        result = await db.execute(select(OnboardingRequest).where(OnboardingRequest.id == portal_id))
        row = result.scalar_one_or_none()
    elif portal_id.startswith("OFF"):
        result = await db.execute(select(OffboardingRequest).where(OffboardingRequest.id == portal_id))
        row = result.scalar_one_or_none()
    else:
        raise HTTPException(status_code=422, detail=f"ID de portal inválido: {portal_id}")

    if not row:
        raise HTTPException(status_code=404, detail=f"Chamado {portal_id} não encontrado.")

    row.glpi_ticket_number = glpi_num
    await db.flush()
    await write_audit_log(
        db,
        action="GLPI_TICKET_LINKED",
        performed_by_user_id=None,
        target_request_id=portal_id,
        details={
            "glpi_ticket_number": glpi_num,
            "from": payload.from_email,
            "subject": (payload.subject or "")[:200],
        },
    )

    return GlpiWebhookOut(
        ok=True,
        portalTicketId=portal_id,
        glpiTicketNumber=glpi_num,
        message=f"Chamado GLPI {glpi_num} vinculado a {portal_id}.",
    )


@router.get("/glpi-db/status")
async def glpi_db_status(
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    if current_user.role not in {"admin", "ti"}:
        raise HTTPException(status_code=403, detail="Sem permissão.")
    return await ping_glpi_db()


@router.post("/glpi-db/sync", response_model=GlpiDbSyncOut)
async def glpi_db_sync(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GlpiDbSyncOut:
    """Lê o MySQL do GLPI e preenche nº nos chamados do portal ainda sem vínculo."""
    if current_user.role not in {"admin", "ti"}:
        raise HTTPException(status_code=403, detail="Sem permissão.")
    result = await sync_glpi_numbers_from_db(db, performed_by_user_id=current_user.id)
    db_status = await ping_glpi_db()
    return GlpiDbSyncOut(
        ok=bool(result.get("ok")),
        linked=int(result.get("linked") or 0),
        checked=int(result.get("checked") or 0),
        items=list(result.get("items") or []),
        error=result.get("error"),
        dbStatus=db_status,
    )
