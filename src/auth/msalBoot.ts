import { PublicClientApplication, ResponseMode } from '@azure/msal-browser';
import {
  createMsalInstance,
  getStoredMsalSettings,
  isSecureAuthContext,
  clearMsalInteractionLocks,
  loginRequest as baseLoginRequest,
} from './msalConfig';
import { authDebugLog, isAuthDebugEnabled, collectAuthDebugSnapshot } from './authDebug';

export const MSAL_BOOT_ERROR_KEY = 'msal_boot_error';

let bootPromise: Promise<PublicClientApplication | null> | null = null;
let bootedInstance: PublicClientApplication | null = null;

/** Login com code na query (?code=) — evita conflito com hash e URLs gigantes em # */
export const loginRequest = {
  ...baseLoginRequest,
  responseMode: ResponseMode.QUERY,
};

function readEntraErrorFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const hash = window.location.hash?.replace(/^#/, '') || '';
    const search = window.location.search?.replace(/^\?/, '') || '';
    const params = new URLSearchParams(
      hash.includes('error=') ? hash : search.includes('error=') ? search : hash || search
    );
    const err = params.get('error');
    const desc = params.get('error_description');
    if (!err && !desc) return null;
    return desc ? decodeURIComponent(desc.replace(/\+/g, ' ')) : err;
  } catch {
    return null;
  }
}

function clearOAuthParamsFromUrl(): void {
  if (typeof window === 'undefined') return;
  const hasHashAuth =
    window.location.hash.includes('code=') ||
    window.location.hash.includes('error=') ||
    window.location.hash.includes('client_info=');
  const hasQueryAuth =
    window.location.search.includes('code=') ||
    window.location.search.includes('error=') ||
    window.location.search.includes('client_info=');
  if (!hasHashAuth && !hasQueryAuth) return;
  authDebugLog('clearOAuthParamsFromUrl', {
    before: window.location.href.slice(0, 180),
  });
  window.history.replaceState({}, document.title, `${window.location.origin}${window.location.pathname}`);
}

/**
 * Boot único do MSAL — chamar ANTES do React render.
 * Processa ?code= / #code= uma vez só (sem corrida do Strict Mode).
 */
export function bootMsal(): Promise<PublicClientApplication | null> {
  if (bootedInstance) {
    authDebugLog('bootMsal: reuse instance');
    return Promise.resolve(bootedInstance);
  }
  if (bootPromise) {
    authDebugLog('bootMsal: await in-flight');
    return bootPromise;
  }

  bootPromise = (async () => {
    if (typeof window === 'undefined') return null;
    authDebugLog('bootMsal: start', {
      debug: isAuthDebugEnabled(),
      href: window.location.href.slice(0, 240),
      secure: isSecureAuthContext(),
    });

    if (!isSecureAuthContext()) {
      authDebugLog('bootMsal: abort insecure context');
      return null;
    }

    const entraErr = readEntraErrorFromUrl();
    if (entraErr) {
      authDebugLog('bootMsal: Entra error in URL', entraErr.slice(0, 300));
      try {
        sessionStorage.setItem(MSAL_BOOT_ERROR_KEY, entraErr);
      } catch {
        // ignore
      }
      clearOAuthParamsFromUrl();
    }

    const hasAuthCode =
      window.location.hash.includes('code=') || window.location.search.includes('code=');
    authDebugLog('bootMsal: hasAuthCode', { hasAuthCode, hash: !!window.location.hash, search: window.location.search });

    if (!hasAuthCode) {
      clearMsalInteractionLocks();
      authDebugLog('bootMsal: cleared interaction locks');
    }

    const settings = getStoredMsalSettings();
    authDebugLog('bootMsal: settings', {
      clientId: settings.clientId,
      tenantId: settings.tenantId,
      redirectUri: settings.redirectUri,
      configured: settings.configured,
    });

    const pca = createMsalInstance(settings);
    await pca.initialize();
    authDebugLog('bootMsal: initialized');

    try {
      const result = await pca.handleRedirectPromise({
        navigateToLoginRequestUrl: false,
      });
      authDebugLog('bootMsal: handleRedirectPromise result', {
        hasResult: !!result,
        account: result?.account?.username || null,
        expiresOn: result?.expiresOn?.toISOString?.() || null,
        scopes: result?.scopes || null,
      });
      if (result?.account) {
        pca.setActiveAccount(result.account);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const name = err instanceof Error ? err.name : 'Error';
      const stack = err instanceof Error ? err.stack?.slice(0, 500) : undefined;
      authDebugLog('bootMsal: handleRedirectPromise FAILED', { name, message, stack });
      console.warn('MSAL handleRedirectPromise:', err);
      try {
        sessionStorage.setItem(
          MSAL_BOOT_ERROR_KEY,
          `${message}. Limpe os dados do site e tente o login de novo.`
        );
      } catch {
        // ignore
      }
    }

    clearOAuthParamsFromUrl();

    const accounts = pca.getAllAccounts();
    if (!pca.getActiveAccount() && accounts.length > 0) {
      pca.setActiveAccount(accounts[0]);
    }

    authDebugLog('bootMsal: done', {
      accounts: accounts.length,
      active: pca.getActiveAccount()?.username || null,
      snapshot: collectAuthDebugSnapshot({
        accounts: accounts.length,
        activeAccount: pca.getActiveAccount()?.username || null,
        clientId: settings.clientId,
        tenantId: settings.tenantId,
        redirectUri:
          typeof window !== 'undefined' && window.location.hostname !== 'localhost'
            ? window.location.origin
            : settings.redirectUri,
      }),
    });

    bootedInstance = pca;
    return pca;
  })().catch((err) => {
    authDebugLog('bootMsal: fatal', err instanceof Error ? err.message : String(err));
    bootPromise = null;
    throw err;
  });

  return bootPromise;
}

export function getBootedMsal(): PublicClientApplication | null {
  return bootedInstance;
}
