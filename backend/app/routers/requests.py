from __future__ import annotations

import copy

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.auth import get_current_user
from app.database import get_db
from app.models.offboarding import OffboardingRequest
from app.models.onboarding import OnboardingRequest
from app.models.user import User
from app.schemas import MessageOut, StatusUpdate, StatusUpdateOut
from app.services.audit import write_audit_log
from app.services.glpi_notify import notify_glpi_on_create
from app.services.sanitizer import sanitize_dict, sanitize_email, sanitize_text

router = APIRouter(prefix="/requests", tags=["Requests"])

ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "Pendente TI": {"Em Andamento", "Aguardando N3", "Concluído", "Pronta p/ Fechamento"},
    "Em Andamento": {"Pendente TI", "Aguardando N3", "Pronta p/ Fechamento", "Concluído"},
    "Aguardando N3": {"Em Andamento", "Pronta p/ Fechamento", "Concluído", "Pendente TI"},
    "Pronta p/ Fechamento": {"Em Andamento", "Concluído", "Aguardando N3"},
    "Concluído": {"Em Andamento", "Pendente TI"},
}


@router.patch("/{ticket_id}/status", response_model=StatusUpdateOut)
async def update_request_status(
    ticket_id: str,
    payload: StatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StatusUpdateOut:
    if current_user.role not in {"admin", "ti", "rh"}:
        raise HTTPException(status_code=403, detail="Sem permissão para alterar status.")

    request_type: str
    row: OnboardingRequest | OffboardingRequest | None = None

    if ticket_id.upper().startswith("ONB"):
        result = await db.execute(select(OnboardingRequest).where(OnboardingRequest.id == ticket_id))
        row = result.scalar_one_or_none()
        request_type = "onboarding"
    elif ticket_id.upper().startswith("OFF"):
        result = await db.execute(select(OffboardingRequest).where(OffboardingRequest.id == ticket_id))
        row = result.scalar_one_or_none()
        request_type = "offboarding"
    else:
        result = await db.execute(select(OnboardingRequest).where(OnboardingRequest.id == ticket_id))
        row = result.scalar_one_or_none()
        request_type = "onboarding"
        if not row:
            result = await db.execute(select(OffboardingRequest).where(OffboardingRequest.id == ticket_id))
            row = result.scalar_one_or_none()
            request_type = "offboarding"

    if not row:
        raise HTTPException(status_code=404, detail="Chamado não encontrado.")

    old_status = row.status
    if payload.status != old_status and payload.status not in ALLOWED_TRANSITIONS.get(old_status, set()):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Transição inválida: {old_status} → {payload.status}",
        )

    row.status = payload.status
    if payload.itNotes is not None:
        row.it_notes = sanitize_text(payload.itNotes, max_len=4000)
    if payload.itChecklist is not None:
        # deepcopy + flag_modified: evita greenlet_spawn em JSONB mutável
        row.it_checklist = copy.deepcopy(sanitize_dict(payload.itChecklist))
        flag_modified(row, "it_checklist")
    if payload.workflow is not None:
        row.workflow = copy.deepcopy(sanitize_dict(payload.workflow))
        flag_modified(row, "workflow")
    if payload.requesterEmail is not None:
        row.requester_email = sanitize_email(payload.requesterEmail) or payload.requesterEmail
    if payload.assignedQueue is not None:
        row.assigned_queue = sanitize_text(payload.assignedQueue, max_len=128)
    if payload.glpiTicketNumber is not None:
        row.glpi_ticket_number = sanitize_text(payload.glpiTicketNumber, max_len=64) or None

    await db.flush()
    await db.refresh(row)

    await write_audit_log(
        db,
        action="REQUEST_STATUS_UPDATED",
        performed_by_user_id=current_user.id,
        target_request_id=row.id,
        details={
            "from": old_status,
            "to": payload.status,
            "type": request_type,
            "it_notes_updated": payload.itNotes is not None,
            "it_checklist_updated": payload.itChecklist is not None,
            "workflow_updated": payload.workflow is not None,
            "glpi_updated": payload.glpiTicketNumber is not None,
        },
    )

    # Cópias: resposta fora da sessão async sem lazy-load JSONB
    return StatusUpdateOut(
        id=row.id,
        type=request_type,  # type: ignore[arg-type]
        status=row.status,  # type: ignore[arg-type]
        updatedAt=row.updated_at,
        itNotes=row.it_notes,
        itChecklist=copy.deepcopy(row.it_checklist) if row.it_checklist is not None else None,
        workflow=copy.deepcopy(row.workflow) if row.workflow else None,
        requesterEmail=row.requester_email,
        assignedQueue=row.assigned_queue,
        glpiTicketNumber=row.glpi_ticket_number,
    )


@router.post("/{ticket_id}/notify-glpi", response_model=MessageOut)
async def resend_glpi_notify(
    ticket_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessageOut:
    """Reenvia e-mail de abertura ao GLPI (útil se o collector não recebeu na criação)."""
    if current_user.role not in {"admin", "ti"}:
        raise HTTPException(status_code=403, detail="Sem permissão.")

    row: OnboardingRequest | OffboardingRequest | None = None
    kind = "onboarding"
    tid = ticket_id.strip().upper()
    if tid.startswith("ONB"):
        result = await db.execute(select(OnboardingRequest).where(OnboardingRequest.id == tid))
        row = result.scalar_one_or_none()
        kind = "onboarding"
    elif tid.startswith("OFF"):
        result = await db.execute(select(OffboardingRequest).where(OffboardingRequest.id == tid))
        row = result.scalar_one_or_none()
        kind = "offboarding"
    else:
        raise HTTPException(status_code=422, detail="ID inválido.")

    if not row:
        raise HTTPException(status_code=404, detail="Chamado não encontrado.")

    notify = await notify_glpi_on_create(db, row=row, kind=kind)
    await write_audit_log(
        db,
        action="GLPI_NOTIFY_RESEND",
        performed_by_user_id=current_user.id,
        target_request_id=row.id,
        details={"result": notify},
    )

    status_s = str(notify.get("status") or "failed")
    if notify.get("ok") and status_s == "sent":
        return MessageOut(detail=f"E-mail enviado ao GLPI ({', '.join(notify.get('to') or [])}).")
    if status_s == "skipped":
        return MessageOut(detail=f"Envio ignorado: {notify.get('reason') or 'glpi desabilitado'}.")
    if status_s == "disabled":
        raise HTTPException(status_code=422, detail="SMTP desabilitado. Habilite em Configuração → SMTP.")
    raise HTTPException(
        status_code=422,
        detail=str(notify.get("error") or f"Falha no envio SMTP ({status_s})."),
    )
