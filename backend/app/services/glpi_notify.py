"""Notificações e parsing relacionados ao GLPI."""

from __future__ import annotations

import logging
import re
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.offboarding import OffboardingRequest
from app.models.onboarding import OnboardingRequest
from app.services.email_smtp import load_smtp_config, send_smtp_email

logger = logging.getLogger(__name__)

PORTAL_ID_RE = re.compile(r"\[PORTAL:((?:ONB|OFF)-\d{4}-\d+)\]", re.IGNORECASE)
PORTAL_ID_LOOSE_RE = re.compile(r"\b((?:ONB|OFF)-\d{4}-\d+)\b", re.IGNORECASE)
# Preferências: Ticket #12345 | Chamado 12345 | GLPI: 12345
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

Por favor abra o chamado no GLPI e responda informando o número
(ex.: Ticket #12345) mantendo [PORTAL:{row.id}] no assunto.
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

Por favor abra o chamado no GLPI e responda informando o número
(ex.: Ticket #12345) mantendo [PORTAL:{row.id}] no assunto.
"""
    return subject, body


async def notify_glpi_on_create(
    db: AsyncSession,
    *,
    row: OnboardingRequest | OffboardingRequest,
    kind: str,
) -> dict[str, Any]:
    cfg = await load_smtp_config(db)
    if not bool(cfg.get("glpiEnabled", True)):
        logger.warning("GLPI notify skipped: glpiEnabled=false (%s)", getattr(row, "id", "?"))
        return {"ok": True, "status": "skipped", "reason": "glpiEnabled=false"}

    inbox = str(cfg.get("glpiInbox") or "glpi@diroma.com.br").strip()
    if kind == "onboarding" and isinstance(row, OnboardingRequest):
        subject, body = build_glpi_email_onboarding(row)
    elif kind == "offboarding" and isinstance(row, OffboardingRequest):
        subject, body = build_glpi_email_offboarding(row)
    else:
        return {"ok": False, "status": "failed", "error": "Tipo inválido"}

    # force=True: abertura no GLPI precisa de e-mail real mesmo com Modo teste ligado
    result = await send_smtp_email(
        db,
        to=[inbox],
        subject=subject,
        body=body,
        reply_to=str(cfg.get("replyTo") or cfg.get("fromEmail") or ""),
        force=True,
    )
    logger.info(
        "GLPI notify %s → %s status=%s error=%s",
        getattr(row, "id", "?"),
        inbox,
        result.get("status"),
        result.get("error"),
    )
    return result
