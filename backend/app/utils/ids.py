from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession


async def next_ticket_id(db: AsyncSession, prefix: str, model) -> str:  # noqa: ANN001
    """Gera IDs legíveis: ONB-2026-001 / OFF-2026-001."""
    year = datetime.utcnow().year
    like_pattern = f"{prefix}-{year}-%"
    result = await db.execute(
        select(func.count()).select_from(model).where(model.id.like(like_pattern))
    )
    count = int(result.scalar_one() or 0) + 1
    return f"{prefix}-{year}-{count:03d}"
