"""Abertura GLPI somente após o chamado existir de fato no portal (pós-commit)."""

from __future__ import annotations

import asyncio
import logging
from uuid import UUID

from fastapi import BackgroundTasks
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.offboarding import OffboardingRequest
from app.models.onboarding import OnboardingRequest
from app.services.audit import write_audit_log
from app.services.glpi_notify import notify_glpi_on_create

logger = logging.getLogger(__name__)


def schedule_glpi_after_portal_commit(
    background_tasks: BackgroundTasks,
    *,
    ticket_id: str,
    kind: str,
    performed_by_user_id: UUID | None = None,
) -> None:
    """Agenda abertura no GLPI só depois da resposta (e do commit) do portal."""
    background_tasks.add_task(
        _run_glpi_after_commit,
        ticket_id=ticket_id.strip().upper(),
        kind=kind,
        performed_by_user_id=performed_by_user_id,
    )


async def _run_glpi_after_commit(
    *,
    ticket_id: str,
    kind: str,
    performed_by_user_id: UUID | None,
) -> None:
    # Garante que o commit do request HTTP já finalizou
    await asyncio.sleep(0.35)

    async with AsyncSessionLocal() as session:
        try:
            if kind == "onboarding":
                result = await session.execute(
                    select(OnboardingRequest).where(OnboardingRequest.id == ticket_id)
                )
            else:
                result = await session.execute(
                    select(OffboardingRequest).where(OffboardingRequest.id == ticket_id)
                )
            row = result.scalar_one_or_none()
            if not row:
                logger.warning(
                    "GLPI pós-commit abortado: %s não existe no portal (provável rollback)",
                    ticket_id,
                )
                return

            if (row.glpi_ticket_number or "").strip():
                logger.info(
                    "GLPI pós-commit: %s já vinculado ao chamado %s",
                    ticket_id,
                    row.glpi_ticket_number,
                )
                return

            glpi = await notify_glpi_on_create(session, row=row, kind=kind)
            await write_audit_log(
                session,
                action="GLPI_NOTIFY",
                performed_by_user_id=performed_by_user_id,
                target_request_id=ticket_id,
                details={
                    "phase": "after_commit",
                    "result": {k: v for k, v in (glpi or {}).items() if k != "channels"},
                },
            )
            await session.commit()
            logger.info(
                "GLPI pós-commit %s → %s",
                ticket_id,
                (glpi or {}).get("glpiTicketNumber") or (glpi or {}).get("status"),
            )
        except Exception:  # noqa: BLE001
            logger.exception("GLPI pós-commit falhou para %s (portal permanece salvo)", ticket_id)
            await session.rollback()
