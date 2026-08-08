from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


async def next_ticket_id(db: AsyncSession, prefix: str, model) -> str:  # noqa: ANN001
    """Gera IDs legíveis: ONB-2026-001 / OFF-2026-001 (próximo após o maior existente)."""
    year = datetime.utcnow().year
    like_pattern = f"{prefix}-{year}-%"
    result = await db.execute(select(model.id).where(model.id.like(like_pattern)))
    max_n = 0
    for tid in result.scalars().all():
        try:
            max_n = max(max_n, int(str(tid).rsplit("-", 1)[-1]))
        except ValueError:
            continue
    return f"{prefix}-{year}-{max_n + 1:03d}"
