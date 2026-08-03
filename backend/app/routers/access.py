"""Checagem de acesso ao portal (cadastro em Usuários & Perfis)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.entra import (
    _decode_entra_token,
    _domain_allowed,
    _extract_email,
    _role_from_portal_catalog,
)
from app.config import Settings, get_settings
from app.database import get_db

router = APIRouter(prefix="/access", tags=["Access"])
_bearer = HTTPBearer(auto_error=False)


class AccessStatusOut(BaseModel):
    email: str
    allowed: bool
    role: str | None = None
    reason: str | None = None


def _fixed_admin(email: str, settings: Settings) -> bool:
    normalized = email.strip().lower()
    admin_emails = {
        e.strip().lower()
        for e in (settings.admin_emails or "").split(",")
        if e.strip()
    }
    admin_emails.add("luis.figueiredo@diroma.com.br")
    admin_emails.add("n3.admin@diroma.com.br")
    return normalized in admin_emails


@router.get("/status", response_model=AccessStatusOut)
async def access_status(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    x_portal_email: str | None = Header(default=None, alias="X-Portal-Email"),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> AccessStatusOut:
    """
    Indica se o e-mail pode usar o portal.
    - Com Entra: usa o e-mail do token.
    - Com AUTH_DISABLED: usa header X-Portal-Email (fluxo do front pós-MSAL).
    """
    email: str | None = None

    if settings.auth_disabled:
        email = (x_portal_email or settings.demo_user_email or "").strip().lower()
        if not email or "@" not in email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Informe X-Portal-Email com a conta Microsoft que tentou entrar.",
            )
    else:
        if credentials is None or credentials.scheme.lower() != "bearer":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authorization: Bearer <token> obrigatório.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        claims: dict[str, Any] = _decode_entra_token(credentials.credentials, settings)
        email = _extract_email(claims)
        if not email:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token sem e-mail.")
        if not _domain_allowed(email, settings):
            return AccessStatusOut(
                email=email,
                allowed=False,
                reason=f"Domínio não autorizado. Use @{', '.join(settings.allowed_domains)}.",
            )

    assert email is not None
    if _fixed_admin(email, settings):
        return AccessStatusOut(email=email, allowed=True, role="admin")

    catalog_role, catalog_seeded = await _role_from_portal_catalog(db, email)
    if not catalog_seeded:
        # Sem operadores no catálogo: só admin fixo (já tratado acima)
        return AccessStatusOut(
            email=email,
            allowed=False,
            reason="Nenhum operador cadastrado ainda. Peça a um Admin N3 para liberar o acesso.",
        )

    if catalog_role is None:
        return AccessStatusOut(
            email=email,
            allowed=False,
            reason=(
                f'"{email}" não está cadastrado em Administração → Usuários & Perfis. '
                "Peça a um Admin N3 para liberar o acesso."
            ),
        )

    return AccessStatusOut(email=email, allowed=True, role=catalog_role)
