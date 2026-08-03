import { Configuration, LogLevel, PublicClientApplication } from '@azure/msal-browser';
import { MsalConfigState } from '../types';
import { msalConfig as envMsalConfig, loginRequest as envLoginRequest } from './authConfig';

const STORAGE_KEY = 'msal_config_settings_ti';

export const getStoredMsalSettings = (): MsalConfigState => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // ignore
    }
  }

  const envClientId = import.meta.env.VITE_AZURE_CLIENT_ID as string | undefined;
  const envTenantId = import.meta.env.VITE_AZURE_TENANT_ID as string | undefined;
  const envRedirect = import.meta.env.VITE_AZURE_REDIRECT_URI as string | undefined;
  const configured = Boolean(envClientId && envClientId !== '00000000-0000-0000-0000-000000000000');

  return {
    clientId: envClientId || envMsalConfig.auth.clientId,
    tenantId: envTenantId || (envMsalConfig.auth.authority?.split('/').pop() ?? 'common'),
    redirectUri: envRedirect || (typeof window !== 'undefined' ? window.location.origin : ''),
    configured,
  };
};

export const saveMsalSettings = (settings: MsalConfigState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};

export const createMsalInstance = (settings: MsalConfigState = getStoredMsalSettings()) => {
  const msalConfig: Configuration = {
    auth: {
      clientId: settings.clientId || envMsalConfig.auth.clientId,
      authority: `https://login.microsoftonline.com/${settings.tenantId || 'common'}`,
      redirectUri: settings.redirectUri || window.location.origin,
      postLogoutRedirectUri: settings.redirectUri || window.location.origin,
    },
    cache: {
      cacheLocation: 'localStorage',
    },
    system: {
      loggerOptions: {
        loggerCallback: (level, message, containsPii) => {
          if (containsPii) return;
          switch (level) {
            case LogLevel.Error:
              console.error('[MSAL]', message);
              return;
            case LogLevel.Info:
              console.info('[MSAL]', message);
              return;
            case LogLevel.Verbose:
              console.debug('[MSAL]', message);
              return;
            case LogLevel.Warning:
              console.warn('[MSAL]', message);
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
