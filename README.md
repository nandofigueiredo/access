# Portal TI — Onboarding & Offboarding (Di Roma)

Frontend React (Vite + MSAL) + Backend FastAPI + PostgreSQL.

## Estrutura

```
onboardingdiroma/
├── src/                 # Frontend React
│   ├── api/client.ts    # Cliente HTTP da API
│   └── auth/authConfig.js
├── backend/             # API FastAPI
│   ├── app/
│   └── sql/001_ddl.sql
├── docker-compose.yml
└── SETUP.md             # Guia Azure + .env + MSAL
```

## Documentação

- **[SETUP.md](SETUP.md)** — Azure Entra ID, `.env`, `authConfig.js`
- **[backend/README.md](backend/README.md)** — API, endpoints, Docker

## Quick start

```bash
# API (com AUTH_DISABLED=true para DEV)
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
# Suba o Postgres e aplique backend/sql/001_ddl.sql
uvicorn app.main:app --reload --port 8000

# Frontend
cd ..
npm install
npm run dev
```

Swagger: http://localhost:8000/docs  
App: http://localhost:3000
