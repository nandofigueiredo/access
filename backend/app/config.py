from functools import lru_cache
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "Portal TI — Onboarding & Offboarding API"
    app_env: str = "development"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"

    # PostgreSQL
    database_url: str = Field(
        default="postgresql+asyncpg://portal_ti:portal_ti@localhost:5432/portal_ti",
        description="SQLAlchemy async URL",
    )

    # Microsoft Entra ID
    azure_tenant_id: str = "common"
    azure_client_id: str = ""
    azure_allowed_audiences: str = ""  # comma-separated; defaults to client_id
    corporate_email_domains: str = "diroma.com.br"
    admin_emails: str = "luis.figueiredo@diroma.com.br"

    # CORS
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # Auth bypass (somente desenvolvimento local)
    auth_disabled: bool = False
    demo_user_email: str = "luis.figueiredo@diroma.com.br"
    demo_user_name: str = "Luis Figueiredo"
    demo_user_role: str = "admin"

    @field_validator("auth_disabled", mode="before")
    @classmethod
    def parse_bool(cls, v):  # noqa: ANN001
        if isinstance(v, str):
            return v.strip().lower() in {"1", "true", "yes", "on"}
        return bool(v)

    @property
    def allowed_domains(self) -> List[str]:
        return [d.strip().lower() for d in self.corporate_email_domains.split(",") if d.strip()]

    @property
    def cors_origin_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def audiences(self) -> List[str]:
        raw = self.azure_allowed_audiences or self.azure_client_id
        return [a.strip() for a in raw.split(",") if a.strip()]

    @property
    def jwks_uri(self) -> str:
        tenant = self.azure_tenant_id or "common"
        return f"https://login.microsoftonline.com/{tenant}/discovery/v2.0/keys"

    @property
    def issuer_candidates(self) -> List[str]:
        tenant = self.azure_tenant_id or "common"
        return [
            f"https://login.microsoftonline.com/{tenant}/v2.0",
            f"https://sts.windows.net/{tenant}/",
            f"https://login.microsoftonline.com/{tenant}/",
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()
