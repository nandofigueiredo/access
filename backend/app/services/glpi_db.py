"""Consulta o MySQL/MariaDB do GLPI para vincular o número do chamado ao portal."""

from __future__ import annotations

import logging
from typing import Any

import aiomysql
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.models.offboarding import OffboardingRequest
from app.models.onboarding import OnboardingRequest
from app.services.audit import write_audit_log

logger = logging.getLogger(__name__)


def _portal_markers(portal_id: str) -> list[str]:
    pid = portal_id.strip().upper()
    return [
        f"%[PORTAL:{pid}]%",
        f"%PORTAL:{pid}%",
        f"%{pid}%",
    ]


async def find_glpi_ticket_id(portal_id: str, settings: Settings | None = None) -> str | None:
    """Busca o id do ticket no GLPI cujo conteúdo/assunto referencia o ID do portal."""
    cfg = settings or get_settings()
    if not cfg.glpi_db_configured:
        return None

    markers = _portal_markers(portal_id)
    # GLPI 10/11: glpi_tickets.id é o número exibido; content/name recebem o e-mail collector
    sql = """
        SELECT id
        FROM glpi_tickets
        WHERE is_deleted = 0
          AND (
                content LIKE %s OR content LIKE %s OR content LIKE %s
             OR name LIKE %s OR name LIKE %s OR name LIKE %s
          )
        ORDER BY id DESC
        LIMIT 1
    """
    params = markers + markers

    try:
        conn = await aiomysql.connect(
            host=cfg.glpi_db_host,
            port=int(cfg.glpi_db_port or 3306),
            user=cfg.glpi_db_user,
            password=cfg.glpi_db_password or "",
            db=cfg.glpi_db_name,
            charset="utf8mb4",
            connect_timeout=8,
            autocommit=True,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("GLPI DB conexão falhou: %s", exc)
        return None

    try:
        async with conn.cursor() as cur:
            await cur.execute(sql, params)
            row = await cur.fetchone()
            if not row:
                return None
            return str(row[0])
    except Exception as exc:  # noqa: BLE001
        logger.warning("GLPI DB consulta falhou (%s): %s", portal_id, exc)
        return None
    finally:
        conn.close()


async def ping_glpi_db(settings: Settings | None = None) -> dict[str, Any]:
    cfg = settings or get_settings()
    if not cfg.glpi_db_configured:
        return {"ok": False, "configured": False, "error": "GLPI_DB_* não configurado"}
    try:
        conn = await aiomysql.connect(
            host=cfg.glpi_db_host,
            port=int(cfg.glpi_db_port or 3306),
            user=cfg.glpi_db_user,
            password=cfg.glpi_db_password or "",
            db=cfg.glpi_db_name,
            charset="utf8mb4",
            connect_timeout=8,
            autocommit=True,
        )
        async with conn.cursor() as cur:
            await cur.execute("SELECT COUNT(*) FROM glpi_tickets WHERE is_deleted = 0")
            (count,) = await cur.fetchone()
        conn.close()
        return {"ok": True, "configured": True, "tickets": int(count)}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "configured": True, "error": str(exc)}


async def sync_glpi_numbers_from_db(
    db: AsyncSession,
    *,
    performed_by_user_id=None,
    limit: int = 40,
) -> dict[str, Any]:
    """Preenche glpi_ticket_number nos chamados do portal ainda sem número."""
    cfg = get_settings()
    if not cfg.glpi_db_configured:
        return {"ok": False, "linked": 0, "checked": 0, "error": "GLPI DB não configurado"}

    onb = (
        await db.execute(
            select(OnboardingRequest)
            .where(
                or_(
                    OnboardingRequest.glpi_ticket_number.is_(None),
                    OnboardingRequest.glpi_ticket_number == "",
                )
            )
            .order_by(OnboardingRequest.created_at.desc())
            .limit(limit)
        )
    ).scalars().all()

    off = (
        await db.execute(
            select(OffboardingRequest)
            .where(
                or_(
                    OffboardingRequest.glpi_ticket_number.is_(None),
                    OffboardingRequest.glpi_ticket_number == "",
                )
            )
            .order_by(OffboardingRequest.created_at.desc())
            .limit(limit)
        )
    ).scalars().all()

    linked = 0
    checked = 0
    details: list[dict[str, str]] = []

    for row in [*onb, *off]:
        checked += 1
        glpi_id = await find_glpi_ticket_id(row.id, cfg)
        if not glpi_id:
            continue
        row.glpi_ticket_number = glpi_id
        linked += 1
        details.append({"portalId": row.id, "glpiTicketNumber": glpi_id})
        await write_audit_log(
            db,
            action="GLPI_TICKET_LINKED",
            performed_by_user_id=performed_by_user_id,
            target_request_id=row.id,
            details={"glpi_ticket_number": glpi_id, "source": "glpi_db"},
        )

    if linked:
        await db.flush()

    return {"ok": True, "linked": linked, "checked": checked, "items": details}
