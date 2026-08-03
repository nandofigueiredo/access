import { Configuration, LogLevel, PublicClientApplication } from '@azure/msal-browser';
import { MsalConfigState } from '../types';

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
  return {
    clientId: '00000000-0000-0000-0000-000000000000', // Default dummy or customizable via Settings UI
    tenantId: 'common',
    redirectUri: typeof window !== 'undefined' ? window.location.origin : '',
    configured: false,
  };
};

export const saveMsalSettings = (settings: MsalConfigState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};

export const createMsalInstance = (settings: MsalConfigState = getStoredMsalSettings()) => {
  const msalConfig: Configuration = {
    auth: {
      clientId: settings.clientId || '00000000-0000-0000-0000-000000000000',
      authority: `https://login.microsoftonline.com/${settings.tenantId || 'common'}`,
      redirectUri: window.location.origin,
      postLogoutRedirectUri: window.location.origin,
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

export const loginRequest = {
  scopes: ['User.Read', 'Directory.Read.All'],
};
