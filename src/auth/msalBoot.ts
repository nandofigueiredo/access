import { PublicClientApplication, ResponseMode } from '@azure/msal-browser';
import {
  createMsalInstance,
  getStoredMsalSettings,
  isSecureAuthContext,
  clearMsalInteractionLocks,
  loginRequest as baseLoginRequest,
} from './msalConfig';

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
    const params = new URLSearchParams(hash.includes('error=') ? hash : search.includes('error=') ? search : hash || search);
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
  window.history.replaceState({}, document.title, `${window.location.origin}${window.location.pathname}`);
}

/**
 * Boot único do MSAL — chamar ANTES do React render.
 * Processa ?code= / #code= uma vez só (sem corrida do Strict Mode).
 */
export function bootMsal(): Promise<PublicClientApplication | null> {
  if (bootedInstance) return Promise.resolve(bootedInstance);
  if (bootPromise) return bootPromise;

  bootPromise = (async () => {
    if (typeof window === 'undefined') return null;
    if (!isSecureAuthContext()) return null;

    const entraErr = readEntraErrorFromUrl();
    if (entraErr) {
      try {
        sessionStorage.setItem(MSAL_BOOT_ERROR_KEY, entraErr);
      } catch {
        // ignore
      }
      clearOAuthParamsFromUrl();
    }

    // NÃO limpar locks se ainda há code= na URL — pode atrapalhar o exchange
    const hasAuthCode =
      window.location.hash.includes('code=') || window.location.search.includes('code=');
    if (!hasAuthCode) {
      clearMsalInteractionLocks();
    }

    const pca = createMsalInstance(getStoredMsalSettings());
    await pca.initialize();

    try {
      const result = await pca.handleRedirectPromise({
        navigateToLoginRequestUrl: false,
      });
      if (result?.account) {
        pca.setActiveAccount(result.account);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
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

    bootedInstance = pca;
    return pca;
  })().catch((err) => {
    bootPromise = null;
    throw err;
  });

  return bootPromise;
}

export function getBootedMsal(): PublicClientApplication | null {
  return bootedInstance;
}
