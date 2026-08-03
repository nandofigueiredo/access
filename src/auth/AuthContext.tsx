import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { MsalProvider, useMsal } from '@azure/msal-react';
import {
  AccountInfo,
  InteractionStatus,
  PublicClientApplication,
} from '@azure/msal-browser';
import { UserProfile, MsalConfigState } from '../types';
import {
  getStoredMsalSettings,
  isDemoLoginEnabled,
  isPlaceholderClientId,
  isSecureAuthContext,
  saveMsalSettings,
} from './msalConfig';
import { bootMsal, getBootedMsal, loginRequest, MSAL_BOOT_ERROR_KEY } from './msalBoot';
import { authDebugLog } from './authDebug';
import { acquireApiAccessToken, setAccessTokenProvider, setMsalInstance, api, USE_API } from '../api/client';
import { AccessRole, DEMO_USERS, roleLabel } from './roles';

const CATALOG_STORAGE_KEY = 'portal_ti_system_catalog_v1';
const SESSION_KEY = 'onboarding_diroma_session';
const CATALOG_UPDATED_EVENT = 'portal-catalog-updated';

type CatalogUserRow = {
  id?: string;
  name?: string;
  active?: boolean;
  meta?: { email?: string; role?: string };
};

function readCatalogUsers(): CatalogUserRow[] {
  try {
    const raw = localStorage.getItem(CATALOG_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { users?: CatalogUserRow[] };
    return Array.isArray(parsed?.users) ? parsed.users : [];
  } catch {
    return [];
  }
}

/**
 * Bootstrap admin (só estes e-mails entram sem linha no catálogo).
 * Qualquer outra conta @diroma.com.br PRECISA estar em Usuários & Perfis.
 */
export const ADMIN_EMAILS = new Set([
  'luis.figueiredo@diroma.com.br',
  'n3.admin@diroma.com.br',
]);

export function isFixedAdmin(email: string): boolean {
  return ADMIN_EMAILS.has(email.trim().toLowerCase());
}

function matchCatalogUser(email: string, users: CatalogUserRow[]): CatalogUserRow | null {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  return (
    users.find((u) => {
      if (u.active === false) return false;
      const mail = String(u.meta?.email || '').trim().toLowerCase();
      const name = String(u.name || '').trim().toLowerCase();
      return mail === normalized || name === normalized;
    }) || null
  );
}

/** Pode entrar: admin bootstrap OU cadastrado/ativo em Usuários & Perfis. */
export function isPortalUserAllowed(email: string): boolean {
  if (isFixedAdmin(email)) return true;
  return matchCatalogUser(email, readCatalogUsers()) !== null;
}

export function lookupCatalogUser(email: string): CatalogUserRow | null {
  return matchCatalogUser(email, readCatalogUsers());
}

/** Papel cadastrado em Administração → Usuários & Perfis. */
export function lookupCatalogRole(email: string): AccessRole | null {
  const role = lookupCatalogUser(email)?.meta?.role;
  if (role === 'admin' || role === 'ti' || role === 'rh' || role === 'gestor' || role === 'viewer') {
    return role;
  }
  return null;
}

export function resolveUserRole(email: string): AccessRole {
  const normalized = email.trim().toLowerCase();
  if (isFixedAdmin(normalized)) return 'admin';
  const fromCatalog = lookupCatalogRole(normalized);
  if (fromCatalog) return fromCatalog;
  // Sem cadastro: nunca eleva — viewer só como fallback defensivo (acesso deve ser bloqueado antes)
  return 'viewer';
}

function extractAccountEmail(account: AccountInfo): string {
  const claims = (account.idTokenClaims || {}) as Record<string, unknown>;
  return (
    account.username ||
    (typeof claims.preferred_username === 'string' ? claims.preferred_username : '') ||
    (typeof claims.email === 'string' ? claims.email : '')
  ).toLowerCase();
}

/** Atualiza catálogo local a partir da API (fonte de verdade dos operadores). */
async function syncCatalogUsersFromApi(): Promise<CatalogUserRow[]> {
  if (!USE_API) return readCatalogUsers();
  try {
    const remote = await api.getSetting<{ users?: CatalogUserRow[] }>('catalog');
    const users = remote?.value?.users;
    if (!Array.isArray(users)) return readCatalogUsers();
    try {
      const raw = localStorage.getItem(CATALOG_STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      const next = {
        ...parsed,
        users,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(CATALOG_UPDATED_EVENT));
    } catch {
      // ignore storage
    }
    return users;
  } catch (err) {
    console.warn('Falha ao sincronizar Usuários & Perfis da API:', err);
    return readCatalogUsers();
  }
}

async function verifyPortalAccess(email: string): Promise<{ allowed: boolean; reason?: string; role?: AccessRole }> {
  if (isFixedAdmin(email)) {
    return { allowed: true, role: 'admin' };
  }

  // 1) API dedicada (catálogo no banco)
  if (USE_API) {
    try {
      const status = await api.getAccessStatus(email);
      if (status.allowed) {
        const role =
          status.role === 'admin' ||
          status.role === 'ti' ||
          status.role === 'rh' ||
          status.role === 'gestor' ||
          status.role === 'viewer'
            ? status.role
            : lookupCatalogRole(email) || 'viewer';
        return { allowed: true, role };
      }
      return {
        allowed: false,
        reason:
          status.reason ||
          `"${email}" não está cadastrado em Administração → Usuários & Perfis.`,
      };
    } catch (err) {
      console.warn('access/status falhou, tentando catálogo:', err);
    }
  }

  // 2) Fallback: lista de usuários do settings/catalog
  const users = await syncCatalogUsersFromApi();
  const row = matchCatalogUser(email, users);
  if (!row) {
    return {
      allowed: false,
      reason: `"${email}" não está cadastrado em Administração → Usuários & Perfis. Peça a um Admin N3 para liberar o acesso.`,
    };
  }
  const role = lookupCatalogRole(email) || 'viewer';
  return { allowed: true, role };
}

interface AuthContextType {
  user: UserProfile | null;
  /** true enquanto valida cadastro em Usuários & Perfis após login Microsoft */
  accessChecking: boolean;
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

function buildProfileFromAccount(account: AccountInfo, forcedRole?: AccessRole): UserProfile {
  const email = extractAccountEmail(account);
  const role = forcedRole || resolveUserRole(email);
  return {
    name: account.name || email || account.username,
    email,
    jobTitle: roleLabel(role),
    department: role === 'rh' ? 'RH' : 'TI',
    tenantId: account.tenantId,
    role,
    isAuthenticated: true,
    isDemo: false,
  };
}

function pickAccount(
  accounts: AccountInfo[],
  instance: { getActiveAccount(): AccountInfo | null }
): AccountInfo | null {
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
  // Nunca autentica só com conta MSAL — precisa passar pelo cadastro
  const [user, setUser] = useState<UserProfile | null>(null);
  const [accessChecking, setAccessChecking] = useState(() => msalInstance.getAllAccounts().length > 0);
  const [authError, setAuthError] = useState<string | null>(bootError);
  const deniedEmailRef = React.useRef<string | null>(null);

  // Conta MSAL → só libera se estiver em Usuários & Perfis (API)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const account = pickAccount(accounts, instance);
      if (!account) {
        deniedEmailRef.current = null;
        setAccessChecking(false);
        setUser(null);
        return;
      }

      const email = extractAccountEmail(account);
      const domain = email.includes('@') ? email.split('@')[1] : '';

      if (domain && domain !== 'diroma.com.br') {
        if (!cancelled) {
          setAuthError('Acesso restrito a contas @diroma.com.br');
          setUser(null);
          setAccessChecking(false);
          deniedEmailRef.current = email;
        }
        return;
      }

      if (deniedEmailRef.current === email) {
        if (!cancelled) {
          setUser(null);
          setAccessChecking(false);
        }
        return;
      }

      setAccessChecking(true);
      // Evita flash do portal antes da validação
      setUser(null);

      // Garante token provider com a conta atual (AUTH_DISABLED na API não exige, mas não atrapalha)
      setMsalInstance(msalInstance);
      setAccessTokenProvider(async () => acquireApiAccessToken(account));

      const result = await verifyPortalAccess(email);
      if (cancelled) return;

      if (!result.allowed) {
        deniedEmailRef.current = email;
        setAuthError(
          result.reason ||
            `"${email}" não está cadastrado em Administração → Usuários & Perfis. Peça a um Admin N3 para liberar o acesso.`
        );
        setUser(null);
        setAccessChecking(false);
        try {
          instance.setActiveAccount(null);
        } catch {
          // ignore
        }
        return;
      }

      deniedEmailRef.current = null;
      instance.setActiveAccount(account);
      setUser(buildProfileFromAccount(account, result.role));
      localStorage.removeItem(SESSION_KEY);
      setAuthError(null);
      setAccessChecking(false);
      // Mantém catálogo local alinhado
      void syncCatalogUsersFromApi();
    })();

    return () => {
      cancelled = true;
    };
  }, [accounts, instance, msalInstance]);

  // Reaplica perfil quando Usuários & Perfis muda
  useEffect(() => {
    const syncRoleFromCatalog = () => {
      setUser((prev) => {
        if (!prev?.email || prev.isDemo) return prev;
        if (!isPortalUserAllowed(prev.email)) {
          deniedEmailRef.current = prev.email;
          setAuthError(
            `"${prev.email}" não está mais ativo em Usuários & Perfis. Peça a um Admin N3 para reativar o acesso.`
          );
          return null;
        }
        const nextRole = resolveUserRole(prev.email);
        if (prev.role === nextRole && prev.jobTitle === roleLabel(nextRole)) return prev;
        return {
          ...prev,
          role: nextRole,
          jobTitle: roleLabel(nextRole),
          department: nextRole === 'rh' ? 'RH' : prev.department || 'TI',
        };
      });
    };
    window.addEventListener(CATALOG_UPDATED_EVENT, syncRoleFromCatalog);
    window.addEventListener('storage', syncRoleFromCatalog);
    return () => {
      window.removeEventListener(CATALOG_UPDATED_EVENT, syncRoleFromCatalog);
      window.removeEventListener('storage', syncRoleFromCatalog);
    };
  }, []);

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
          // Papel vem do cadastro local / admin fixo — API não rebaixa nem eleva à revelia
          const nextRole = resolveUserRole(prev.email);
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
            isDemo: false,
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
      authDebugLog('loginRedirect starting', {
        scopes: loginRequest.scopes,
        responseMode: (loginRequest as { responseMode?: string }).responseMode,
      });
      // URL limpa antes do redirect (evita reprocessar code antigo)
      window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
      await msalInstance.initialize();
      await msalInstance.loginRedirect(loginRequest);
    } catch (err: unknown) {
      authDebugLog('loginRedirect failed', err instanceof Error ? err.message : String(err));
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
    deniedEmailRef.current = null;
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('onboarding_demo_user');
    setUser(null);
    setAccessChecking(false);
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
        accessChecking,
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
        accessChecking: false,
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
  const [msalInstance, setMsalInstanceState] = useState<PublicClientApplication | null>(() =>
    getBootedMsal()
  );
  const [msalReady, setMsalReady] = useState(() => !secure || getBootedMsal() !== null);
  const [initError, setInitError] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(MSAL_BOOT_ERROR_KEY);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!secure) {
      setMsalReady(true);
      return;
    }

    if (getBootedMsal()) {
      setMsalInstanceState(getBootedMsal());
      setMsalReady(true);
      try {
        const storedErr = sessionStorage.getItem(MSAL_BOOT_ERROR_KEY);
        if (storedErr) {
          sessionStorage.removeItem(MSAL_BOOT_ERROR_KEY);
          setBootError(storedErr);
        }
      } catch {
        // ignore
      }
      return;
    }

    (async () => {
      try {
        const pca = await bootMsal();
        try {
          const storedErr = sessionStorage.getItem(MSAL_BOOT_ERROR_KEY);
          if (storedErr) {
            sessionStorage.removeItem(MSAL_BOOT_ERROR_KEY);
            setBootError(storedErr);
          }
        } catch {
          // ignore
        }
        setMsalInstanceState(pca);
        setMsalReady(true);
      } catch (err) {
        console.error('Falha ao inicializar MSAL:', err);
        setInitError(err instanceof Error ? err.message : 'Falha ao inicializar Microsoft Entra ID');
        setMsalReady(true);
      }
    })();
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
