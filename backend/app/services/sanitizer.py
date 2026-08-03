"""Sanitização LGPD — normaliza e limpa campos sensíveis antes da persistência."""

from __future__ import annotations

import re
import unicodedata
from typing import Any


_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_MULTI_SPACE = re.compile(r"\s+")
_CPF_DIGITS = re.compile(r"\D+")
_HTML_TAGS = re.compile(r"<[^>]+>")


def strip_control(value: str) -> str:
    value = _CONTROL_CHARS.sub("", value)
    value = _HTML_TAGS.sub("", value)
    return _MULTI_SPACE.sub(" ", value).strip()


def sanitize_text(value: str | None, *, max_len: int = 500) -> str | None:
    if value is None:
        return None
    cleaned = strip_control(str(value))
    cleaned = unicodedata.normalize("NFC", cleaned)
    return cleaned[:max_len] if cleaned else None


def sanitize_email(value: str | None) -> str | None:
    cleaned = sanitize_text(value, max_len=320)
    if not cleaned:
        return None
    return cleaned.lower()


def sanitize_cpf(value: str) -> str:
    """Normaliza CPF para máscara 000.000.000-00 (sem armazenar lixo)."""
    digits = _CPF_DIGITS.sub("", value or "")
    if len(digits) != 11:
        raise ValueError("CPF deve conter 11 dígitos.")
    if digits == digits[0] * 11:
        raise ValueError("CPF inválido.")

    def _check(digs: str, weight_start: int) -> int:
        total = sum(int(d) * (weight_start - i) for i, d in enumerate(digs))
        rest = (total * 10) % 11
        return 0 if rest == 10 else rest

    if _check(digits[:9], 10) != int(digits[9]) or _check(digits[:10], 11) != int(digits[10]):
        raise ValueError("CPF inválido.")

    return f"{digits[:3]}.{digits[3:6]}.{digits[6:9]}-{digits[9:]}"


def mask_cpf_for_logs(cpf: str) -> str:
    digits = _CPF_DIGITS.sub("", cpf)
    if len(digits) != 11:
        return "***"
    return f"***.***.{digits[6:9]}-**"


def sanitize_dict(data: dict[str, Any] | None) -> dict[str, Any]:
    if not data:
        return {}
    out: dict[str, Any] = {}
    for key, value in data.items():
        if isinstance(value, str):
            out[key] = sanitize_text(value, max_len=2000)
        elif isinstance(value, dict):
            out[key] = sanitize_dict(value)
        elif isinstance(value, list):
            out[key] = [
                sanitize_dict(v) if isinstance(v, dict) else (sanitize_text(v) if isinstance(v, str) else v)
                for v in value
            ]
        else:
            out[key] = value
    return out


def audit_safe_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Remove/mascara PII sensível em detalhes de auditoria."""
    safe = dict(payload)
    if "cpf" in safe and isinstance(safe["cpf"], str):
        safe["cpf"] = mask_cpf_for_logs(safe["cpf"])
    for key in ("personal_email", "emailPessoal", "personalEmail"):
        if key in safe and isinstance(safe[key], str):
            local, _, domain = safe[key].partition("@")
            safe[key] = f"{local[:2]}***@{domain}" if domain else "***"
    if "address" in safe:
        safe["address"] = "[REDACTED]"
    if "enderecoEntrega" in safe:
        safe["enderecoEntrega"] = "[REDACTED]"
    return safe
