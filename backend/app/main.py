from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, ORJSONResponse

from app.config import get_settings
from app.routers import audit, offboarding, onboarding, requests, settings, users

settings_cfg = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield


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
app.include_router(audit.router, prefix=api)
app.include_router(settings.router, prefix=api)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "env": settings_cfg.app_env}


@app.exception_handler(ValueError)
async def value_error_handler(_request: Request, exc: ValueError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"detail": str(exc)})
