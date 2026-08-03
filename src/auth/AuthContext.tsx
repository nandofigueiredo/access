import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { MsalProvider, useMsal } from '@azure/msal-react';
import { PublicClientApplication, InteractionStatus } from '@azure/msal-browser';
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

/**
 * Admin (N3) — somente e-mails explicitamente listados / prefixo n3.
 * Service Desk — ti. / sd.
 * RH — rh.
 * Gestor — gestor. / manager.
 * Demais @diroma → viewer (sem elevação automática).
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
  /** Login local por perfil (requer VITE_ENABLE_DEMO_LOGIN=true) */
  loginAsProfile: (role: AccessRole) => Promise<void>;
  logout: () => void;
  msalSettings: MsalConfigState;
  updateMsalSettings: (settings: MsalConfigState) => void;
  getAccessToken: () => Promise<string | null>;
  secureContext: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_KEY = 'onboarding_diroma_session';

function buildProfileFromAccount(account: {
  name?: string;
  username: string;
  tenantId?: string;
}): UserProfile {
  const email = account.username.toLowerCase();
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

interface AuthProviderInnerProps {
  children: ReactNode;
  msalInstance: PublicClientApplication;
  msalSettings: MsalConfigState;
  setMsalSettings: React.Dispatch<React.SetStateAction<MsalConfigState>>;
}

const AuthProviderInner: React.FC<AuthProviderInnerProps> = ({
  children,
  msalInstance,
  msalSettings,
  setMsalSettings,
}) => {
  const { instance, accounts, inProgress } = useMsal();
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    // Contas já resolvidas no AuthProvider via handleRedirectPromise
    if (accounts.length > 0) {
      setUser(buildProfileFromAccount(accounts[0]));
      localStorage.removeItem(SESSION_KEY);
    }
  }, [accounts]);

  useEffect(() => {
    setMsalInstance(msalInstance);
    setAccessTokenProvider(async () => {
      if (!user || user.isDemo) return null;
      return acquireApiAccessToken(accounts[0] || null);
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
          const nextRole = (me.role as AccessRole) || prev.role;
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
        // API offline
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.isAuthenticated, user?.email, user?.isDemo]);

  const getAccessToken = async () => {
    if (isPlaceholderClientId(msalSettings.clientId) || user?.isDemo) return null;
    return acquireApiAccessToken(accounts[0] || null);
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
      throw new Error('Selecione um perfil acima e use “Entrar como…” (Entra ID ainda não configurado).');
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
    if (msalSettings.configured && accounts.length > 0) {
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

  useEffect(() => {
    if (!secure) {
      setMsalReady(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        clearMsalInteractionLocks();
        const pca = createMsalInstance(getStoredMsalSettings());
        // MSAL Browser v3+ exige initialize() antes de qualquer API
        await pca.initialize();
        // Consome o código OAuth na própria aba (sem popup)
        await pca.handleRedirectPromise().catch((err) => {
          console.warn('MSAL redirect no boot:', err);
        });
        if (cancelled) return;
        setMsalInstanceState(pca);
        setMsalReady(true);
      } catch (err) {
        console.error('Falha ao inicializar MSAL:', err);
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
