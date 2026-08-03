import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ShieldCheck, Cpu, UserCheck, Lock, Settings2, FileText } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginScreenProps {
  onOpenSettings: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onOpenSettings }) => {
  const { loginWithMicrosoft, loginDemo, msalSettings } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleMicrosoftLogin = async () => {
    setIsLoading(true);
    try {
      await loginWithMicrosoft();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-blue-600 selection:text-white">
      {/* Background Decorative Gradients */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 -right-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl"></div>
      </div>

      {/* Top Header Bar */}
      <header className="relative z-10 max-w-7xl w-full mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-white/20">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Portal TI
            </h1>
            <p className="text-xs text-slate-400">Gestão de Onboarding & Offboarding</p>
          </div>
        </div>

        <button
          onClick={onOpenSettings}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition"
          title="Configurar Microsoft Entra ID Tenant"
        >
          <Settings2 className="w-3.5 h-3.5 text-blue-400" />
          <span>Configuração MSAL</span>
        </button>
      </header>

      {/* Main Login Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="max-w-md w-full bg-slate-900/90 border border-slate-800/80 rounded-2xl p-8 shadow-2xl backdrop-blur-xl"
        >
          {/* Entra ID Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-6">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Microsoft Entra ID (MSAL SSO)</span>
          </div>

          <h2 className="text-2xl font-bold text-white tracking-tight">
            Acesso Corporativo
          </h2>
          <p className="mt-2 text-sm text-slate-400 leading-relaxed">
            Faça login com sua conta institucional Microsoft para gerenciar provisionamento e desligamento de acessos de TI.
          </p>

          {/* Microsoft Official Button */}
          <div className="mt-8 space-y-3">
            <button
              id="btn-login-microsoft"
              onClick={handleMicrosoftLogin}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 bg-slate-900 hover:bg-slate-800 text-white font-medium py-3.5 px-4 rounded-xl border border-slate-700 hover:border-slate-600 shadow-md transition-all duration-200 active:scale-[0.99] disabled:opacity-50 group"
            >
              {/* Microsoft 4-Color Grid Logo */}
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
              </svg>
              <span className="text-sm font-semibold">
                {isLoading ? 'Autenticando...' : 'Entrar com a conta Microsoft'}
              </span>
            </button>

            {/* Divider */}
            <div className="relative py-3 flex items-center">
              <div className="flex-grow border-t border-slate-800"></div>
              <span className="flex-shrink mx-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
                ou acesso rápido
              </span>
              <div className="flex-grow border-t border-slate-800"></div>
            </div>

            {/* Demo Access Options */}
            <div className="grid grid-cols-2 gap-2">
              <button
                id="btn-login-demo-admin"
                onClick={() => loginDemo('admin')}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-xs font-medium text-slate-200 hover:text-white transition"
              >
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Gestor TI (Demo)</span>
              </button>
              <button
                id="btn-login-demo-rh"
                onClick={() => loginDemo('rh')}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-xs font-medium text-slate-200 hover:text-white transition"
              >
                <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                <span>Analista RH (Demo)</span>
              </button>
            </div>
          </div>

          {/* MSAL Status indicator */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${msalSettings.configured ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
              {msalSettings.configured ? 'MSAL Conectado ao Tenant' : 'Modo Demonstrativo Habilitado'}
            </span>
            <button
              onClick={onOpenSettings}
              className="text-blue-400 hover:underline"
            >
              Ajustar Tenant
            </button>
          </div>
        </motion.div>
      </main>

      {/* Footer LGPD notice */}
      <footer className="relative z-10 max-w-7xl w-full mx-auto px-6 py-6 border-t border-slate-900 text-center text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-400">
          <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>Sistema em conformidade com a LGPD (Lei nº 13.709/2018)</span>
        </div>
        <div className="flex items-center gap-4 text-slate-400">
          <span className="flex items-center gap-1">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            Minimização de Dados Ativa
          </span>
          <span>SLA Padrão: 5 dias úteis</span>
        </div>
      </footer>
    </div>
  );
};
