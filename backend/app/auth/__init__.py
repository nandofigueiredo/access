from app.auth.entra import get_current_user
from app.auth.access import (
    ROLES_ADMIN_ONLY,
    ROLES_CREATE_OFFBOARDING,
    ROLES_CREATE_ONBOARDING,
    ROLES_DELETE_TICKETS,
    ROLES_OPERATE_TICKETS,
    assert_ticket_visible,
    require_roles,
    sanitize_settings_value_for_role,
    sees_all_tickets,
    ticket_visible_to,
)

__all__ = [
    "get_current_user",
    "require_roles",
    "ticket_visible_to",
    "assert_ticket_visible",
    "sees_all_tickets",
    "sanitize_settings_value_for_role",
    "ROLES_ADMIN_ONLY",
    "ROLES_CREATE_ONBOARDING",
    "ROLES_CREATE_OFFBOARDING",
    "ROLES_OPERATE_TICKETS",
    "ROLES_DELETE_TICKETS",
]
