"""Aplica scripts SQL de schema (001_ddl + 002_integration) no DATABASE_URL."""
from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib.parse import unquote, urlparse

import psycopg2
from dotenv import load_dotenv

BACKEND_ROOT = Path(__file__).resolve().parents[1]
SQL_FILES = [
    BACKEND_ROOT / "sql" / "001_ddl.sql",
    BACKEND_ROOT / "sql" / "002_integration.sql",
]


def load_database_url() -> str:
    load_dotenv(BACKEND_ROOT / ".env")
    url = os.getenv("DATABASE_URL")
    if not url:
        print("DATABASE_URL não encontrado em backend/.env", file=sys.stderr)
        sys.exit(1)
    return url


def connect_from_url(url: str):
    normalized = url.replace("postgresql+asyncpg://", "postgresql://", 1)
    parsed = urlparse(normalized)
    return psycopg2.connect(
        host=parsed.hostname,
        port=parsed.port or 5432,
        dbname=parsed.path.lstrip("/"),
        user=unquote(parsed.username or ""),
        password=unquote(parsed.password or ""),
        connect_timeout=15,
    )


def main() -> None:
    url = load_database_url()
    conn = connect_from_url(url)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            for sql_path in SQL_FILES:
                print(f"Aplicando {sql_path.name}...")
                cur.execute(sql_path.read_text(encoding="utf-8"))
                print(f"  OK — {sql_path.name}")

            cur.execute(
                """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                ORDER BY table_name
                """
            )
            tables = [row[0] for row in cur.fetchall()]
            print("Tabelas:", ", ".join(tables))
    finally:
        conn.close()


if __name__ == "__main__":
    main()
