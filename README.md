# Portal TI — Onboarding & Offboarding (Di Roma)

Frontend React (Vite + MSAL) + Backend FastAPI + PostgreSQL + Redis.

## Estrutura

```
onboardingdiroma/
├── src/                 # Frontend React
│   ├── api/client.ts    # Cliente HTTP da API
│   └── auth/authConfig.js
├── backend/             # API FastAPI
│   ├── app/
│   └── sql/001_ddl.sql
├── deploy/              # nginx + .env.docker.example
├── docker-compose.yml   # Postgres + Redis + API + Web
├── Dockerfile.web
├── DOCKER.md            # docker run / compose + parecer Worker
└── SETUP.md             # Guia Azure + .env + MSAL
```

## Documentação

- **[DOCKER.md](DOCKER.md)** — subir no servidor (`docker run` e Compose), Redis, Worker
- **[SETUP.md](SETUP.md)** — Azure Entra ID, `.env`, `authConfig.js`
- **[backend/README.md](backend/README.md)** — API, endpoints

## Quick start (local)

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

## Servidor (containers)

Nginx do **host** na frente. Só clone + `.env`:

```bash
git clone https://github.com/nandofigueiredo/access.git && cd access
cp .env.example .env   # edite DATABASE_URL, Azure, CORS
docker compose up -d --build
# front :8080 · api :8000 · redis :6379
# configure proxy no nginx: deploy/nginx-host.conf.example
```

Detalhes e `docker run`: **[DOCKER.md](DOCKER.md)**.

Swagger: http://localhost:8000/docs  
App: http://localhost:3000
