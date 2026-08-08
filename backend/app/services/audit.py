from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog
from app.services.sanitizer import audit_safe_payload


async def write_audit_log(
    db: AsyncSession,
    *,
    action: str,
    performed_by_user_id: UUID | None,
    target_request_id: str | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    """Grava audit via INSERT Core (sem relacionamento ORM / sem MissingGreenlet)."""
    await db.execute(
        insert(AuditLog).values(
            id=uuid4(),
            action=action,
            performed_by_user_id=performed_by_user_id,
            target_request_id=target_request_id,
            details=audit_safe_payload(details or {}),
            timestamp=datetime.now(timezone.utc),
        )
    )
