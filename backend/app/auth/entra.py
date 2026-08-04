"""Validação de JWT emitido pelo Microsoft Entra ID (Azure AD)."""

from __future__ import annotations

from typing import Any

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.database import get_db
from app.models.settings import AppSetting
from app.models.user import User

_bearer = HTTPBearer(auto_error=False)
_jwks_clients: dict[str, PyJWKClient] = {}


def _get_jwks_client(settings: Settings) -> PyJWKClient:
    uri = settings.jwks_uri
    if uri not in _jwks_clients:
        _jwks_clients[uri] = PyJWKClient(uri, cache_keys=True, lifespan=3600)
    return _jwks_clients[uri]


def _extract_email(claims: dict[str, Any]) -> str | None:
    for key in ("preferred_username", "email", "upn"):
        value = claims.get(key)
        if isinstance(value, str) and "@" in value:
            return value.strip().lower()
    emails = claims.get("emails")
    if isinstance(emails, list) and emails:
        return str(emails[0]).strip().lower()
    return None


def _domain_allowed(email: str, settings: Settings) -> bool:
    domain = email.split("@")[-1].lower()
    return domain in settings.allowed_domains


def _lookup_catalog_role(catalog: dict[str, Any] | None, email: str) -> str | None:
    """Papel cadastrado em Administração → Usuários & Perfis (settings.catalog)."""
    if not catalog or not isinstance(catalog, dict):
        return None
    users = catalog.get("users")
    if not isinstance(users, list):
        return None
    normalized = email.strip().lower()
    valid = {"admin", "ti", "rh", "gestor", "viewer"}
    for row in users:
        if not isinstance(row, dict):
            continue
        if row.get("active") is False:
            continue
        meta = row.get("meta") if isinstance(row.get("meta"), dict) else {}
        mail = str(meta.get("email") or "").strip().lower()
        name = str(row.get("name") or "").strip().lower()
        if mail != normalized and name != normalized:
            continue
        role = str(meta.get("role") or "").strip().lower()
        if role in valid:
            return role
        return "viewer"
    return None


async def _role_from_portal_catalog(db: AsyncSession, email: str) -> tuple[str | None, bool]:
    """
    Retorna (papel|None, catálogo_tem_usuários).
    Se o catálogo já tem operadores, ausência no cadastro = sem acesso.
    """
    result = await db.execute(select(AppSetting).where(AppSetting.key == "catalog"))
    row = result.scalar_one_or_none()
    if not row or not isinstance(row.value, dict):
        return None, False
    users = row.value.get("users")
    has_users = isinstance(users, list) and len(users) > 0
    if not has_users:
        return None, False
    return _lookup_catalog_role(row.value, email), True


def _resolve_role(email: str, claims: dict[str, Any], catalog_role: str | None = None) -> str:
    """Resolve papel: admin fixo → catálogo → claims Entra → viewer (sem heurística de prefixo)."""
    normalized = email.strip().lower()
    admin_emails = {
        e.strip().lower()
        for e in (get_settings().admin_emails or "").split(",")
        if e.strip()
    }
    admin_emails.add("luis.figueiredo@diroma.com.br")
    admin_emails.add("n3.admin@diroma.com.br")

    if normalized in admin_emails:
        return "admin"

    if catalog_role in {"admin", "ti", "rh", "gestor", "viewer"}:
        return catalog_role

    roles = claims.get("roles") or []
    if isinstance(roles, list):
        lowered = {str(r).lower() for r in roles}
        if "admin" in lowered or "n3" in lowered:
            return "admin"
        for candidate in ("ti", "rh", "gestor", "viewer"):
            if candidate in lowered:
                return candidate
        if "service_desk" in lowered or "servicedesk" in lowered:
            return "ti"

    return "viewer"


def _decode_entra_token(token: str, settings: Settings) -> dict[str, Any]:
    if not settings.azure_client_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AZURE_CLIENT_ID não configurado no backend.",
        )

    try:
        signing_key = _get_jwks_client(settings).get_signing_key_from_jwt(token)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Não foi possível obter a chave JWKS: {exc}",
        ) from exc

    audiences = settings.audiences or [settings.azure_client_id]
    last_error: Exception | None = None

    for issuer in settings.issuer_candidates:
        for audience in audiences:
            try:
                return jwt.decode(
                    token,
                    signing_key.key,
                    algorithms=["RS256"],
                    audience=audience,
                    issuer=issuer,
                    options={"verify_at_hash": False},
                )
            except jwt.exceptions.InvalidTokenError as exc:
                last_error = exc
                continue

    # Multi-tenant / issuer flexível: valida assinatura + audience
    for audience in audiences:
        try:
            return jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                audience=audience,
                options={"verify_iss": False, "verify_at_hash": False},
            )
        except jwt.exceptions.InvalidTokenError as exc:
            last_error = exc
            continue

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=f"Falha na validação do token Entra ID: {last_error}",
    )


async def get_or_create_user(
    db: AsyncSession,
    *,
    email: str,
    name: str,
    role: str,
    entra_oid: str | None,
) -> User:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user:
        changed = False
        if name and user.name != name:
            user.name = name
            changed = True
        if entra_oid and user.entra_oid != entra_oid:
            user.entra_oid = entra_oid
            changed = True
        if role and user.role != role:
            user.role = role
            changed = True
        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuário desativado.")
        if changed:
            await db.flush()
        return user

    user = User(
        name=name or email,
        email=email,
        role=role,
        entra_oid=entra_oid,
    )
    db.add(user)
    await db.flush()
    return user


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> User:
    if settings.auth_disabled:
        return await get_or_create_user(
            db,
            email=settings.demo_user_email.lower(),
            name=settings.demo_user_name,
            role=settings.demo_user_role,
            entra_oid="demo-local",
        )

    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization: Bearer <token> obrigatório.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    claims = _decode_entra_token(credentials.credentials, settings)
    email = _extract_email(claims)
    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token sem e-mail identificável.")

    if not _domain_allowed(email, settings):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Acesso restrito a domínios corporativos: {', '.join(settings.allowed_domains)}",
        )

    name = claims.get("name") or email
    oid = claims.get("oid") or claims.get("sub")
    catalog_role, catalog_seeded = await _role_from_portal_catalog(db, email)

    normalized = email.strip().lower()
    admin_emails = {
        e.strip().lower()
        for e in (settings.admin_emails or "").split(",")
        if e.strip()
    }
    admin_emails.add("luis.figueiredo@diroma.com.br")
    admin_emails.add("n3.admin@diroma.com.br")
    is_fixed = normalized in admin_emails

    if catalog_seeded and catalog_role is None and not is_fixed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f'"{email}" não está cadastrado em Administração → Usuários & Perfis. '
                "Peça a um Admin N3 para liberar o acesso."
            ),
        )

    role = _resolve_role(email, claims, catalog_role)

    return await get_or_create_user(
        db,
        email=email,
        name=str(name),
        role=role,
        entra_oid=str(oid) if oid else None,
    )
