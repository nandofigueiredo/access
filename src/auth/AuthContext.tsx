import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { MsalProvider, useMsal } from '@azure/msal-react';
import {
  AccountInfo,
  InteractionStatus,
  PublicClientApplication,
} from '@azure/msal-browser';
import { UserProfile, MsalConfigState } from '../types';
import {
  createMsalInstance,
  getStoredMsalSettings,
  isDemoLoginEnabled,
  isPlaceholderClientId,
  isSecureAuthContext,
  clearMsalInteractionLocks,
  loginRequest,
  saveMsalSettings,
} from './msalConfig';
import { acquireApiAccessToken, setAccessTokenProvider, setMsalInstance, api } from '../api/client';
import { AccessRole, DEMO_USERS } from './roles';

const CATALOG_STORAGE_KEY = 'portal_ti_system_catalog_v1';
const SESSION_KEY = 'onboarding_diroma_session';
const MSAL_BOOT_ERROR_KEY = 'msal_boot_error';

/** Singleton — evita Strict Mode consumir o ?code= OAuth duas vezes */
let msalBootPromise: Promise<PublicClientApplication> | null = null;

/** Lê #error=... / ?error=... que o Entra devolve no redirect (ex.: AADSTS500011). */
function captureEntraRedirectError(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const hash = window.location.hash?.replace(/^#/, '') || '';
    const search = window.location.search?.replace(/^\?/, '') || '';
    const params = new URLSearchParams(hash || search);
    const code = params.get('error');
    const desc = params.get('error_description');
    if (!code && !desc) return null;

    const decoded = desc ? decodeURIComponent(desc.replace(/\+/g, ' ')) : code || 'erro Entra ID';
    // Limpa a URL para não reprocessar o erro a cada reload
    const clean = `${window.location.origin}${window.location.pathname}`;
    window.history.replaceState({}, document.title, clean);
    return decoded;
  } catch {
    return null;
  }
}

async function bootMsalInstance(): Promise<PublicClientApplication> {
  if (msalBootPromise) return msalBootPromise;

  msalBootPromise = (async () => {
    const entraErr = captureEntraRedirectError();
    if (entraErr) {
      try {
        sessionStorage.setItem(MSAL_BOOT_ERROR_KEY, entraErr);
      } catch {
        // ignore
      }
    }

    clearMsalInteractionLocks();
    const pca = createMsalInstance(getStoredMsalSettings());
    await pca.initialize();

    try {
      const result = await pca.handleRedirectPromise();
      if (result?.account) {
        pca.setActiveAccount(result.account);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('MSAL redirect no boot:', err);
      try {
        sessionStorage.setItem(MSAL_BOOT_ERROR_KEY, message);
      } catch {
        // ignore
      }
    }

    const accounts = pca.getAllAccounts();
    if (!pca.getActiveAccount() && accounts.length > 0) {
      pca.setActiveAccount(accounts[0]);
    }

    return pca;
  })();

  return msalBootPromise;
}

/** Papel cadastrado em Administração → Usuários & Perfis (por e-mail). */
export function lookupCatalogRole(email: string): AccessRole | null {
  try {
    const raw = localStorage.getItem(CATALOG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      users?: Array<{ active?: boolean; meta?: { email?: string; role?: string } }>;
    };
    const users = parsed?.users;
    if (!Array.isArray(users)) return null;
    const normalized = email.trim().toLowerCase();
    const match = users.find(
      (u) => u.active !== false && String(u.meta?.email || '').toLowerCase() === normalized
    );
    const role = match?.meta?.role;
    if (
      role === 'admin' ||
      role === 'ti' ||
      role === 'rh' ||
      role === 'gestor' ||
      role === 'viewer'
    ) {
      return role;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Admin (N3) — e-mails explicitamente listados / prefixo n3. nunca perdem admin.
 * Depois: cadastro em Usuários & Perfis → heurística de e-mail.
 */
export const ADMIN_EMAILS = new Set([
  'luis.figueiredo@diroma.com.br',
  'n3.admin@diroma.com.br',
]);

export function resolveUserRole(email: string): AccessRole {
  const normalized = email.trim().toLowerCase();
  const local = normalized.split('@')[0] || '';

  if (ADMIN_EMAILS.has(normalized) || local.startsWith('n3.') || local.startsWith('admin.n3')) {
    return 'admin';
  }

  const fromCatalog = lookupCatalogRole(normalized);
  if (fromCatalog) return fromCatalog;

  if (local.startsWith('rh.') || local.includes('.rh')) return 'rh';
  if (local.startsWith('gestor.') || local.startsWith('manager.')) return 'gestor';
  if (local.startsWith('ti.') || local.startsWith('sd.') || local.startsWith('servicedesk.')) {
    return 'ti';
  }
  if (local.startsWith('viewer.') || local === 'viewer') return 'viewer';
  return 'viewer';
}

interface AuthContextType {
  user: UserProfile | null;
  loginWithMicrosoft: () => Promise<void>;
  loginAsProfile: (role: AccessRole) => Promise<void>;
  logout: () => void;
  msalSettings: MsalConfigState;
  updateMsalSettings: (settings: MsalConfigState) => void;
  getAccessToken: () => Promise<string | null>;
  secureContext: boolean;
  authError: string | null;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function buildProfileFromAccount(account: AccountInfo): UserProfile {
  const email = (account.username || '').toLowerCase();
  const role = resolveUserRole(email);
  return {
    name: account.name || account.username,
    email,
    jobTitle:
      role === 'admin'
        ? 'Equipe N3'
        : role === 'ti'
          ? 'Service Desk'
          : role === 'rh'
            ? 'Recursos Humanos'
            : role === 'gestor'
              ? 'Gestor'
              : 'Visualizador',
    department: role === 'rh' ? 'RH' : 'TI',
    tenantId: account.tenantId,
    role,
    isAuthenticated: true,
    isDemo: false,
  };
}

function pickAccount(accounts: AccountInfo[], instance: PublicClientApplication): AccountInfo | null {
  return instance.getActiveAccount() || accounts[0] || null;
}

interface AuthProviderInnerProps {
  children: ReactNode;
  msalInstance: PublicClientApplication;
  msalSettings: MsalConfigState;
  setMsalSettings: React.Dispatch<React.SetStateAction<MsalConfigState>>;
  bootError: string | null;
}

const AuthProviderInner: React.FC<AuthProviderInnerProps> = ({
  children,
  msalInstance,
  msalSettings,
  setMsalSettings,
  bootError,
}) => {
  const { instance, accounts, inProgress } = useMsal();
  const [user, setUser] = useState<UserProfile | null>(() => {
    const account = pickAccount(msalInstance.getAllAccounts(), msalInstance);
    return account ? buildProfileFromAccount(account) : null;
  });
  const [authError, setAuthError] = useState<string | null>(bootError);

  // Sincroniza conta MSAL → user (e valida domínio)
  useEffect(() => {
    const account = pickAccount(accounts, instance);
    if (!account) return;

    const email = (account.username || '').toLowerCase();
    const domain = email.split('@')[1];
    if (domain && domain !== 'diroma.com.br') {
      setAuthError('Acesso restrito a contas @diroma.com.br');
      setUser(null);
      instance
        .logoutRedirect({ postLogoutRedirectUri: window.location.origin })
        .catch(() => undefined);
      return;
    }

    instance.setActiveAccount(account);
    setUser(buildProfileFromAccount(account));
    localStorage.removeItem(SESSION_KEY);
    setAuthError(null);
  }, [accounts, instance]);

  useEffect(() => {
    setMsalInstance(msalInstance);
    setAccessTokenProvider(async () => {
      if (!user || user.isDemo) return null;
      return acquireApiAccessToken(accounts[0] || msalInstance.getActiveAccount());
    });
  }, [msalInstance, accounts, user]);

  useEffect(() => {
    if (!user?.isAuthenticated || !user.email || user.isDemo) return;
    let cancelled = false;
    (async () => {
      try {
        const me = await api.getMe();
        if (cancelled || !me?.email) return;
        setUser((prev) => {
          if (!prev) return prev;
          const apiRole = (me.role as AccessRole) || prev.role;
          const nextRole = ADMIN_EMAILS.has(prev.email.toLowerCase()) ? 'admin' : apiRole;
          if (
            prev.name === (me.name || prev.name) &&
            prev.role === nextRole &&
            prev.jobTitle === (me.jobTitle || prev.jobTitle) &&
            prev.department === (me.department || prev.department)
          ) {
            return prev;
          }
          return {
            ...prev,
            name: me.name || prev.name,
            email: me.email || prev.email,
            role: nextRole,
            jobTitle: me.jobTitle || prev.jobTitle,
            department: me.department || prev.department,
            isDemo: me.isDemo ?? prev.isDemo,
          };
        });
      } catch {
        // API offline — mantém sessão MSAL
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.isAuthenticated, user?.email, user?.isDemo]);

  const getAccessToken = async () => {
    if (isPlaceholderClientId(msalSettings.clientId) || user?.isDemo) return null;
    return acquireApiAccessToken(accounts[0] || msalInstance.getActiveAccount());
  };

  const loginAsProfile = async (role: AccessRole) => {
    if (!isDemoLoginEnabled()) {
      throw new Error(
        'Login por perfil disponível apenas com VITE_ENABLE_DEMO_LOGIN=true. Em produção use Microsoft Entra ID.'
      );
    }
    const profile = { ...DEMO_USERS[role] };
    setUser(profile);
    localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
  };

  const loginWithMicrosoft = async () => {
    const demoOk = isDemoLoginEnabled();
    const missingEntra = isPlaceholderClientId(msalSettings.clientId) || !msalSettings.configured;

    if (missingEntra && demoOk) {
      throw new Error('Entra ID ainda não configurado. Ative VITE_ENABLE_DEMO_LOGIN ou configure o Client ID.');
    }

    if (missingEntra) {
      throw new Error(
        'Entra ID não configurado. Defina VITE_AZURE_CLIENT_ID / TENANT_ID no .env e reconstrua o front.'
      );
    }

    if (inProgress !== InteractionStatus.None) {
      throw new Error('Autenticação Microsoft já em andamento. Aguarde.');
    }

    try {
      setAuthError(null);
      sessionStorage.removeItem(MSAL_BOOT_ERROR_KEY);
      await msalInstance.initialize();
      await msalInstance.loginRedirect(loginRequest);
    } catch (err: unknown) {
      console.warn('MSAL Login falhou:', err);
      throw err;
    }
  };

  useEffect(() => {
    if (!isDemoLoginEnabled()) {
      localStorage.removeItem(SESSION_KEY);
      return;
    }
    if (accounts.length > 0 || user) return;
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as UserProfile;
        if (parsed?.role && parsed?.email) {
          setUser({ ...parsed, isAuthenticated: true, isDemo: true });
        }
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }
    }
  }, [accounts.length, user]);

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('onboarding_demo_user');
    setUser(null);
    if (msalSettings.configured && (accounts.length > 0 || msalInstance.getAllAccounts().length > 0)) {
      instance
        .logoutRedirect({ postLogoutRedirectUri: window.location.origin })
        .catch((err) => console.warn('Logout error:', err));
    }
  };

  const updateMsalSettings = (newSettings: MsalConfigState) => {
    saveMsalSettings(newSettings);
    setMsalSettings(newSettings);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loginWithMicrosoft,
        loginAsProfile,
        logout,
        msalSettings,
        updateMsalSettings,
        getAccessToken,
        secureContext: true,
        authError,
        clearAuthError: () => setAuthError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

const AuthProviderInsecure: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [msalSettings, setMsalSettings] = useState<MsalConfigState>(getStoredMsalSettings);
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!isDemoLoginEnabled()) return;
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as UserProfile;
        if (parsed?.role && parsed?.email) {
          setUser({ ...parsed, isAuthenticated: true, isDemo: true });
        }
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }
    }
  }, []);

  const loginAsProfile = async (role: AccessRole) => {
    if (!isDemoLoginEnabled()) {
      throw new Error('Login por perfil requer VITE_ENABLE_DEMO_LOGIN=true.');
    }
    const profile = { ...DEMO_USERS[role] };
    setUser(profile);
    localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loginWithMicrosoft: async () => {
          throw new Error(
            'Microsoft Entra ID exige HTTPS. Use https://access.diroma.com.br ou entre por perfil (demo).'
          );
        },
        loginAsProfile,
        logout: () => {
          setUser(null);
          localStorage.removeItem(SESSION_KEY);
        },
        msalSettings,
        updateMsalSettings: (s) => {
          saveMsalSettings(s);
          setMsalSettings(s);
        },
        getAccessToken: async () => null,
        secureContext: false,
        authError: null,
        clearAuthError: () => undefined,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [msalSettings, setMsalSettings] = useState<MsalConfigState>(getStoredMsalSettings);
  const secure = isSecureAuthContext();
  const [msalInstance, setMsalInstanceState] = useState<PublicClientApplication | null>(null);
  const [msalReady, setMsalReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    if (!secure) {
      setMsalReady(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const pca = await bootMsalInstance();
        const storedErr = sessionStorage.getItem(MSAL_BOOT_ERROR_KEY);
        if (storedErr) {
          sessionStorage.removeItem(MSAL_BOOT_ERROR_KEY);
          if (!cancelled) setBootError(storedErr);
        }
        if (!cancelled) {
          setMsalInstanceState(pca);
          setMsalReady(true);
        }
      } catch (err) {
        console.error('Falha ao inicializar MSAL:', err);
        // permite retry em novo carregamento
        msalBootPromise = null;
        if (!cancelled) {
          setInitError(err instanceof Error ? err.message : 'Falha ao inicializar Microsoft Entra ID');
          setMsalReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [secure]);

  if (!msalReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5] text-slate-600 text-sm">
        Inicializando autenticação Microsoft…
      </div>
    );
  }

  if (!secure || !msalInstance) {
    return (
      <>
        {initError && (
          <div className="fixed top-0 inset-x-0 z-50 bg-amber-50 text-amber-900 text-center text-xs py-2 px-3 border-b border-amber-200">
            {initError}
          </div>
        )}
        <AuthProviderInsecure>{children}</AuthProviderInsecure>
      </>
    );
  }

  return (
    <MsalProvider instance={msalInstance}>
      <AuthProviderInner
        msalInstance={msalInstance}
        msalSettings={msalSettings}
        setMsalSettings={setMsalSettings}
        bootError={bootError}
      >
        {children}
      </AuthProviderInner>
    </MsalProvider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
