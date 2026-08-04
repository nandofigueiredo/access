"""ACL e escopo de chamados por papel do portal."""

from __future__ import annotations

from typing import Any, Iterable

from fastapi import HTTPException, status

from app.models.user import User

ROLE_ADMIN = "admin"
ROLE_TI = "ti"
ROLE_RH = "rh"
ROLE_GESTOR = "gestor"
ROLE_VIEWER = "viewer"

ROLES_SEE_ALL = frozenset({ROLE_ADMIN, ROLE_TI, ROLE_RH})
ROLES_CREATE_ONBOARDING = frozenset({ROLE_ADMIN, ROLE_RH, ROLE_GESTOR})
ROLES_CREATE_OFFBOARDING = frozenset({ROLE_ADMIN, ROLE_RH})
ROLES_OPERATE_TICKETS = frozenset({ROLE_ADMIN, ROLE_TI})
ROLES_DELETE_TICKETS = frozenset({ROLE_ADMIN, ROLE_TI})
ROLES_ADMIN_ONLY = frozenset({ROLE_ADMIN})


def require_roles(user: User, allowed: Iterable[str], *, detail: str = "Sem permissão.") -> None:
    if (user.role or "").strip().lower() not in {r.lower() for r in allowed}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


def sees_all_tickets(user: User) -> bool:
    return (user.role or "").strip().lower() in ROLES_SEE_ALL


def ticket_visible_to(
    user: User,
    *,
    requester_email: str | None,
    manager: str | None,
) -> bool:
    """Regras: admin/ti/rh = todos; gestor = solicitante ou nome no gestor; viewer = solicitante."""
    role = (user.role or "").strip().lower()
    if role in ROLES_SEE_ALL:
        return True

    email = (user.email or "").strip().lower()
    requester = (requester_email or "").strip().lower()

    if role == ROLE_VIEWER:
        return bool(email) and requester == email

    if role == ROLE_GESTOR:
        if email and requester == email:
            return True
        name = (user.name or "").strip().lower()
        mgr = (manager or "").strip().lower()
        return bool(name) and bool(mgr) and name in mgr

    return False


def assert_ticket_visible(
    user: User,
    *,
    requester_email: str | None,
    manager: str | None,
) -> None:
    if not ticket_visible_to(user, requester_email=requester_email, manager=manager):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chamado não encontrado.")


def sanitize_settings_value_for_role(key: str, value: dict[str, Any], user: User) -> dict[str, Any]:
    """Remove segredos SMTP para quem não é admin. Catálogo (users) permanece — necessário ao portal."""
    role = (user.role or "").strip().lower()
    out = dict(value or {})
    if key == "smtp" and role != ROLE_ADMIN:
        for secret in ("password", "pass", "secret", "apiKey", "api_key", "token"):
            if secret in out:
                out[secret] = ""
    return out
