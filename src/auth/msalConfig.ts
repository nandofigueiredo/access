import { Configuration, LogLevel, PublicClientApplication } from '@azure/msal-browser';
import { MsalConfigState } from '../types';
import { msalConfig as envMsalConfig, loginRequest as envLoginRequest } from './authConfig';

const STORAGE_KEY = 'msal_config_settings_ti';
const PLACEHOLDER_CLIENT = '00000000-0000-0000-0000-000000000000';

export function isPlaceholderClientId(clientId?: string | null): boolean {
  return !clientId || clientId === PLACEHOLDER_CLIENT || clientId.trim() === '';
}

export function isDemoLoginEnabled(): boolean {
  return String(import.meta.env.VITE_ENABLE_DEMO_LOGIN || '').toLowerCase() === 'true';
}

function envSettings(): MsalConfigState {
  const envClientId = (import.meta.env.VITE_AZURE_CLIENT_ID as string | undefined) || '';
  const envTenantId = (import.meta.env.VITE_AZURE_TENANT_ID as string | undefined) || '';
  const envRedirect = (import.meta.env.VITE_AZURE_REDIRECT_URI as string | undefined) || '';
  const clientId = envClientId || envMsalConfig.auth.clientId;
  return {
    clientId,
    tenantId: envTenantId || (envMsalConfig.auth.authority?.split('/').pop() ?? 'common'),
    redirectUri:
      envRedirect ||
      (typeof window !== 'undefined' ? window.location.origin : ''),
    configured: !isPlaceholderClientId(clientId),
  };
}

export const getStoredMsalSettings = (): MsalConfigState => {
  const fromEnv = envSettings();
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as MsalConfigState;
      // localStorage antigo sem Client ID real não pode sobrescrever o build
      if (isPlaceholderClientId(parsed.clientId) && fromEnv.configured) {
        return fromEnv;
      }
      const clientId = parsed.clientId || fromEnv.clientId;
      return {
        clientId,
        tenantId: parsed.tenantId || fromEnv.tenantId,
        redirectUri:
          parsed.redirectUri ||
          fromEnv.redirectUri ||
          (typeof window !== 'undefined' ? window.location.origin : ''),
        configured: !isPlaceholderClientId(clientId),
      };
    } catch {
      // ignore
    }
  }
  return fromEnv;
};

export const saveMsalSettings = (settings: MsalConfigState) => {
  const next = {
    ...settings,
    configured: !isPlaceholderClientId(settings.clientId),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
};

/** MSAL exige Web Crypto — só em https:// ou http://localhost */
export function isSecureAuthContext(): boolean {
  if (typeof window === 'undefined') return true;
  if (window.isSecureContext) return true;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

export const createMsalInstance = (settings: MsalConfigState = getStoredMsalSettings()) => {
  if (!isSecureAuthContext()) {
    throw new Error(
      'Microsoft login exige HTTPS (ou localhost). Acesse pelo domínio https://access.diroma.com.br — http://IP não funciona com Entra ID.'
    );
  }

  const clientId = settings.clientId || envMsalConfig.auth.clientId;
  if (isPlaceholderClientId(clientId)) {
    throw new Error(
      'VITE_AZURE_CLIENT_ID ausente no build. Defina no .env e rode: docker compose up -d --build web'
    );
  }

  // Em produção use sempre a origem atual (domínio HTTPS do NPM)
  const redirectUri =
    typeof window !== 'undefined' && window.location.hostname !== 'localhost'
      ? window.location.origin
      : settings.redirectUri || window.location.origin;

  const msalConfig: Configuration = {
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${settings.tenantId || 'common'}`,
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
      loggerOptions: {
        loggerCallback: (level, message, containsPii) => {
          if (containsPii) return;
          switch (level) {
            case LogLevel.Error:
              console.error('[MSAL]', message);
              return;
            case LogLevel.Warning:
              console.warn('[MSAL]', message);
              return;
            default:
              return;
          }
        },
        logLevel: LogLevel.Warning,
      },
    },
  };

  return new PublicClientApplication(msalConfig);
};

export const loginRequest = envLoginRequest;
