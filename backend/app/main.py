from contextlib import asynccontextmanager
import asyncio
import logging

from fastapi import FastAPI, Request
from fastapi.exception_handlers import http_exception_handler
from fastapi.exceptions import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, ORJSONResponse

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.redis_client import close_redis, redis_ping
from app.routers import access, audit, offboarding, onboarding, requests, settings, users, webhooks
from app.services.glpi_db import sync_glpi_numbers_from_db

settings_cfg = get_settings()
logger = logging.getLogger(__name__)


async def _glpi_sync_loop(stop: asyncio.Event) -> None:
    """A cada N segundos, tenta vincular nº GLPI via MySQL para chamados sem número."""
    interval = max(30, int(settings_cfg.glpi_db_sync_interval_sec or 60))
    while not stop.is_set():
        try:
            if settings_cfg.glpi_db_configured and settings_cfg.glpi_db_sync_enabled:
                async with AsyncSessionLocal() as session:
                    result = await sync_glpi_numbers_from_db(session)
                    await session.commit()
                    if result.get("linked"):
                        logger.info(
                            "GLPI DB sync: %s vinculado(s) de %s verificados",
                            result.get("linked"),
                            result.get("checked"),
                        )
        except Exception as exc:  # noqa: BLE001
            logger.warning("GLPI DB sync falhou: %s", exc)
        try:
            await asyncio.wait_for(stop.wait(), timeout=interval)
        except asyncio.TimeoutError:
            continue


@asynccontextmanager
async def lifespan(_app: FastAPI):
    stop = asyncio.Event()
    task: asyncio.Task | None = None
    if settings_cfg.glpi_db_configured and settings_cfg.glpi_db_sync_enabled:
        task = asyncio.create_task(_glpi_sync_loop(stop), name="glpi-db-sync")
        logger.info(
            "GLPI DB sync ativo (%s:%s/%s a cada %ss)",
            settings_cfg.glpi_db_host,
            settings_cfg.glpi_db_port,
            settings_cfg.glpi_db_name,
            settings_cfg.glpi_db_sync_interval_sec,
        )
    yield
    stop.set()
    if task:
        await task
    await close_redis()


app = FastAPI(
    title=settings_cfg.app_name,
    version="1.0.0",
    default_response_class=ORJSONResponse,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings_cfg.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = settings_cfg.api_v1_prefix
app.include_router(onboarding.router, prefix=api)
app.include_router(offboarding.router, prefix=api)
app.include_router(requests.router, prefix=api)
app.include_router(users.router, prefix=api)
app.include_router(access.router, prefix=api)
app.include_router(webhooks.router, prefix=api)
app.include_router(audit.router, prefix=api)
app.include_router(settings.router, prefix=api)


@app.get("/health")
async def health() -> dict[str, str]:
    redis_ok = await redis_ping()
    return {
        "status": "ok" if redis_ok else "degraded",
        "env": settings_cfg.app_env,
        "redis": "up" if redis_ok else "down",
        "auth_disabled": str(settings_cfg.auth_disabled).lower(),
        "glpi_db": "configured" if settings_cfg.glpi_db_configured else "off",
        "glpi_api": "configured" if settings_cfg.glpi_api_configured else "off",
    }


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    if isinstance(exc, HTTPException):
        return await http_exception_handler(request, exc)

    import traceback

    traceback.print_exc()
    detail = str(exc)
    msg = detail.lower()
    if "workflow" in msg or "app_settings" in msg or "undefinedcolumn" in msg or "does not exist" in msg:
        detail = (
            "Schema do banco desatualizado. Aplique backend/sql/002_integration.sql "
            f"(coluna/tabela ausente). Detalhe: {exc}"
        )
    elif "stringdatalength" in msg or "value too long" in msg:
        detail = f"Valor excede o tamanho do campo no banco: {exc}"
    # Sempre devolve mensagem útil no toast (não só "Erro interno")
    return JSONResponse(status_code=500, content={"detail": detail[:500]})


@app.exception_handler(ValueError)
async def value_error_handler(_request: Request, exc: ValueError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"detail": str(exc)})
