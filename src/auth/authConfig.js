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
const apiScope =
  import.meta.env.VITE_AZURE_API_SCOPE || 'User.Read';

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

/** Scopes para login interativo (perfil + escopo da API própria). */
export const loginRequest = {
  scopes: [
    'openid',
    'profile',
    'email',
    'User.Read',
    // Inclui o escopo da API para o token silencioso funcionar sem popup
    ...(apiScope && apiScope !== 'User.Read' ? [apiScope] : []),
  ],
};

/**
 * Scopes para obter access_token aceito pela API FastAPI.
 * Cadastre este escopo exposto na App Registration (Expose an API).
 */
export const apiTokenRequest = {
  scopes: [apiScope],
};

/** Scopes opcionais do Microsoft Graph (foto / perfil estendido). */
export const graphConfig = {
  graphMeEndpoint: 'https://graph.microsoft.com/v1.0/me',
  graphPhotoEndpoint: 'https://graph.microsoft.com/v1.0/me/photo/$value',
};

export default msalConfig;
