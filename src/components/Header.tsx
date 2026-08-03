import React from 'react';
import { useAuth } from '../auth/AuthContext';
import { Cpu, LogOut, Shield, Settings, User } from 'lucide-react';

interface HeaderProps {
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSettings }) => {
  const { user, logout, msalSettings } = useAuth();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 sm:px-6 py-3.5 text-slate-800 shadow-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand & Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-sm">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-slate-900">
                Gestão TI
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-[10px] font-bold text-blue-700">
                Entra ID SSO
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              Onboarding, Offboarding & Governança LGPD
            </p>
          </div>
        </div>

        {/* Right Section: User Info & Actions */}
        {user && (
          <div className="flex items-center gap-3">
            {/* MSAL Tenant Config Button */}
            <button
              onClick={onOpenSettings}
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition"
              title="Configurações do Entra ID MSAL"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* User Profile Badge */}
            <div className="flex items-center gap-2.5 pl-2 sm:pl-3 border-l border-slate-200">
              {user.photoUrl ? (
                <img
                  src={user.photoUrl}
                  alt={user.name}
                  className="w-8 h-8 rounded-full object-cover ring-2 ring-blue-500/20"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  {user.name.charAt(0)}
                </div>
              )}

              <div className="text-left hidden md:block">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-800">{user.name}</span>
                  {user.isDemo && (
                    <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-mono font-bold">
                      DEMO
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-500 block truncate max-w-[180px]">
                  {user.email}
                </span>
              </div>

              {/* Logout Button */}
              <button
                id="btn-logout"
                onClick={logout}
                className="ml-1 sm:ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition"
                title="Sair da conta Microsoft"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
