from __future__ import annotations

import copy
import logging
import re
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.offboarding import OffboardingRequest
from app.models.onboarding import OnboardingRequest
from app.services.audit import write_audit_log
from app.services.email_smtp import load_smtp_config, send_smtp_email
from app.services.glpi_api import create_glpi_ticket_from_snapshot

logger = logging.getLogger(__name__)

PORTAL_ID_RE = re.compile(r"\[PORTAL:((?:ONB|OFF)-\d{4}-\d+)\]", re.IGNORECASE)
PORTAL_ID_LOOSE_RE = re.compile(r"\b((?:ONB|OFF)-\d{4}-\d+)\b", re.IGNORECASE)
GLPI_NUM_RE = re.compile(
    r"(?:ticket|chamado|glpi)\s*[#:]?\s*(\d{4,})",
    re.IGNORECASE,
)
GLPI_HASH_RE = re.compile(r"#(\d{4,})")


@dataclass(frozen=True)
class GlpiTicketSnapshot:
    """Dados planos para GLPI — sem ORM após o primeiro await."""

    kind: str
    portal_id: str
    employee_name: str
    manager: str
    assigned_queue: str | None
    requester_email: str | None
    # onboarding
    cpf: str | None = None
    personal_email: str | None = None
    position: str | None = None
    department: str | None = None
    start_date: date | None = None
    work_mode: str | None = None
    unit_location: str | None = None
    hardware_profile: str | None = None
    requires_badge: bool = False
    # offboarding
    corp_email: str | None = None
    termination_datetime: datetime | None = None
    redirect_email: bool = False
    transfer_files: bool = False
    return_method: str | None = None
    return_deadline: date | None = None


def extract_portal_ticket_id(*texts: str | None) -> str | None:
    blob = "\n".join(t for t in texts if t)
    if not blob:
        return None
    m = PORTAL_ID_RE.search(blob) or PORTAL_ID_LOOSE_RE.search(blob)
    return m.group(1).upper() if m else None


def extract_glpi_ticket_number(*texts: str | None) -> str | None:
    blob = "\n".join(t for t in texts if t)
    if not blob:
        return None
    m = GLPI_NUM_RE.search(blob) or GLPI_HASH_RE.search(blob)
    return m.group(1) if m else None


def snapshot_from_row(row: OnboardingRequest | OffboardingRequest, *, kind: str) -> GlpiTicketSnapshot:
    if kind == "onboarding" and isinstance(row, OnboardingRequest):
        return GlpiTicketSnapshot(
            kind="onboarding",
            portal_id=str(row.id),
            employee_name=str(row.employee_name),
            manager=str(row.manager),
            assigned_queue=row.assigned_queue,
            requester_email=row.requester_email,
            cpf=row.cpf,
            personal_email=row.personal_email,
            position=row.position,
            department=row.department,
            start_date=row.start_date,
            work_mode=row.work_mode,
            unit_location=row.unit_location,
            hardware_profile=row.hardware_profile,
            requires_badge=bool(row.requires_badge),
        )
    if kind == "offboarding" and isinstance(row, OffboardingRequest):
        return GlpiTicketSnapshot(
            kind="offboarding",
            portal_id=str(row.id),
            employee_name=str(row.employee_name),
            manager=str(row.manager),
            assigned_queue=row.assigned_queue,
            requester_email=row.requester_email,
            corp_email=row.corp_email,
            termination_datetime=row.termination_datetime,
            redirect_email=bool(row.redirect_email),
            transfer_files=bool(row.transfer_files),
            return_method=row.return_method,
            return_deadline=row.return_deadline,
        )
    raise ValueError("Tipo de chamado inválido para snapshot GLPI")


def build_glpi_email_from_snapshot(snap: GlpiTicketSnapshot) -> tuple[str, str]:
    if snap.kind == "onboarding":
        subject = f"[PORTAL:{snap.portal_id}] Onboarding — {snap.employee_name}"
        body = f"""Abertura automática de chamado GLPI — Portal TI diRoma

Marcador: [PORTAL:{snap.portal_id}]
ID Portal: {snap.portal_id}
Tipo: Onboarding
Colaborador: {snap.employee_name}
CPF: {snap.cpf}
E-mail pessoal: {snap.personal_email}
Cargo: {snap.position}
Departamento: {snap.department}
Gestor: {snap.manager}
Data início: {snap.start_date}
Modalidade: {snap.work_mode}
Unidade: {snap.unit_location or "—"}
Hardware: {snap.hardware_profile}
Crachá: {"Sim" if snap.requires_badge else "Não"}
Fila: {snap.assigned_queue or "Service Desk N1"}
Solicitante: {snap.requester_email or "—"}
"""
        return subject, body

    subject = f"[PORTAL:{snap.portal_id}] Offboarding — {snap.employee_name}"
    term = snap.termination_datetime.isoformat() if snap.termination_datetime else "—"
    body = f"""Abertura automática de chamado GLPI — Portal TI diRoma

Marcador: [PORTAL:{snap.portal_id}]
ID Portal: {snap.portal_id}
Tipo: Offboarding
Colaborador: {snap.employee_name}
E-mail corporativo: {snap.corp_email}
Gestor: {snap.manager}
Desligamento: {term}
Redirecionamento e-mail: {"Sim" if snap.redirect_email else "Não"}
Transferência arquivos: {"Sim" if snap.transfer_files else "Não"}
Devolução: {snap.return_method}
Prazo devolução: {snap.return_deadline or "—"}
Fila: {snap.assigned_queue or "Service Desk N1"}
Solicitante: {snap.requester_email or "—"}
"""
    return subject, body


# Compatível com imports antigos
def build_glpi_email_onboarding(row: OnboardingRequest) -> tuple[str, str]:
    return build_glpi_email_from_snapshot(snapshot_from_row(row, kind="onboarding"))


def build_glpi_email_offboarding(row: OffboardingRequest) -> tuple[str, str]:
    return build_glpi_email_from_snapshot(snapshot_from_row(row, kind="offboarding"))


async def _notify_glpi_email_fallback(
    db: AsyncSession,
    *,
    snap: GlpiTicketSnapshot,
    cfg: dict[str, Any],
) -> dict[str, Any]:
    inbox = str(cfg.get("glpiInbox") or "glpi@diroma.com.br").strip()
    subject, body = build_glpi_email_from_snapshot(snap)
    mail_result = await send_smtp_email(
        db,
        to=[inbox],
        subject=subject,
        body=body,
        reply_to=str(cfg.get("replyTo") or cfg.get("fromEmail") or ""),
        force=True,
    )
    return {
        "ok": bool(mail_result.get("ok") or mail_result.get("status") in {"sent", "simulated"}),
        "status": mail_result.get("status") or "failed",
        "channels": {"email": mail_result},
        "error": mail_result.get("error"),
    }


async def notify_glpi_on_create(
    db: AsyncSession,
    *,
    row: OnboardingRequest | OffboardingRequest,
    kind: str,
) -> dict[str, Any]:
    """Abre chamado no GLPI. Nunca propaga exceção (criação do portal não pode falhar por GLPI)."""
    try:
        # Snapshot síncrono ANTES de qualquer await
        portal_id = str(row.id)
        existing = (row.glpi_ticket_number or "").strip()
        snap = snapshot_from_row(row, kind=kind)
    except Exception as exc:  # noqa: BLE001
        logger.exception("GLPI snapshot falhou")
        return {"ok": False, "status": "failed", "error": f"snapshot: {exc}"}

    try:
        return await _notify_glpi_on_create_inner(
            db, snap=snap, portal_id=portal_id, existing=existing
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("GLPI notify falhou para %s (chamado do portal mantido)", portal_id)
        return {"ok": False, "status": "failed", "error": str(exc)}


async def _notify_glpi_on_create_inner(
    db: AsyncSession,
    *,
    snap: GlpiTicketSnapshot,
    portal_id: str,
    existing: str,
) -> dict[str, Any]:
    cfg = await load_smtp_config(db)
    if not bool(cfg.get("glpiEnabled", True)):
        logger.warning("GLPI notify skipped: glpiEnabled=false (%s)", portal_id)
        return {"ok": True, "status": "skipped", "reason": "glpiEnabled=false"}

    settings = get_settings()
    if existing:
        return {
            "ok": True,
            "status": "already_linked",
            "glpiTicketNumber": existing,
            "reason": "Chamado GLPI já vinculado",
        }

    if settings.glpi_api_configured:
        api_result = await create_glpi_ticket_from_snapshot(snap, settings=settings)
        if api_result.get("ok") and api_result.get("glpiTicketNumber"):
            num = str(api_result["glpiTicketNumber"])
            # UPDATE via Core — não toca relacionamento ORM
            from sqlalchemy import update as sa_update

            model = OnboardingRequest if snap.kind == "onboarding" else OffboardingRequest
            await db.execute(
                sa_update(model).where(model.id == portal_id).values(glpi_ticket_number=num)
            )
            await write_audit_log(
                db,
                action="GLPI_TICKET_CREATED_API",
                performed_by_user_id=None,
                target_request_id=portal_id,
                details={"glpi_ticket_number": num, "apiBase": api_result.get("apiBase")},
            )
            logger.info("GLPI API criou ticket %s para %s", num, portal_id)
            return {
                "ok": True,
                "status": "created",
                "glpiTicketNumber": num,
                "channels": {
                    "api": copy.deepcopy({k: v for k, v in api_result.items() if k != "raw"})
                },
            }

        err = api_result.get("error") or api_result.get("reason") or "Falha na API GLPI"
        logger.warning("GLPI API falhou para %s: %s", portal_id, err)
        if settings.glpi_email_fallback:
            mail = await _notify_glpi_email_fallback(db, snap=snap, cfg=cfg)
            mail["channels"] = {**(mail.get("channels") or {}), "api": api_result}
            mail["error"] = err
            return mail
        return {
            "ok": False,
            "status": "failed",
            "error": err,
            "channels": {"api": api_result},
        }

    if settings.glpi_email_fallback:
        logger.warning("GLPI API não configurada — usando e-mail (GLPI_EMAIL_FALLBACK=true)")
        return await _notify_glpi_email_fallback(db, snap=snap, cfg=cfg)

    return {
        "ok": False,
        "status": "failed",
        "error": "GLPI_API_* não configurado. Defina URL, app_token e user/senha no .env.",
    }
