"""Abertura de chamado no GLPI (API REST) + parsing legado."""

from __future__ import annotations

import logging
import re
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.offboarding import OffboardingRequest
from app.models.onboarding import OnboardingRequest
from app.services.audit import write_audit_log
from app.services.email_smtp import load_smtp_config, send_smtp_email
from app.services.glpi_api import create_glpi_ticket

logger = logging.getLogger(__name__)

PORTAL_ID_RE = re.compile(r"\[PORTAL:((?:ONB|OFF)-\d{4}-\d+)\]", re.IGNORECASE)
PORTAL_ID_LOOSE_RE = re.compile(r"\b((?:ONB|OFF)-\d{4}-\d+)\b", re.IGNORECASE)
GLPI_NUM_RE = re.compile(
    r"(?:ticket|chamado|glpi)\s*[#:]?\s*(\d{4,})",
    re.IGNORECASE,
)
GLPI_HASH_RE = re.compile(r"#(\d{4,})")


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


def build_glpi_email_onboarding(row: OnboardingRequest) -> tuple[str, str]:
    subject = f"[PORTAL:{row.id}] Onboarding — {row.employee_name}"
    body = f"""Abertura automática de chamado GLPI — Portal TI diRoma

Marcador: [PORTAL:{row.id}]
ID Portal: {row.id}
Tipo: Onboarding
Colaborador: {row.employee_name}
CPF: {row.cpf}
E-mail pessoal: {row.personal_email}
Cargo: {row.position}
Departamento: {row.department}
Gestor: {row.manager}
Data início: {row.start_date}
Modalidade: {row.work_mode}
Unidade: {row.unit_location or "—"}
Hardware: {row.hardware_profile}
Crachá: {"Sim" if row.requires_badge else "Não"}
Fila: {row.assigned_queue or "Service Desk N1"}
Solicitante: {row.requester_email or "—"}
"""
    return subject, body


def build_glpi_email_offboarding(row: OffboardingRequest) -> tuple[str, str]:
    subject = f"[PORTAL:{row.id}] Offboarding — {row.employee_name}"
    body = f"""Abertura automática de chamado GLPI — Portal TI diRoma

Marcador: [PORTAL:{row.id}]
ID Portal: {row.id}
Tipo: Offboarding
Colaborador: {row.employee_name}
E-mail corporativo: {row.corp_email}
Gestor: {row.manager}
Desligamento: {row.termination_datetime.isoformat()}
Redirecionamento e-mail: {"Sim" if row.redirect_email else "Não"}
Transferência arquivos: {"Sim" if row.transfer_files else "Não"}
Devolução: {row.return_method}
Prazo devolução: {row.return_deadline or "—"}
Fila: {row.assigned_queue or "Service Desk N1"}
Solicitante: {row.requester_email or "—"}
"""
    return subject, body


async def _notify_glpi_email_fallback(
    db: AsyncSession,
    *,
    row: OnboardingRequest | OffboardingRequest,
    kind: str,
    cfg: dict[str, Any],
) -> dict[str, Any]:
    inbox = str(cfg.get("glpiInbox") or "glpi@diroma.com.br").strip()
    if kind == "onboarding" and isinstance(row, OnboardingRequest):
        subject, body = build_glpi_email_onboarding(row)
    elif kind == "offboarding" and isinstance(row, OffboardingRequest):
        subject, body = build_glpi_email_offboarding(row)
    else:
        return {"ok": False, "status": "failed", "error": "Tipo inválido"}

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
    """Abre chamado no GLPI via API REST e grava o número. Nunca propaga exceção (criação do portal não pode falhar por GLPI)."""
    portal_id = str(getattr(row, "id", "") or "?")
    try:
        return await _notify_glpi_on_create_inner(db, row=row, kind=kind)
    except Exception as exc:  # noqa: BLE001
        logger.exception("GLPI notify falhou para %s (chamado do portal mantido)", portal_id)
        return {"ok": False, "status": "failed", "error": str(exc)}


async def _notify_glpi_on_create_inner(
    db: AsyncSession,
    *,
    row: OnboardingRequest | OffboardingRequest,
    kind: str,
) -> dict[str, Any]:
    portal_id = str(row.id)
    existing = (row.glpi_ticket_number or "").strip()

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
        api_result = await create_glpi_ticket(row, kind=kind, settings=settings)
        if api_result.get("ok") and api_result.get("glpiTicketNumber"):
            num = str(api_result["glpiTicketNumber"])
            row.glpi_ticket_number = num
            await db.flush()
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
                "channels": {"api": api_result},
            }

        err = api_result.get("error") or api_result.get("reason") or "Falha na API GLPI"
        logger.warning("GLPI API falhou para %s: %s", portal_id, err)
        if settings.glpi_email_fallback:
            mail = await _notify_glpi_email_fallback(db, row=row, kind=kind, cfg=cfg)
            mail["channels"] = {**(mail.get("channels") or {}), "api": api_result}
            mail["error"] = err
            return mail
        return {
            "ok": False,
            "status": "failed",
            "error": err,
            "channels": {"api": api_result},
        }

    # API não configurada
    if settings.glpi_email_fallback:
        logger.warning("GLPI API não configurada — usando e-mail (GLPI_EMAIL_FALLBACK=true)")
        return await _notify_glpi_email_fallback(db, row=row, kind=kind, cfg=cfg)

    return {
        "ok": False,
        "status": "failed",
        "error": "GLPI_API_* não configurado. Defina URL, app_token e user/senha no .env.",
    }
