/** Debug de autenticação Entra/MSAL — painel + trilha em sessionStorage */

const LOG_KEY = 'msal_debug_log_v1';
const FLAG_KEY = 'msal_debug';
const MAX_LINES = 80;

export type AuthDebugSnapshot = {
  enabled: boolean;
  lines: string[];
  href: string;
  origin: string;
  hasCodeHash: boolean;
  hasCodeQuery: boolean;
  hasErrorHash: boolean;
  hasErrorQuery: boolean;
  errorFromUrl: string | null;
  msalKeysSession: string[];
  msalKeysLocal: string[];
  accounts: number;
  activeAccount: string | null;
  clientId: string | null;
  tenantId: string | null;
  redirectUri: string | null;
  bootError: string | null;
};

function now(): string {
  return new Date().toISOString().slice(11, 23);
}

export function isAuthDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (String(import.meta.env.VITE_AUTH_DEBUG || '').toLowerCase() === 'true') return true;
    if (new URLSearchParams(window.location.search).get('debug') === '1') {
      localStorage.setItem(FLAG_KEY, '1');
      return true;
    }
    return localStorage.getItem(FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

export function setAuthDebugEnabled(on: boolean): void {
  try {
    if (on) localStorage.setItem(FLAG_KEY, '1');
    else localStorage.removeItem(FLAG_KEY);
  } catch {
    // ignore
  }
}

export function authDebugLog(message: string, data?: unknown): void {
  const line =
    data === undefined
      ? `[${now()}] ${message}`
      : `[${now()}] ${message} ${safeJson(data)}`;
  console.info('[AUTH-DEBUG]', message, data ?? '');
  try {
    const prev = JSON.parse(sessionStorage.getItem(LOG_KEY) || '[]') as string[];
    const next = [...prev, line].slice(-MAX_LINES);
    sessionStorage.setItem(LOG_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function authDebugClear(): void {
  try {
    sessionStorage.removeItem(LOG_KEY);
  } catch {
    // ignore
  }
}

export function getAuthDebugLines(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(LOG_KEY) || '[]') as string[];
  } catch {
    return [];
  }
}

function safeJson(data: unknown): string {
  try {
    return JSON.stringify(data, (_k, v) => {
      if (typeof v === 'string' && v.length > 120) return `${v.slice(0, 40)}…(${v.length} chars)`;
      return v;
    });
  } catch {
    return String(data);
  }
}

function listStorageKeys(store: Storage, pred: (k: string) => boolean): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < store.length; i += 1) {
      const k = store.key(i);
      if (k && pred(k)) keys.push(k);
    }
  } catch {
    // ignore
  }
  return keys.sort();
}

function readUrlError(): string | null {
  try {
    const hash = window.location.hash.replace(/^#/, '');
    const search = window.location.search.replace(/^\?/, '');
    const params = new URLSearchParams(hash.includes('error') ? hash : search);
    const err = params.get('error');
    const desc = params.get('error_description');
    if (!err && !desc) return null;
    return desc ? decodeURIComponent(desc.replace(/\+/g, ' ')) : err;
  } catch {
    return null;
  }
}

export function collectAuthDebugSnapshot(extra?: {
  accounts?: number;
  activeAccount?: string | null;
  clientId?: string | null;
  tenantId?: string | null;
  redirectUri?: string | null;
}): AuthDebugSnapshot {
  const href = typeof window !== 'undefined' ? window.location.href : '';
  let bootError: string | null = null;
  try {
    bootError = sessionStorage.getItem('msal_boot_error');
  } catch {
    // ignore
  }

  return {
    enabled: isAuthDebugEnabled(),
    lines: getAuthDebugLines(),
    href,
    origin: typeof window !== 'undefined' ? window.location.origin : '',
    hasCodeHash: href.includes('#') && href.includes('code='),
    hasCodeQuery: typeof window !== 'undefined' && window.location.search.includes('code='),
    hasErrorHash: href.includes('error='),
    hasErrorQuery: typeof window !== 'undefined' && window.location.search.includes('error='),
    errorFromUrl: typeof window !== 'undefined' ? readUrlError() : null,
    msalKeysSession:
      typeof sessionStorage !== 'undefined'
        ? listStorageKeys(sessionStorage, (k) => k.toLowerCase().includes('msal') || k.includes('interaction'))
        : [],
    msalKeysLocal:
      typeof localStorage !== 'undefined'
        ? listStorageKeys(localStorage, (k) => k.toLowerCase().includes('msal') || k.includes('login.windows'))
        : [],
    accounts: extra?.accounts ?? 0,
    activeAccount: extra?.activeAccount ?? null,
    clientId: extra?.clientId ?? null,
    tenantId: extra?.tenantId ?? null,
    redirectUri: extra?.redirectUri ?? null,
    bootError,
  };
}

export function formatAuthDebugReport(snap: AuthDebugSnapshot): string {
  return [
    '=== AUTH DEBUG ===',
    `origin: ${snap.origin}`,
    `href: ${snap.href.slice(0, 300)}${snap.href.length > 300 ? '…' : ''}`,
    `code in hash: ${snap.hasCodeHash} | code in query: ${snap.hasCodeQuery}`,
    `error in url: ${snap.errorFromUrl || '(none)'}`,
    `accounts: ${snap.accounts} | active: ${snap.activeAccount || '(none)'}`,
    `clientId: ${snap.clientId || '(?)'}`,
    `tenantId: ${snap.tenantId || '(?)'}`,
    `redirectUri: ${snap.redirectUri || '(?)'}`,
    `bootError: ${snap.bootError || '(none)'}`,
    `session msal keys (${snap.msalKeysSession.length}): ${snap.msalKeysSession.join(', ') || '(none)'}`,
    `local msal keys (${snap.msalKeysLocal.length}): ${snap.msalKeysLocal.slice(0, 12).join(', ') || '(none)'}`,
    '--- log ---',
    ...snap.lines,
  ].join('\n');
}
