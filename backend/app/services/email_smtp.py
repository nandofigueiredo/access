"""Envio SMTP real (ou simulado) a partir de app_settings.smtp."""

from __future__ import annotations

import logging
from email.message import EmailMessage
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.settings import AppSetting

logger = logging.getLogger(__name__)


async def load_smtp_config(db: AsyncSession) -> dict[str, Any]:
    result = await db.execute(select(AppSetting).where(AppSetting.key == "smtp"))
    row = result.scalar_one_or_none()
    if not row or not isinstance(row.value, dict):
        return {}
    return dict(row.value)


async def send_smtp_email(
    db: AsyncSession,
    *,
    to: list[str],
    subject: str,
    body: str,
    reply_to: str | None = None,
) -> dict[str, Any]:
    """
    Envia e-mail via SMTP configurado em settings.
    Se enabled=false ou testMode=true: não envia, retorna status simulated.
    """
    cfg = await load_smtp_config(db)
    recipients = [t.strip() for t in to if t and "@" in t]
    if not recipients:
        return {"ok": False, "status": "failed", "error": "Nenhum destinatário válido."}

    enabled = bool(cfg.get("enabled"))
    test_mode = bool(cfg.get("testMode", True))
    from_email = str(cfg.get("fromEmail") or "noreply@diroma.com.br")
    from_name = str(cfg.get("fromName") or "Portal TI diRoma")
    reply = reply_to or cfg.get("replyTo") or from_email

    if not enabled or test_mode:
        logger.info(
            "SMTP simulado → %s | %s",
            ", ".join(recipients),
            subject[:120],
        )
        return {
            "ok": True,
            "status": "sent_simulated",
            "to": recipients,
            "subject": subject,
            "testMode": True,
        }

    host = str(cfg.get("host") or "")
    port = int(cfg.get("port") or 587)
    username = str(cfg.get("username") or "")
    password = str(cfg.get("password") or "")
    secure = bool(cfg.get("secure"))

    if not host or not username:
        return {"ok": False, "status": "failed", "error": "SMTP incompleto (host/usuário)."}

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"{from_name} <{from_email}>"
    msg["To"] = ", ".join(recipients)
    if reply:
        msg["Reply-To"] = str(reply)
    msg.set_content(body)

    try:
        import aiosmtplib

        await aiosmtplib.send(
            msg,
            hostname=host,
            port=port,
            username=username or None,
            password=password or None,
            start_tls=not secure and port in (587, 25, 2587),
            use_tls=secure,
        )
        return {"ok": True, "status": "sent", "to": recipients, "subject": subject}
    except Exception as exc:  # noqa: BLE001
        logger.exception("Falha SMTP")
        return {"ok": False, "status": "failed", "error": str(exc), "to": recipients}
