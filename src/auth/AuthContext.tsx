import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { MsalProvider, useMsal } from '@azure/msal-react';
import { PublicClientApplication } from '@azure/msal-browser';
import { UserProfile, MsalConfigState } from '../types';
import { createMsalInstance, getStoredMsalSettings, isDemoLoginEnabled, isPlaceholderClientId, isSecureAuthContext, loginRequest, saveMsalSettings } from './msalConfig';
import { InteractionStatus } from '@azure/msal-browser';
import { acquireApiAccessToken, setAccessTokenProvider, setMsalInstance, api } from '../api/client';

/** Contas com papel admin fixo no Portal TI diRoma */
export const ADMIN_EMAILS = new Set(['luis.figueiredo@diroma.com.br']);

export function resolveUserRole(email: string): UserProfile['role'] {
  const normalized = email.trim().toLowerCase();
  if (ADMIN_EMAILS.has(normalized)) return 'admin';
  if (normalized.startsWith('rh.') || normalized.includes('.rh@')) return 'rh';
  if (normalized.endsWith('@diroma.com.br')) return 'ti';
  return 'viewer';
}

interface AuthContextType {
  user: UserProfile | null;
  loginWithMicrosoft: () => Promise<void>;
  logout: () => void;
  msalSettings: MsalConfigState;
  updateMsalSettings: (settings: MsalConfigState) => void;
  getAccessToken: () => Promise<string | null>;
  /** false quando aberto via http://IP — MSAL não funciona */
  secureContext: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Fallback local quando Entra ID ainda não está configurado — sempre o admin diRoma */
const ADMIN_BOOTSTRAP: UserProfile = {
  name: 'Luis Figueiredo',
  email: 'luis.figueiredo@diroma.com.br',
  jobTitle: 'Administrador de TI',
  department: 'TI',
  tenantId: 'diroma-entra-id',
  role: 'admin',
  isAuthenticated: true,
  isDemo: false,
};

function buildProfileFromAccount(account: {
  name?: string;
  username: string;
  tenantId?: string;
}): UserProfile {
  const email = account.username.toLowerCase();
  return {
    name: account.name || account.username,
    email,
    jobTitle: ADMIN_EMAILS.has(email) ? 'Administrador de TI' : 'Colaborador Microsoft Entra ID',
    department: 'TI',
    tenantId: account.tenantId,
    role: resolveUserRole(email),
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
    setMsalInstance(msalInstance);
    setAccessTokenProvider(async () => {
      if (!user || user.isDemo) return null;
      return acquireApiAccessToken(accounts[0] || null);
    });
  }, [msalInstance, accounts, user]);

  // Retorno do loginRedirect (produção / popup bloqueado)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await instance.handleRedirectPromise();
        if (cancelled || !result?.account) return;
        const profile = buildProfileFromAccount(result.account);
        const domain = profile.email.split('@')[1];
        if (domain !== 'diroma.com.br') {
          setUser(null);
          await instance.logoutRedirect({ postLogoutRedirectUri: window.location.origin }).catch(() => undefined);
          return;
        }
        setUser(profile);
        localStorage.removeItem('onboarding_diroma_session');
      } catch (err) {
        console.warn('MSAL redirect:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [instance]);

  useEffect(() => {
    if (accounts.length > 0) {
      setUser(buildProfileFromAccount(accounts[0]));
    }
  }, [accounts]);

  // Alinha papel/nome com o backend (users.me) quando a API estiver no ar
  useEffect(() => {
    if (!user?.isAuthenticated || !user.email || user.isDemo) return;
    let cancelled = false;
    (async () => {
      try {
        const me = await api.getMe();
        if (cancelled || !me?.email) return;
        setUser((prev) => {
          if (!prev) return prev;
          const nextRole = (me.role as UserProfile['role']) || prev.role;
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
        // API offline — mantém papel local
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync once per session email
  }, [user?.isAuthenticated, user?.email, user?.isDemo]);

  const getAccessToken = async () => {
    if (isPlaceholderClientId(msalSettings.clientId) || user?.isDemo) return null;
    return acquireApiAccessToken(accounts[0] || null);
  };

  const loginWithMicrosoft = async () => {
    const demoOk = isDemoLoginEnabled();
    const missingEntra = isPlaceholderClientId(msalSettings.clientId) || !msalSettings.configured;

    // Bypass local SOMENTE se VITE_ENABLE_DEMO_LOGIN=true (dev)
    if (missingEntra && demoOk) {
      setUser({ ...ADMIN_BOOTSTRAP, isDemo: true });
      localStorage.setItem('onboarding_diroma_session', JSON.stringify({ ...ADMIN_BOOTSTRAP, isDemo: true }));
      return;
    }

    if (missingEntra) {
      throw new Error(
        'Entra ID não configurado neste build. No servidor, defina VITE_AZURE_CLIENT_ID / TENANT_ID no .env e reconstrua o front: sudo docker compose up -d --build web'
      );
    }

    if (inProgress !== InteractionStatus.None) {
      throw new Error('Autenticação Microsoft já em andamento. Aguarde.');
    }

    try {
      // Redirect é mais confiável atrás do NPM (popup costuma ser bloqueado)
      await instance.loginRedirect(loginRequest);
    } catch (err: unknown) {
      console.warn('MSAL Login falhou:', err);
      throw err;
    }
  };

  // Restaura sessão bootstrap apenas em modo demo
  useEffect(() => {
    if (!isDemoLoginEnabled()) {
      localStorage.removeItem('onboarding_diroma_session');
      return;
    }
    if (accounts.length > 0 || user) return;
    const saved = localStorage.getItem('onboarding_diroma_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as UserProfile;
        if (parsed?.email && resolveUserRole(parsed.email) === 'admin') {
          setUser({ ...parsed, role: 'admin', isAuthenticated: true, isDemo: true });
        }
      } catch {
        localStorage.removeItem('onboarding_diroma_session');
      }
    }
  }, [accounts.length, user]);

  const logout = () => {
    localStorage.removeItem('onboarding_diroma_session');
    localStorage.removeItem('onboarding_demo_user');
    setUser(null);
    if (msalSettings.configured && accounts.length > 0) {
      instance
        .logoutRedirect({ postLogoutRedirectUri: window.location.origin })
        .catch((err) => console.warn('Logout error:', err));
      return;
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

/** Sem Web Crypto (http://IP): não instancia MSAL — evita crash crypto_nonexistent */
const AuthProviderInsecure: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [msalSettings, setMsalSettings] = useState<MsalConfigState>(getStoredMsalSettings);
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('onboarding_diroma_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as UserProfile;
        if (parsed?.email && resolveUserRole(parsed.email) === 'admin') {
          setUser({ ...parsed, role: 'admin', isAuthenticated: true });
        }
      } catch {
        localStorage.removeItem('onboarding_diroma_session');
      }
    }
  }, []);

  const loginWithMicrosoft = async () => {
    throw new Error(
      'Microsoft Entra ID exige HTTPS. Use https://access.diroma.com.br (nginx). http://IP:porta não é contexto seguro para o login Microsoft.'
    );
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loginWithMicrosoft,
        logout: () => {
          setUser(null);
          localStorage.removeItem('onboarding_diroma_session');
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
  const [msalInstance] = useState(() => {
    if (!isSecureAuthContext()) return null;
    try {
      return createMsalInstance(getStoredMsalSettings());
    } catch {
      return null;
    }
  });

  if (!secure || !msalInstance) {
    return <AuthProviderInsecure>{children}</AuthProviderInsecure>;
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
