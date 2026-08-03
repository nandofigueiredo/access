from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import get_current_user
from app.database import get_db
from app.models.offboarding import OffboardingRequest
from app.models.user import User
from app.schemas import OffboardingCreate, OffboardingOut
from app.services.audit import write_audit_log
from app.services.sanitizer import sanitize_dict, sanitize_email, sanitize_text
from app.utils.ids import next_ticket_id

router = APIRouter(prefix="/offboarding", tags=["Offboarding"])


def _to_out(row: OffboardingRequest, creator_email: str) -> OffboardingOut:
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
        ativos=row.hardware_assets or {},
        modalidadeDevolucao=row.return_method,
        prazoLimiteDevolucao=row.return_deadline,
        itChecklist=row.it_checklist or {},
        itNotes=row.it_notes,
        workflow=row.workflow or None,
        requesterEmail=row.requester_email,
        assignedQueue=row.assigned_queue,
    )


@router.post("", response_model=OffboardingOut, status_code=status.HTTP_201_CREATED)
async def create_offboarding(
    payload: OffboardingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OffboardingOut:
    corp_email = sanitize_email(str(payload.emailCorporativo))
    if not corp_email:
        raise HTTPException(status_code=422, detail="E-mail corporativo inválido.")

    if payload.redirecionamentoEmail and not payload.emailDestinoRedirecionamento:
        raise HTTPException(status_code=422, detail="Informe o e-mail de redirecionamento.")
    if payload.transferenciaArquivos and not payload.emailDestinoArquivos:
        raise HTTPException(status_code=422, detail="Informe o destino da transferência de arquivos.")

    ticket_id = await next_ticket_id(db, "OFF", OffboardingRequest)

    row = OffboardingRequest(
        id=ticket_id,
        status="Pendente TI",
        employee_name=sanitize_text(payload.nomeCompleto, max_len=255) or "",
        corp_email=corp_email,
        manager=sanitize_text(payload.gestor, max_len=255) or "",
        termination_datetime=payload.dataHoraDesligamento,
        email_forward_to=sanitize_email(str(payload.emailDestinoRedirecionamento))
        if payload.emailDestinoRedirecionamento
        else None,
        cloud_transfer_to=sanitize_email(str(payload.emailDestinoArquivos))
        if payload.emailDestinoArquivos
        else None,
        auto_reply=payload.respostaAutomaticaAusencia,
        redirect_email=payload.redirecionamentoEmail,
        transfer_files=payload.transferenciaArquivos,
        guided_no_personal_files=payload.orientadoNaoManterArquivosPessoais,
        hardware_assets=sanitize_dict(payload.ativos.model_dump()),
        return_method=payload.modalidadeDevolucao,
        return_deadline=payload.prazoLimiteDevolucao,
        it_checklist={
            "bloqueioIdP": False,
            "encerramentoSessoes": False,
            "desvinculacaoLicencas": False,
            "remocaoGruposEmail": False,
            "limpezaWipeMDM": False,
            "registroLogsAuditoria": False,
        },
        workflow=sanitize_dict(payload.workflow) if payload.workflow else {},
        requester_email=sanitize_email(str(payload.requesterEmail)) if payload.requesterEmail else current_user.email,
        assigned_queue=sanitize_text(payload.assignedQueue, max_len=128) or "Service Desk N1",
        created_by=current_user.id,
    )
    db.add(row)
    await db.flush()

    await write_audit_log(
        db,
        action="OFFBOARDING_CREATED",
        performed_by_user_id=current_user.id,
        target_request_id=row.id,
        details={
            "employee_name": row.employee_name,
            "corp_email": row.corp_email,
            "termination_datetime": row.termination_datetime.isoformat(),
        },
    )

    return _to_out(row, current_user.email)


@router.get("", response_model=list[OffboardingOut])
async def list_offboarding(
    status_filter: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[OffboardingOut]:
    _ = current_user
    stmt = (
        select(OffboardingRequest)
        .options(selectinload(OffboardingRequest.creator))
        .order_by(OffboardingRequest.created_at.desc())
    )
    if status_filter:
        stmt = stmt.where(OffboardingRequest.status == status_filter)

    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [_to_out(r, r.creator.email if r.creator else "unknown") for r in rows]


@router.get("/{ticket_id}", response_model=OffboardingOut)
async def get_offboarding(
    ticket_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OffboardingOut:
    _ = current_user
    result = await db.execute(
        select(OffboardingRequest)
        .options(selectinload(OffboardingRequest.creator))
        .where(OffboardingRequest.id == ticket_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Chamado de offboarding não encontrado.")
    return _to_out(row, row.creator.email if row.creator else "unknown")


@router.delete("/{ticket_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_offboarding(
    ticket_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    if current_user.role not in {"admin", "ti", "rh"}:
        raise HTTPException(status_code=403, detail="Sem permissão para excluir chamados.")

    result = await db.execute(select(OffboardingRequest).where(OffboardingRequest.id == ticket_id))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Chamado não encontrado.")

    snapshot = {
        "employee_name": row.employee_name,
        "corp_email": row.corp_email,
        "status": row.status,
    }
    await db.delete(row)
    await write_audit_log(
        db,
        action="OFFBOARDING_DELETED",
        performed_by_user_id=current_user.id,
        target_request_id=ticket_id,
        details=snapshot,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
