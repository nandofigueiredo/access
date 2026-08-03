# Access diRoma no servidor (nginx JÁ EXISTE)

Fluxo: **clone do Git → edita `.env` → sobe containers**.  
O nginx do host só faz proxy para `8080` (front) e `8000` (API).

---

## 1) Subir (recomendado)

```bash
git clone https://github.com/nandofigueiredo/access.git
cd access
cp .env.example .env
nano .env          # DATABASE_URL, Azure, CORS_ORIGINS, VITE_*

docker compose up -d --build
```

Containers: `access-redis`, `access-api`, `access-web`.

Se quiser Postgres **dentro** do Docker (além/em vez do externo):

```bash
# no .env use:
# DATABASE_URL=postgresql+asyncpg://portal_ti:SENHA@access-postgres:5432/portal_ti
docker compose --profile with-db up -d --build
```

---

## 2) Seu nginx (host)

Use o exemplo `deploy/nginx-host.conf.example`:

- `/`     → `127.0.0.1:8081` (front) — **não use 8080** se Vaultwarden já estiver nela
- `/api/` → `127.0.0.1:8000` (API)

```bash
sudo cp deploy/nginx-host.conf.example /etc/nginx/sites-available/access
# ajuste server_name
sudo ln -s /etc/nginx/sites-available/access /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

## 3) docker run (sem compose)

```bash
git clone https://github.com/nandofigueiredo/access.git && cd access
cp .env.example .env && nano .env

docker network create access_net
docker volume create access_redis

docker build -t access-api:latest ./backend
docker build -t access-web:latest -f Dockerfile.web \
  --build-arg VITE_API_BASE_URL=/api/v1 \
  --build-arg VITE_AZURE_CLIENT_ID="$(grep VITE_AZURE_CLIENT_ID .env | cut -d= -f2-)" \
  --build-arg VITE_AZURE_TENANT_ID="$(grep VITE_AZURE_TENANT_ID .env | cut -d= -f2-)" \
  --build-arg VITE_AZURE_REDIRECT_URI="$(grep VITE_AZURE_REDIRECT_URI .env | cut -d= -f2-)" \
  --build-arg VITE_AZURE_API_SCOPE="$(grep VITE_AZURE_API_SCOPE .env | cut -d= -f2-)" \
  --build-arg VITE_ENABLE_DEMO_LOGIN=false \
  .

docker run -d --name access-redis --network access_net --restart unless-stopped \
  -v access_redis:/data -p 6379:6379 \
  redis:7-alpine redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru

# Carrega variáveis do .env (--env-file). REDIS_URL deve ser redis://access-redis:6379/0
docker run -d --name access-api --network access_net --restart unless-stopped \
  --env-file .env \
  -e REDIS_URL=redis://access-redis:6379/0 \
  -p 8000:8000 \
  access-api:latest

docker run -d --name access-web --network access_net --restart unless-stopped \
  -p 8080:80 \
  access-web:latest
```

Aplique o DDL uma vez no Postgres externo: `backend/sql/001_ddl.sql`.

---

## 4) Checagem

```bash
docker ps
curl -s http://127.0.0.1:8000/health    # redis: up
curl -s http://127.0.0.1:8080/healthz   # ok
```

---

## Worker?

**Não sobe Worker nesta fase.** Redis já vem no stack; Worker só quando SMTP/Graph forem job em fila (ver comentários anteriores no histórico do projeto).
