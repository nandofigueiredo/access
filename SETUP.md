# Guia de Configuração — Portal TI (Onboarding / Offboarding)

Este documento cobre: registro no **Microsoft Entra ID**, variáveis `.env` (front + back), e o arquivo **`authConfig.js`** do MSAL.

---

## 1. Registrar o aplicativo no Portal do Azure (Entra ID)

1. Acesse [portal.azure.com](https://portal.azure.com) → **Microsoft Entra ID** → **Registros de aplicativo** → **Novo registro**.
2. Preencha:
   - **Nome:** `Portal TI Onboarding`
   - **Tipos de conta:** *Contas apenas neste diretório organizacional* (single tenant) — ou multi-tenant se necessário.
   - **URI de redirecionamento:** plataforma **SPA**
     - Dev: `http://localhost:3000`
     - Prod: `https://seu-dominio.com`
3. Após criar, anote:
   - **Application (client) ID** → `AZURE_CLIENT_ID` / `VITE_AZURE_CLIENT_ID`
   - **Directory (tenant) ID** → `AZURE_TENANT_ID` / `VITE_AZURE_TENANT_ID`
4. **Autenticação**
   - Em *Plataforma* SPA, confirme os Redirect URIs.
   - Habilite **Tokens de ID** e (se usar) tokens de acesso implícito conforme o fluxo MSAL (recomendado: Authorization Code + PKCE, padrão do `@azure/msal-browser`).
5. **Permissões de API (Microsoft Graph)**
   - Adicione **Delegated**:
     - `openid`
     - `profile`
     - `email`
     - `User.Read`
   - Clique em **Conceder consentimento do administrador** (se a política da empresa exigir).
6. **Expor uma API** (para o backend validar o `access_token`)
   - *Expose an API* → Application ID URI: `api://<CLIENT_ID>`
   - Adicione o scope: `access_as_user` (Admin + Users)
   - Em *Autenticação* / *API permissions*, adicione a permissão delegada `api://<CLIENT_ID>/access_as_user` no próprio app (ou no front).
7. **Manifesto / Token**
   - Garanta que o token contenha `preferred_username` ou `email` (claim de e-mail).
   - Opcional: roles de app (`admin`, `ti`, `rh`, `gestor`) em *App roles* para RBAC.

### Domínio corporativo

Somente e-mails cujo domínio esteja em `CORPORATE_EMAIL_DOMAINS` passam no middleware (ex.: `@empresa.com.br`).

---

## 2. Arquivos `.env`

### Backend — `backend/.env`

```env
APP_NAME="Portal TI — Onboarding & Offboarding API"
APP_ENV=development
DEBUG=true
API_V1_PREFIX=/api/v1

DATABASE_URL=postgresql+asyncpg://portal_ti:portal_ti@localhost:5432/portal_ti

AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_ALLOWED_AUDIENCES=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx,api://xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

CORPORATE_EMAIL_DOMAINS=empresa.com.br,diroma.com.br
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# DEV only — em produção SEMPRE false
AUTH_DISABLED=false
DEMO_USER_EMAIL=ana.souza@empresa.com.br
DEMO_USER_NAME=Ana Paula Souza
DEMO_USER_ROLE=admin
```

### Frontend — `.env` (raiz do Vite)

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1

VITE_AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
VITE_AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
VITE_AZURE_REDIRECT_URI=http://localhost:3000

# Scope da API própria (Expose an API). Em DEV com AUTH_DISABLED pode usar User.Read
VITE_AZURE_API_SCOPE=api://xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx/access_as_user

VITE_ENABLE_DEMO_LOGIN=true
```

> Templates versionados: `backend/.env.example` e `.env.example`.

---

## 3. `authConfig.js` (MSAL no React)

Arquivo: [`src/auth/authConfig.js`](src/auth/authConfig.js)

```javascript
/**
 * authConfig.js — Configuração MSAL (Microsoft Entra ID) para o React.
 */

const clientId = import.meta.env.VITE_AZURE_CLIENT_ID || '00000000-0000-0000-0000-000000000000';
const tenantId = import.meta.env.VITE_AZURE_TENANT_ID || 'common';
const redirectUri = import.meta.env.VITE_AZURE_REDIRECT_URI || window.location.origin;
const apiScope = import.meta.env.VITE_AZURE_API_SCOPE || 'User.Read';

export const msalConfig = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri,
    postLogoutRedirectUri: redirectUri,
    navigateToLoginRequestUrl: true,
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    allowRedirectInIframe: false,
  },
};

export const loginRequest = {
  scopes: ['openid', 'profile', 'email', 'User.Read'],
};

export const apiTokenRequest = {
  scopes: [apiScope],
};

export const graphConfig = {
  graphMeEndpoint: 'https://graph.microsoft.com/v1.0/me',
  graphPhotoEndpoint: 'https://graph.microsoft.com/v1.0/me/photo/$value',
};

export default msalConfig;
```

O front envia o token assim:

```http
Authorization: Bearer <access_token>
```

O cliente HTTP está em `src/api/client.ts`.

---

## 4. Ordem sugerida para subir o projeto

```bash
# Clone (já feito)
# git clone https://github.com/nandofigueiredo/onboardingdiroma.git

# Banco + API
cp backend/.env.example backend/.env
docker compose up -d db
cd backend && python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend (outro terminal, na raiz)
cp .env.example .env
npm install   # ou bun install
npm run dev
```

1. Abra http://localhost:3000  
2. Com `AUTH_DISABLED=true` no backend, o login demo funciona sem Azure.  
3. Swagger: http://localhost:8000/docs  

---

## 5. DDL / Migração

Script SQL: [`backend/sql/001_ddl.sql`](backend/sql/001_ddl.sql)

Tabelas: `users`, `onboarding_requests`, `offboarding_requests`, `audit_logs`.

Aplicação manual:

```bash
psql -U portal_ti -d portal_ti -f backend/sql/001_ddl.sql
```

---

## 6. LGPD e auditoria

- CPF validado e normalizado; mascarado em `audit_logs`.
- Endereço e e-mails sensíveis redigidos nos detalhes de auditoria.
- Toda criação, alteração de status e exclusão grava linha em `audit_logs` (tabela imutável via trigger).
- Textos passam por sanitização (controle de caracteres / HTML / tamanho).
