from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exception_handlers import http_exception_handler
from fastapi.exceptions import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, ORJSONResponse

from app.config import get_settings
from app.redis_client import close_redis, redis_ping
from app.routers import access, audit, offboarding, onboarding, requests, settings, users

settings_cfg = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield
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
    }


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    if isinstance(exc, HTTPException):
        return await http_exception_handler(request, exc)

    import traceback

    traceback.print_exc()
    detail = str(exc) if settings_cfg.debug else "Erro interno do servidor."
    msg = str(exc).lower()
    if "workflow" in msg or "app_settings" in msg or "undefinedcolumn" in msg or "does not exist" in msg:
        detail = (
            "Schema do banco desatualizado. Aplique backend/sql/002_integration.sql "
            f"(coluna/tabela ausente). Detalhe: {exc}"
        )
    return JSONResponse(status_code=500, content={"detail": detail})


@app.exception_handler(ValueError)
async def value_error_handler(_request: Request, exc: ValueError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"detail": str(exc)})
