from __future__ import annotations

from typing import Optional

import redis.asyncio as redis

from app.config import get_settings

_client: Optional[redis.Redis] = None


def get_redis() -> redis.Redis:
    """Cliente Redis compartilhado (lazy)."""
    global _client
    if _client is None:
        settings = get_settings()
        _client = redis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=2,
            health_check_interval=30,
        )
    return _client


async def redis_ping() -> bool:
    try:
        return bool(await get_redis().ping())
    except Exception:
        return False


async def close_redis() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


# Nomes de filas reservados para fase 2 (SMTP / jobs)
QUEUE_EMAIL = "access:queue:email"
QUEUE_AUDIT = "access:queue:audit"


async def enqueue_job(queue: str, payload: str) -> int:
    """Enfileira job JSON/string. Retorna comprimento da fila."""
    return int(await get_redis().rpush(queue, payload))
