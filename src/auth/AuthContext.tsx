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
import { acquireApiAccessToken, setAccessTokenProvider, setMsalInstance, api } from '../api/client';
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

/** Usuário em Administração → Usuários & Perfis (e-mail em meta ou nome=e-mail legado). */
export function lookupCatalogUser(email: string): CatalogUserRow | null {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  return (
    readCatalogUsers().find((u) => {
      if (u.active === false) return false;
      const mail = String(u.meta?.email || '').trim().toLowerCase();
      const name = String(u.name || '').trim().toLowerCase();
      return mail === normalized || name === normalized;
    }) || null
  );
}

/** Papel cadastrado em Administração → Usuários & Perfis. */
export function lookupCatalogRole(email: string): AccessRole | null {
  const role = lookupCatalogUser(email)?.meta?.role;
  if (role === 'admin' || role === 'ti' || role === 'rh' || role === 'gestor' || role === 'viewer') {
    return role;
  }
  return null;
}

/**
 * Admin (N3) fixo nunca perde admin.
 * Demais operadores: papel do cadastro em Usuários & Perfis (obrigatório).
 */
export const ADMIN_EMAILS = new Set([
  'luis.figueiredo@diroma.com.br',
  'n3.admin@diroma.com.br',
]);

export function isFixedAdmin(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  const local = normalized.split('@')[0] || '';
  return ADMIN_EMAILS.has(normalized) || local.startsWith('n3.') || local.startsWith('admin.n3');
}

/** Pode entrar: admin fixo OU cadastrado/ativo em Usuários & Perfis. */
export function isPortalUserAllowed(email: string): boolean {
  if (isFixedAdmin(email)) return true;
  return lookupCatalogUser(email) !== null;
}

export function resolveUserRole(email: string): AccessRole {
  const normalized = email.trim().toLowerCase();
  if (isFixedAdmin(normalized)) return 'admin';
  const fromCatalog = lookupCatalogRole(normalized);
  if (fromCatalog) return fromCatalog;
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
  const claims = (account.idTokenClaims || {}) as Record<string, unknown>;
  const email = (
    account.username ||
    (typeof claims.preferred_username === 'string' ? claims.preferred_username : '') ||
    (typeof claims.email === 'string' ? claims.email : '')
  ).toLowerCase();
  const role = resolveUserRole(email);
  return {
    name: account.name || email || account.username,
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
  const [user, setUser] = useState<UserProfile | null>(() => {
    const account = pickAccount(msalInstance.getAllAccounts(), msalInstance);
    return account ? buildProfileFromAccount(account) : null;
  });
  const [authError, setAuthError] = useState<string | null>(bootError);

  // Sincroniza conta MSAL → user (domínio + cadastro de perfil)
  useEffect(() => {
    const account = pickAccount(accounts, instance);
    if (!account) return;

    const claims = (account.idTokenClaims || {}) as Record<string, unknown>;
    const email = (
      account.username ||
      (typeof claims.preferred_username === 'string' ? claims.preferred_username : '') ||
      (typeof claims.email === 'string' ? claims.email : '')
    ).toLowerCase();
    const domain = email.includes('@') ? email.split('@')[1] : '';

    // Não usar logoutRedirect aqui — causa loop de reload com o Entra
    if (domain && domain !== 'diroma.com.br') {
      setAuthError('Acesso restrito a contas @diroma.com.br');
      setUser(null);
      return;
    }

    if (email && !isPortalUserAllowed(email)) {
      setAuthError(
        `"${email}" não está cadastrado em Administração → Usuários & Perfis. Peça a um Admin N3 para liberar o acesso com o perfil correto.`
      );
      setUser(null);
      return;
    }

    instance.setActiveAccount(account);
    setUser(buildProfileFromAccount(account));
    localStorage.removeItem(SESSION_KEY);
    setAuthError(null);
  }, [accounts, instance]);

  // Reaplica perfil quando Usuários & Perfis muda (evita visitante com sessão “admin” stale)
  useEffect(() => {
    const syncRoleFromCatalog = () => {
      setUser((prev) => {
        if (!prev?.email || prev.isDemo) return prev;
        if (!isPortalUserAllowed(prev.email)) {
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
