from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import get_current_user
from app.auth.access import (
    ROLES_CREATE_ONBOARDING,
    ROLES_DELETE_TICKETS,
    assert_ticket_visible,
    require_roles,
    ticket_visible_to,
)
from app.database import get_db
from app.models.onboarding import OnboardingRequest
from app.models.user import User
from app.schemas import OnboardingCreate, OnboardingOut
from app.services.audit import write_audit_log
from app.services.sanitizer import sanitize_cpf, sanitize_dict, sanitize_email, sanitize_text
from app.services.glpi_notify import notify_glpi_on_create
from app.utils.ids import next_ticket_id

router = APIRouter(prefix="/onboarding", tags=["Onboarding"])


def _to_out(row: OnboardingRequest, creator_email: str) -> OnboardingOut:
    systems = row.systems_access or {}
    return OnboardingOut(
        id=row.id,
        status=row.status,  # type: ignore[arg-type]
        createdAt=row.created_at,
        updatedAt=row.updated_at,
        createdBy=creator_email,
        nomeCompleto=row.employee_name,
        cpf=row.cpf,
        emailPessoal=row.personal_email,
        cargo=row.position,
        departamento=row.department,
        gestor=row.manager,
        dataInicio=row.start_date,
        modalidade=row.work_mode,
        enderecoEntrega=row.address,
        perfilHardware=row.hardware_profile,
        justificativaHardware=systems.get("justificativaHardware"),
        perifericos=row.peripherals or {},
        telefonia=systems.get("telefonia") or {},
        copiarAcessosDe=systems.get("copiarAcessosDe"),
        plataformaBase=systems.get("plataformaBase") or {},
        sistemasEspecificos=systems.get("sistemasEspecificos") or {},
        unidade=row.unit_location,
        necessitaCracha=row.requires_badge,
        lgpdAceito=row.lgpd_accepted,
        itChecklist=row.it_checklist,
        itNotes=row.it_notes,
        workflow=row.workflow or None,
        requesterEmail=row.requester_email,
        assignedQueue=row.assigned_queue,
        glpiTicketNumber=row.glpi_ticket_number,
    )


@router.post("", response_model=OnboardingOut, status_code=status.HTTP_201_CREATED)
async def create_onboarding(
    payload: OnboardingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OnboardingOut:
    require_roles(
        current_user,
        ROLES_CREATE_ONBOARDING,
        detail="Sem permissão para criar onboarding.",
    )
    try:
        cpf = sanitize_cpf(payload.cpf)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    personal_email = sanitize_email(str(payload.emailPessoal))
    if not personal_email:
        raise HTTPException(status_code=422, detail="E-mail pessoal inválido.")

    if payload.modalidade in ("Remoto", "Híbrido") and not (payload.enderecoEntrega or "").strip():
        raise HTTPException(
            status_code=422,
            detail="Endereço de entrega é obrigatório para modalidade Remoto/Híbrido.",
        )

    if payload.perfilHardware == "Padrão Avançado" and not (payload.justificativaHardware or "").strip():
        raise HTTPException(
            status_code=422,
            detail="Justificativa é obrigatória para Perfil Avançado.",
        )

    ticket_id = await next_ticket_id(db, "ONB", OnboardingRequest)

    systems_access = sanitize_dict(
        {
            "justificativaHardware": payload.justificativaHardware,
            "telefonia": payload.telefonia.model_dump(),
            "copiarAcessosDe": payload.copiarAcessosDe,
            "plataformaBase": payload.plataformaBase.model_dump(),
            "sistemasEspecificos": payload.sistemasEspecificos.model_dump(),
        }
    )

    row = OnboardingRequest(
        id=ticket_id,
        status="Pendente TI",
        employee_name=sanitize_text(payload.nomeCompleto, max_len=255) or "",
        cpf=cpf,
        personal_email=personal_email,
        position=sanitize_text(payload.cargo, max_len=255) or "",
        department=payload.departamento,
        manager=sanitize_text(payload.gestor, max_len=255) or "",
        start_date=payload.dataInicio,
        work_mode=payload.modalidade,
        address=sanitize_text(payload.enderecoEntrega, max_len=1000),
        hardware_profile=payload.perfilHardware,
        peripherals=sanitize_dict(payload.perifericos.model_dump()),
        systems_access=systems_access,
        requires_badge=payload.necessitaCracha,
        unit_location=sanitize_text(payload.unidade, max_len=255),
        lgpd_accepted=payload.lgpdAceito,
        it_checklist={
            "hardwareProvisionado": False,
            "contaEntraIdCriada": False,
            "sistemasLiberados": False,
            "crachaSolicitado": payload.necessitaCracha,
            "termoEnviado": False,
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
        action="ONBOARDING_CREATED",
        performed_by_user_id=current_user.id,
        target_request_id=row.id,
        details={
            "employee_name": row.employee_name,
            "department": row.department,
            "cpf": row.cpf,
            "start_date": str(row.start_date),
        },
    )

    glpi = await notify_glpi_on_create(db, row=row, kind="onboarding")
    await write_audit_log(
        db,
        action="GLPI_NOTIFY",
        performed_by_user_id=current_user.id,
        target_request_id=row.id,
        details={"result": glpi},
    )

    return _to_out(row, current_user.email)


@router.get("", response_model=list[OnboardingOut])
async def list_onboarding(
    status_filter: str | None = Query(None, alias="status"),
    department: str | None = Query(None, alias="departamento"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[OnboardingOut]:
    stmt = (
        select(OnboardingRequest)
        .options(selectinload(OnboardingRequest.creator))
        .order_by(OnboardingRequest.created_at.desc())
    )
    if status_filter:
        stmt = stmt.where(OnboardingRequest.status == status_filter)
    if department:
        stmt = stmt.where(OnboardingRequest.department == department)

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


@router.get("/{ticket_id}", response_model=OnboardingOut)
async def get_onboarding(
    ticket_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OnboardingOut:
    result = await db.execute(
        select(OnboardingRequest)
        .options(selectinload(OnboardingRequest.creator))
        .where(OnboardingRequest.id == ticket_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Chamado de onboarding não encontrado.")
    assert_ticket_visible(
        current_user,
        requester_email=row.requester_email,
        manager=row.manager,
    )
    return _to_out(row, row.creator.email if row.creator else "unknown")


@router.delete("/{ticket_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_onboarding(
    ticket_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    require_roles(
        current_user,
        ROLES_DELETE_TICKETS,
        detail="Sem permissão para excluir chamados.",
    )

    result = await db.execute(select(OnboardingRequest).where(OnboardingRequest.id == ticket_id))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Chamado não encontrado.")

    snapshot = {
        "employee_name": row.employee_name,
        "department": row.department,
        "cpf": row.cpf,
        "status": row.status,
    }
    await db.delete(row)
    await write_audit_log(
        db,
        action="ONBOARDING_DELETED",
        performed_by_user_id=current_user.id,
        target_request_id=ticket_id,
        details=snapshot,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
