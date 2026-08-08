"""Cliente da API REST do GLPI (apirest.php / api.php/v1)."""

from __future__ import annotations

import base64
import logging
from typing import Any

import httpx

from app.config import Settings, get_settings
from app.models.offboarding import OffboardingRequest
from app.models.onboarding import OnboardingRequest

logger = logging.getLogger(__name__)


def _normalize_base(url: str) -> str:
    u = (url or "").strip().rstrip("/")
    # Preferência: apirest.php (API clássica do GLPI)
    if u.endswith("/api.php/v1"):
        # Mantém o que o admin configurou; também tentamos apirest no client
        return u
    if u.endswith("/apirest.php"):
        return u
    if "/apirest.php" in u or "/api.php/" in u:
        return u
    return u


def _candidate_bases(settings: Settings) -> list[str]:
    raw = _normalize_base(settings.glpi_api_url)
    if not raw:
        return []
    bases = [raw]
    # Se apontou api.php/v1, tenta também apirest.php (mais comum)
    if raw.endswith("/api.php/v1"):
        root = raw[: -len("/api.php/v1")]
        bases.append(f"{root}/apirest.php")
    elif raw.endswith("/apirest.php"):
        root = raw[: -len("/apirest.php")]
        bases.append(f"{root}/api.php/v1")
    # unique preserve order
    out: list[str] = []
    for b in bases:
        if b and b not in out:
            out.append(b)
    return out


class GlpiApiError(Exception):
    def __init__(self, message: str, *, status_code: int | None = None, payload: Any = None):
        super().__init__(message)
        self.status_code = status_code
        self.payload = payload


async def _init_session(client: httpx.AsyncClient, base: str, settings: Settings) -> str:
    app_token = (settings.glpi_app_token or "").strip()
    if not app_token:
        raise GlpiApiError("GLPI_APP_TOKEN não configurado")

    headers: dict[str, str] = {
        "App-Token": app_token,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    user_token = (settings.glpi_user_token or "").strip()
    login = (settings.glpi_api_user or "").strip()
    password = (settings.glpi_api_password or "").strip()

    url = f"{base.rstrip('/')}/initSession"
    # api.php/v1 às vezes usa /Session
    urls = [url]
    if base.rstrip("/").endswith("/api.php/v1"):
        urls.append(f"{base.rstrip('/')}/Session")

    last_err: Exception | None = None
    for endpoint in urls:
        try:
            if user_token:
                headers_auth = {**headers, "Authorization": f"user_token {user_token}"}
                resp = await client.get(endpoint, headers=headers_auth)
            elif login and password:
                basic = base64.b64encode(f"{login}:{password}".encode()).decode()
                headers_auth = {**headers, "Authorization": f"Basic {basic}"}
                resp = await client.get(endpoint, headers=headers_auth)
                if resp.status_code >= 400:
                    # fallback POST JSON
                    resp = await client.post(
                        endpoint,
                        headers=headers,
                        json={"login": login, "password": password},
                    )
            else:
                raise GlpiApiError("Configure GLPI_USER_TOKEN ou GLPI_API_USER + GLPI_API_PASSWORD")

            if resp.status_code >= 400:
                last_err = GlpiApiError(
                    f"initSession falhou ({resp.status_code}): {resp.text[:300]}",
                    status_code=resp.status_code,
                    payload=resp.text,
                )
                continue
            data = resp.json()
            token = data.get("session_token") or data.get("sessionToken") or data.get("token")
            if not token:
                last_err = GlpiApiError(f"initSession sem session_token: {data}")
                continue
            return str(token)
        except GlpiApiError as exc:
            last_err = exc
        except Exception as exc:  # noqa: BLE001
            last_err = GlpiApiError(str(exc))
    raise last_err or GlpiApiError("Falha ao iniciar sessão GLPI")


async def _kill_session(client: httpx.AsyncClient, base: str, settings: Settings, session_token: str) -> None:
    app_token = (settings.glpi_app_token or "").strip()
    headers = {
        "App-Token": app_token,
        "Session-Token": session_token,
        "Content-Type": "application/json",
    }
    for path in ("killSession", "Session"):
        try:
            url = f"{base.rstrip('/')}/{path}"
            if path == "Session":
                await client.delete(url, headers=headers)
            else:
                await client.get(url, headers=headers)
            return
        except Exception:  # noqa: BLE001
            continue


def build_ticket_payload_from_snapshot(
    snap: Any,
    *,
    entity_id: int | None,
) -> dict[str, Any]:
    """snap: GlpiTicketSnapshot (evita import circular tipando como Any)."""
    if snap.kind == "onboarding":
        name = f"[PORTAL:{snap.portal_id}] Onboarding — {snap.employee_name}"
        content = f"""Abertura automática — Portal TI diRoma

Marcador: [PORTAL:{snap.portal_id}]
ID Portal: {snap.portal_id}
Tipo: Onboarding
Colaborador: {snap.employee_name}
CPF: {snap.cpf}
E-mail pessoal: {snap.personal_email}
Cargo: {snap.position}
Departamento: {snap.department}
Gestor: {snap.manager}
Data início: {snap.start_date}
Modalidade: {snap.work_mode}
Unidade: {snap.unit_location or "—"}
Hardware: {snap.hardware_profile}
Crachá: {"Sim" if snap.requires_badge else "Não"}
Fila: {snap.assigned_queue or "Service Desk N1"}
Solicitante: {snap.requester_email or "—"}
"""
    elif snap.kind == "offboarding":
        term = snap.termination_datetime.isoformat() if snap.termination_datetime else "—"
        name = f"[PORTAL:{snap.portal_id}] Offboarding — {snap.employee_name}"
        content = f"""Abertura automática — Portal TI diRoma

Marcador: [PORTAL:{snap.portal_id}]
ID Portal: {snap.portal_id}
Tipo: Offboarding
Colaborador: {snap.employee_name}
E-mail corporativo: {snap.corp_email}
Gestor: {snap.manager}
Desligamento: {term}
Redirecionamento e-mail: {"Sim" if snap.redirect_email else "Não"}
Transferência arquivos: {"Sim" if snap.transfer_files else "Não"}
Devolução: {snap.return_method}
Prazo devolução: {snap.return_deadline or "—"}
Fila: {snap.assigned_queue or "Service Desk N1"}
Solicitante: {snap.requester_email or "—"}
"""
    else:
        raise GlpiApiError("Tipo de chamado inválido")

    input_data: dict[str, Any] = {
        "name": name,
        "content": content,
        "type": 2,  # Request
        "urgency": 3,
        "impact": 3,
        "priority": 3,
        "status": 1,  # New
    }
    if entity_id is not None and entity_id >= 0:
        input_data["entities_id"] = entity_id
    return {"input": input_data}


def build_ticket_payload(
    row: OnboardingRequest | OffboardingRequest,
    *,
    kind: str,
    entity_id: int | None,
) -> dict[str, Any]:
    from app.services.glpi_notify import snapshot_from_row

    return build_ticket_payload_from_snapshot(
        snapshot_from_row(row, kind=kind),
        entity_id=entity_id,
    )


async def find_glpi_ticket_by_portal_id(
    client: httpx.AsyncClient,
    *,
    base: str,
    headers: dict[str, str],
    portal_id: str,
) -> str | None:
    """Busca chamado já aberto com marcador [PORTAL:ID] (evita duplicar)."""
    marker = f"[PORTAL:{portal_id}]"
    # field 1 = name (título) na API clássica do GLPI
    params = {
        "criteria[0][field]": "1",
        "criteria[0][searchtype]": "contains",
        "criteria[0][value]": marker,
        "forcedisplay[0]": "2",  # id
        "range": "0-5",
    }
    urls = [
        f"{base.rstrip('/')}/search/Ticket",
        f"{base.rstrip('/')}/search/Ticket/",
    ]
    for url in urls:
        try:
            resp = await client.get(url, headers=headers, params=params)
            if resp.status_code >= 400:
                continue
            data = resp.json()
            # formatos: {"data":[{"2":123},...], "totalcount":N} ou lista
            rows = data.get("data") if isinstance(data, dict) else data
            if not rows:
                return None
            first = rows[0] if isinstance(rows, list) else None
            if isinstance(first, dict):
                tid = first.get("2") or first.get("id") or first.get("2".strip())
                if tid is not None:
                    return str(tid)
            elif first is not None:
                return str(first)
        except Exception as exc:  # noqa: BLE001
            logger.debug("Busca GLPI por portal_id falhou em %s: %s", url, exc)
    return None


async def create_glpi_ticket_from_snapshot(
    snap: Any,
    *,
    settings: Settings | None = None,
) -> dict[str, Any]:
    """Cria ticket no GLPI a partir de snapshot plano (sem ORM). Idempotente por [PORTAL:ID]."""
    cfg = settings or get_settings()
    if not cfg.glpi_api_configured:
        return {"ok": False, "status": "skipped", "reason": "GLPI API não configurada"}

    try:
        payload = build_ticket_payload_from_snapshot(snap, entity_id=cfg.glpi_entity_id)
        portal_id = str(snap.portal_id)
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "status": "failed", "error": f"Payload GLPI: {exc}"}

    bases = _candidate_bases(cfg)
    last_error = ""

    async with httpx.AsyncClient(timeout=30.0, verify=True, follow_redirects=True) as client:
        for base in bases:
            session_token: str | None = None
            try:
                session_token = await _init_session(client, base, cfg)
                headers = {
                    "App-Token": cfg.glpi_app_token.strip(),
                    "Session-Token": session_token,
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                }

                existing = await find_glpi_ticket_by_portal_id(
                    client, base=base, headers=headers, portal_id=portal_id
                )
                if existing:
                    logger.info(
                        "GLPI já tinha ticket %s para %s — não duplica",
                        existing,
                        portal_id,
                    )
                    return {
                        "ok": True,
                        "status": "already_exists",
                        "glpiTicketNumber": existing,
                        "portalTicketId": portal_id,
                        "apiBase": base,
                    }

                ticket_urls = [
                    f"{base.rstrip('/')}/Ticket",
                    f"{base.rstrip('/')}/Ticket/",
                    f"{base.rstrip('/')}/tickets",
                ]
                resp = None
                for turl in ticket_urls:
                    resp = await client.post(turl, headers=headers, json=payload)
                    if resp.status_code < 500 and resp.status_code != 404:
                        break
                assert resp is not None
                if resp.status_code >= 400:
                    last_error = f"{base}: {resp.status_code} {resp.text[:300]}"
                    logger.warning("GLPI create ticket falhou: %s", last_error)
                    continue

                data = resp.json()
                ticket_id = None
                if isinstance(data, dict):
                    ticket_id = data.get("id") or (data.get("data") or {}).get("id")
                elif isinstance(data, list) and data:
                    ticket_id = data[0].get("id") if isinstance(data[0], dict) else data[0]
                if ticket_id is None:
                    last_error = f"Resposta sem id: {data}"
                    continue

                logger.info("GLPI ticket criado %s para %s via %s", ticket_id, portal_id, base)
                return {
                    "ok": True,
                    "status": "created",
                    "glpiTicketNumber": str(ticket_id),
                    "portalTicketId": portal_id,
                    "apiBase": base,
                }
            except Exception as exc:  # noqa: BLE001
                last_error = f"{base}: {exc}"
                logger.warning("GLPI API erro em %s: %s", base, exc)
            finally:
                if session_token:
                    await _kill_session(client, base, cfg, session_token)

    return {"ok": False, "status": "failed", "error": last_error or "Falha desconhecida na API GLPI"}


async def create_glpi_ticket(
    row: OnboardingRequest | OffboardingRequest,
    *,
    kind: str,
    settings: Settings | None = None,
) -> dict[str, Any]:
    from app.services.glpi_notify import snapshot_from_row

    return await create_glpi_ticket_from_snapshot(
        snapshot_from_row(row, kind=kind),
        settings=settings,
    )


async def ping_glpi_api(settings: Settings | None = None) -> dict[str, Any]:
    cfg = settings or get_settings()
    if not cfg.glpi_api_configured:
        return {"ok": False, "configured": False, "error": "GLPI_API_* não configurado"}
    bases = _candidate_bases(cfg)
    last_error = "initSession falhou"
    async with httpx.AsyncClient(timeout=20.0, verify=True, follow_redirects=True) as client:
        for base in bases:
            session_token = None
            try:
                session_token = await _init_session(client, base, cfg)
                return {"ok": True, "configured": True, "apiBase": base, "session": True}
            except Exception as exc:  # noqa: BLE001
                last_error = f"{base}: {exc}"
            finally:
                if session_token:
                    await _kill_session(client, base, cfg, session_token)
        return {"ok": False, "configured": True, "error": last_error}
