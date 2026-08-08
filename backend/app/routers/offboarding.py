from __future__ import annotations

import copy
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import insert, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import get_current_user
from app.auth.access import (
    ROLES_CREATE_OFFBOARDING,
    ROLES_DELETE_TICKETS,
    assert_ticket_visible,
    require_roles,
    ticket_visible_to,
)
from app.database import get_db
from app.models.offboarding import OffboardingRequest
from app.models.user import User
from app.schemas import OffboardingCreate, OffboardingOut
from app.services.audit import write_audit_log
from app.services.sanitizer import sanitize_dict, sanitize_email, sanitize_text
from app.services.glpi_notify import notify_glpi_on_create
from app.utils.ids import next_ticket_id

router = APIRouter(prefix="/offboarding", tags=["Offboarding"])


def _to_out(row: OffboardingRequest, creator_email: str) -> OffboardingOut:
    """Monta DTO só com attrs já carregados (sem lazy / sem server_default unload)."""
    return OffboardingOut(
        id=row.id,
        status=row.status,  # type: ignore[arg-type]
        createdAt=row.created_at,
        updatedAt=row.updated_at,
        createdBy=creator_email,
        nomeCompleto=row.employee_name,
        emailCorporativo=row.corp_email,
        gestor=row.manager,
        dataHoraDesligamento=row.termination_datetime,
        redirecionamentoEmail=row.redirect_email,
        emailDestinoRedirecionamento=row.email_forward_to,
        transferenciaArquivos=row.transfer_files,
        emailDestinoArquivos=row.cloud_transfer_to,
        respostaAutomaticaAusencia=row.auto_reply,
        orientadoNaoManterArquivosPessoais=row.guided_no_personal_files,
        ativos=copy.deepcopy(row.hardware_assets) if row.hardware_assets else {},
        modalidadeDevolucao=row.return_method,
        prazoLimiteDevolucao=row.return_deadline,
        itChecklist=copy.deepcopy(row.it_checklist) if row.it_checklist else {},
        itNotes=row.it_notes,
        workflow=copy.deepcopy(row.workflow) if row.workflow else None,
        requesterEmail=row.requester_email,
        assignedQueue=row.assigned_queue,
        glpiTicketNumber=row.glpi_ticket_number,
    )


@router.post("", response_model=OffboardingOut, status_code=status.HTTP_201_CREATED)
async def create_offboarding(
    payload: OffboardingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OffboardingOut:
    require_roles(
        current_user,
        ROLES_CREATE_OFFBOARDING,
        detail="Sem permissão para criar offboarding.",
    )
    creator_id = current_user.id
    creator_email = str(current_user.email)

    corp_email = sanitize_email(str(payload.emailCorporativo))
    if not corp_email:
        raise HTTPException(status_code=422, detail="E-mail corporativo inválido.")

    if payload.redirecionamentoEmail and not payload.emailDestinoRedirecionamento:
        raise HTTPException(status_code=422, detail="Informe o e-mail de redirecionamento.")
    if payload.transferenciaArquivos and not payload.emailDestinoArquivos:
        raise HTTPException(status_code=422, detail="Informe o destino da transferência de arquivos.")

    ticket_id = await next_ticket_id(db, "OFF", OffboardingRequest)

    now = datetime.now(timezone.utc)
    employee_name = sanitize_text(payload.nomeCompleto, max_len=255) or ""
    manager = sanitize_text(payload.gestor, max_len=255) or ""
    email_forward_to = (
        sanitize_email(str(payload.emailDestinoRedirecionamento))
        if payload.emailDestinoRedirecionamento
        else None
    )
    cloud_transfer_to = (
        sanitize_email(str(payload.emailDestinoArquivos)) if payload.emailDestinoArquivos else None
    )
    hardware_assets = sanitize_dict(payload.ativos.model_dump())
    return_method = (sanitize_text(payload.modalidadeDevolucao, max_len=64) or "Presencial")[:64]
    it_checklist = {
        "bloqueioIdP": False,
        "encerramentoSessoes": False,
        "desvinculacaoLicencas": False,
        "remocaoGruposEmail": False,
        "limpezaWipeMDM": False,
        "registroLogsAuditoria": False,
    }
    workflow = sanitize_dict(payload.workflow) if payload.workflow else {}
    requester_email = (
        sanitize_email(str(payload.requesterEmail)) if payload.requesterEmail else creator_email
    )
    assigned_queue = sanitize_text(payload.assignedQueue, max_len=128) or "Service Desk N1"

    # INSERT Core — bypass completo do Unit of Work / relacionamentos ORM
    await db.execute(
        insert(OffboardingRequest).values(
            id=ticket_id,
            status="Pendente TI",
            employee_name=employee_name,
            corp_email=corp_email,
            manager=manager,
            termination_datetime=payload.dataHoraDesligamento,
            email_forward_to=email_forward_to,
            cloud_transfer_to=cloud_transfer_to,
            auto_reply=payload.respostaAutomaticaAusencia,
            redirect_email=payload.redirecionamentoEmail,
            transfer_files=payload.transferenciaArquivos,
            guided_no_personal_files=payload.orientadoNaoManterArquivosPessoais,
            hardware_assets=hardware_assets,
            return_method=return_method,
            return_deadline=payload.prazoLimiteDevolucao,
            it_checklist=it_checklist,
            workflow=workflow,
            requester_email=requester_email,
            assigned_queue=assigned_queue,
            created_by=creator_id,
            created_at=now,
            updated_at=now,
        )
    )

    await write_audit_log(
        db,
        action="OFFBOARDING_CREATED",
        performed_by_user_id=creator_id,
        target_request_id=ticket_id,
        details={
            "employee_name": employee_name,
            "corp_email": corp_email,
            "termination_datetime": payload.dataHoraDesligamento.isoformat(),
        },
    )

    glpi_number: str | None = None
    try:
        result = await db.execute(
            select(OffboardingRequest).where(OffboardingRequest.id == ticket_id)
        )
        row = result.scalar_one()
        glpi = await notify_glpi_on_create(db, row=row, kind="offboarding")
        glpi_number = (glpi or {}).get("glpiTicketNumber") or None
        await write_audit_log(
            db,
            action="GLPI_NOTIFY",
            performed_by_user_id=creator_id,
            target_request_id=ticket_id,
            details={"result": {k: v for k, v in (glpi or {}).items() if k != "channels"}},
        )
    except Exception as exc:  # noqa: BLE001
        await write_audit_log(
            db,
            action="GLPI_NOTIFY",
            performed_by_user_id=creator_id,
            target_request_id=ticket_id,
            details={"ok": False, "error": str(exc)},
        )

    return OffboardingOut(
        id=ticket_id,
        status="Pendente TI",
        createdAt=now,
        updatedAt=now,
        createdBy=creator_email,
        nomeCompleto=employee_name,
        emailCorporativo=corp_email,
        gestor=manager,
        dataHoraDesligamento=payload.dataHoraDesligamento,
        redirecionamentoEmail=payload.redirecionamentoEmail,
        emailDestinoRedirecionamento=email_forward_to,
        transferenciaArquivos=payload.transferenciaArquivos,
        emailDestinoArquivos=cloud_transfer_to,
        respostaAutomaticaAusencia=payload.respostaAutomaticaAusencia,
        orientadoNaoManterArquivosPessoais=payload.orientadoNaoManterArquivosPessoais,
        ativos=copy.deepcopy(hardware_assets),
        modalidadeDevolucao=return_method,
        prazoLimiteDevolucao=payload.prazoLimiteDevolucao,
        itChecklist=copy.deepcopy(it_checklist),
        itNotes=None,
        workflow=copy.deepcopy(workflow) if workflow else None,
        requesterEmail=requester_email,
        assignedQueue=assigned_queue,
        glpiTicketNumber=glpi_number,
    )


@router.get("", response_model=list[OffboardingOut])
async def list_offboarding(
    status_filter: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[OffboardingOut]:
    stmt = (
        select(OffboardingRequest)
        .options(selectinload(OffboardingRequest.creator))
        .order_by(OffboardingRequest.created_at.desc())
    )
    if status_filter:
        stmt = stmt.where(OffboardingRequest.status == status_filter)
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [
        _to_out(r, r.creator.email if r.creator else "unknown")
        for r in rows
        if ticket_visible_to(
            current_user,
            requester_email=r.requester_email,
            manager=r.manager,
        )
    ]


@router.get("/{ticket_id}", response_model=OffboardingOut)
async def get_offboarding(
    ticket_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OffboardingOut:
    result = await db.execute(
        select(OffboardingRequest)
        .options(selectinload(OffboardingRequest.creator))
        .where(OffboardingRequest.id == ticket_id.strip().upper())
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Chamado não encontrado.")
    assert_ticket_visible(
        current_user,
        requester_email=row.requester_email,
        manager=row.manager,
    )
    return _to_out(row, row.creator.email if row.creator else "unknown")


@router.delete("/{ticket_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_offboarding(
    ticket_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    require_roles(current_user, ROLES_DELETE_TICKETS, detail="Sem permissão para excluir.")
    result = await db.execute(
        select(OffboardingRequest).where(OffboardingRequest.id == ticket_id.strip().upper())
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Chamado não encontrado.")
    await write_audit_log(
        db,
        action="OFFBOARDING_DELETED",
        performed_by_user_id=current_user.id,
        target_request_id=row.id,
        details={"employee_name": row.employee_name},
    )
    await db.delete(row)
    await db.flush()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
