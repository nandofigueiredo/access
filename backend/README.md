# Portal TI — Onboarding & Offboarding API (FastAPI + PostgreSQL)

API REST para o frontend React do repositório `nandofigueiredo/onboardingdiroma`.

## Stack

- **Python 3.12 + FastAPI** (async, OpenAPI em `/docs`)
- **PostgreSQL 16** + SQLAlchemy 2.0 (asyncpg)
- **Microsoft Entra ID** — validação JWT (JWKS / RS256)
- Auditoria imutável em `audit_logs` + sanitização LGPD

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/v1/onboarding` | Cria chamado de onboarding |
| GET | `/api/v1/onboarding` | Lista (`?status=` `&departamento=`) |
| DELETE | `/api/v1/onboarding/{id}` | Exclui (com audit log) |
| POST | `/api/v1/offboarding` | Cria chamado de offboarding |
| GET | `/api/v1/offboarding` | Lista (`?status=`) |
| DELETE | `/api/v1/offboarding/{id}` | Exclui (com audit log) |
| PATCH | `/api/v1/requests/{id}/status` | Atualiza status / checklist TI |
| GET | `/api/v1/users/me` | Perfil do usuário autenticado |
| GET | `/health` | Healthcheck |

## Subir rápido (Docker)

Na raiz do repositório:

```bash
cp backend/.env.example backend/.env
docker compose up -d --build
```

- API: http://localhost:8000/docs  
- Postgres: `localhost:5432` (user/pass/db: `portal_ti`)

O DDL em `sql/001_ddl.sql` é aplicado automaticamente no first boot do container Postgres.

## Subir local (sem Docker da API)

```bash
# 1) Banco
docker compose up -d db

# 2) Python
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
# source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env

# 3) API
uvicorn app.main:app --reload --port 8000
```

## Autenticação

Header obrigatório (exceto com `AUTH_DISABLED=true`):

```http
Authorization: Bearer <access_token|id_token Entra ID>
```

O middleware:

1. Valida assinatura via JWKS do tenant
2. Confere `aud` (Client ID / audiences configuradas)
3. Exige e-mail de domínio corporativo (`CORPORATE_EMAIL_DOMAINS`)
4. Faz upsert do usuário em `users`

Guia completo Azure + `.env` + `authConfig.js`: ver **[SETUP.md](../SETUP.md)** na raiz.
