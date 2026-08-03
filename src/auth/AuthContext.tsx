import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { MsalProvider, useMsal } from '@azure/msal-react';
import { PublicClientApplication } from '@azure/msal-browser';
import { UserProfile, MsalConfigState } from '../types';
import { createMsalInstance, getStoredMsalSettings, loginRequest, saveMsalSettings } from './msalConfig';

interface AuthContextType {
  user: UserProfile | null;
  loginWithMicrosoft: () => Promise<void>;
  loginDemo: (role?: 'admin' | 'rh' | 'gestor') => void;
  logout: () => void;
  msalSettings: MsalConfigState;
  updateMsalSettings: (settings: MsalConfigState) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_USER_ADMIN: UserProfile = {
  name: 'Ana Paula Souza',
  email: 'ana.souza@empresa.com.br',
  jobTitle: 'Coordenadora de TI & Segurança',
  department: 'TI',
  photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
  tenantId: 'e8d1a123-entra-id-demo-tenant',
  isAuthenticated: true,
  isDemo: true,
};

const DEMO_USER_RH: UserProfile = {
  name: 'Carlos Alberto Lima',
  email: 'carlos.lima@empresa.com.br',
  jobTitle: 'Especialista em DHO & RH',
  department: 'RH',
  photoUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80',
  tenantId: 'e8d1a123-entra-id-demo-tenant',
  isAuthenticated: true,
  isDemo: true,
};

interface AuthProviderInnerProps {
  children: ReactNode;
  msalInstance: PublicClientApplication;
  msalSettings: MsalConfigState;
  setMsalSettings: React.Dispatch<React.SetStateAction<MsalConfigState>>;
}

const AuthProviderInner: React.FC<AuthProviderInnerProps> = ({
  children,
  msalSettings,
  setMsalSettings,
}) => {
  const { instance, accounts } = useMsal();
  const [user, setUser] = useState<UserProfile | null>(() => {
    const savedDemo = localStorage.getItem('onboarding_demo_user');
    if (savedDemo) {
      try {
        return JSON.parse(savedDemo);
      } catch {
        // ignore
      }
    }
    return null;
  });

  useEffect(() => {
    if (accounts.length > 0 && !user?.isDemo) {
      const account = accounts[0];
      setUser({
        name: account.name || account.username || 'Usuário Microsoft',
        email: account.username,
        jobTitle: 'Colaborador Entra ID',
        department: 'Corporativo',
        tenantId: account.tenantId,
        isAuthenticated: true,
        isDemo: false,
      });
    }
  }, [accounts]);

  const loginWithMicrosoft = async () => {
    try {
      if (!msalSettings.configured || msalSettings.clientId === '00000000-0000-0000-0000-000000000000') {
        // If MSAL is not configured with a real Client ID, simulate smooth MSAL authentication
        loginDemo('admin');
        return;
      }
      const response = await instance.loginPopup(loginRequest);
      if (response && response.account) {
        setUser({
          name: response.account.name || response.account.username,
          email: response.account.username,
          jobTitle: 'Colaborador Microsoft Entra ID',
          department: 'Corporativo',
          tenantId: response.account.tenantId,
          isAuthenticated: true,
          isDemo: false,
        });
        localStorage.removeItem('onboarding_demo_user');
      }
    } catch (err: any) {
      console.warn('MSAL Login Popup failed or cancelled:', err);
      // Fallback to demo mode gracefully if Azure popup is blocked or unconfigured
      loginDemo('admin');
    }
  };

  const loginDemo = (role: 'admin' | 'rh' | 'gestor' = 'admin') => {
    const demoProfile = role === 'rh' ? DEMO_USER_RH : DEMO_USER_ADMIN;
    setUser(demoProfile);
    localStorage.setItem('onboarding_demo_user', JSON.stringify(demoProfile));
  };

  const logout = () => {
    if (user && !user.isDemo && accounts.length > 0) {
      instance.logoutPopup({
        postLogoutRedirectUri: window.location.origin,
      }).catch(err => console.warn('Logout error:', err));
    }
    setUser(null);
    localStorage.removeItem('onboarding_demo_user');
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
        loginDemo,
        logout,
        msalSettings,
        updateMsalSettings,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [msalSettings, setMsalSettings] = useState<MsalConfigState>(getStoredMsalSettings);
  const [msalInstance] = useState(() => createMsalInstance(msalSettings));

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
