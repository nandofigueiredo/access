/**
 * authConfig.js — Configuração MSAL (Microsoft Entra ID) para o React.
 *
 * Uso com @azure/msal-browser / @azure/msal-react.
 * Variáveis: VITE_AZURE_CLIENT_ID, VITE_AZURE_TENANT_ID, VITE_AZURE_REDIRECT_URI,
 *            VITE_AZURE_API_SCOPE
 */

const clientId = import.meta.env.VITE_AZURE_CLIENT_ID || '00000000-0000-0000-0000-000000000000';
const tenantId = import.meta.env.VITE_AZURE_TENANT_ID || 'common';
const redirectUri = import.meta.env.VITE_AZURE_REDIRECT_URI || window.location.origin;
/** Escopo da API própria — só use após "Expose an API" no Entra (senão AADSTS500011). */
const rawApiScope = (import.meta.env.VITE_AZURE_API_SCOPE || '').trim();
const hasCustomApiScope =
  Boolean(rawApiScope) &&
  rawApiScope !== 'User.Read' &&
  !rawApiScope.startsWith('openid') &&
  !rawApiScope.startsWith('profile');

export const msalConfig = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri,
    postLogoutRedirectUri: redirectUri,
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    allowRedirectInIframe: false,
  },
};

/**
 * Login interativo — apenas Microsoft Graph / OIDC.
 * NÃO incluir api://... aqui: se a API não estiver exposta no tenant, o Entra
 * devolve AADSTS500011 e o login falha por completo.
 */
export const loginRequest = {
  scopes: ['openid', 'profile', 'email', 'User.Read'],
};

/**
 * Token para a API FastAPI (silent).
 * Com VITE_AZURE_API_SCOPE vazio → User.Read (Graph); útil com AUTH_DISABLED.
 * Com scope api://... → exige "Expose an API" + consent no Entra.
 */
export const apiTokenRequest = {
  scopes: [hasCustomApiScope ? rawApiScope : 'User.Read'],
};

/** Scopes opcionais do Microsoft Graph (foto / perfil estendido). */
export const graphConfig = {
  graphMeEndpoint: 'https://graph.microsoft.com/v1.0/me',
  graphPhotoEndpoint: 'https://graph.microsoft.com/v1.0/me/photo/$value',
};

export default msalConfig;
