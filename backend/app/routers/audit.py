from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import get_current_user
from app.database import get_db
from app.models.audit import AuditLog
from app.models.user import User
from app.schemas import AuditLogOut

router = APIRouter(prefix="/audit", tags=["Audit"])


@router.get("", response_model=list[AuditLogOut])
async def list_audit_logs(
    limit: int = Query(100, ge=1, le=500),
    target: str | None = Query(None, alias="targetRequestId"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[AuditLogOut]:
    _ = current_user
    stmt = (
        select(AuditLog)
        .options(selectinload(AuditLog.performer))
        .order_by(AuditLog.timestamp.desc())
        .limit(limit)
    )
    if target:
        stmt = stmt.where(AuditLog.target_request_id == target)

    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [
        AuditLogOut(
            id=row.id,
            action=row.action,
            targetRequestId=row.target_request_id,
            performedBy=row.performer.email if row.performer else None,
            timestamp=row.timestamp,
            details=row.details or {},
        )
        for row in rows
    ]
