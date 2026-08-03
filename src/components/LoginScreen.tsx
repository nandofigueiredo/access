import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { DiRomaLogo } from './DiRomaLogo';
import { Settings2 } from 'lucide-react';

interface LoginScreenProps {
  onOpenSettings: () => void;
}

const FUNDO_SRC = '/img/fundo.jpg';

export const LoginScreen: React.FC<LoginScreenProps> = ({ onOpenSettings }) => {
  const { loginWithMicrosoft, secureContext, authError, clearAuthError } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authError) {
      setError(authError);
      clearAuthError();
    }
  }, [authError, clearAuthError]);

  const handleMicrosoftLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await loginWithMicrosoft();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na autenticação Microsoft.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left — Auth panel */}
      <section className="w-full lg:w-[38%] xl:w-[34%] flex flex-col justify-between px-8 sm:px-12 py-8 relative z-10 bg-white">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onOpenSettings}
            className="p-2 rounded-md text-slate-400 hover:text-[#002d5b] hover:bg-slate-50 transition shrink-0"
            title="Configurar Microsoft Entra ID"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full py-6">
          <div className="flex justify-center mb-8">
            <DiRomaLogo sizeClass="h-20 sm:h-24" />
          </div>

          <div className="text-center">
            <h1 className="text-2xl sm:text-[1.7rem] font-bold text-[#002d5b] leading-tight">
              Portal de Onboarding &amp; Offboarding
            </h1>
            <p className="mt-4 text-sm text-slate-500 leading-relaxed">
              Quando um colaborador é contratado, o RH registra o onboarding com a data de início
              e a solicitação segue para o Service Desk provisionar acessos e equipamentos.
              Em caso de desligamento, o RH abre o offboarding para a TI revogar acessos e recolher ativos.
            </p>
          </div>

          <div className="mt-10 space-y-4">
            {!secureContext && (
              <div className="text-[12px] text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3 py-2.5 leading-relaxed">
                <strong>HTTPS obrigatório para Microsoft.</strong> Você abriu via{' '}
                <code className="text-[11px]">http://IP</code>, que não é contexto seguro.
                Acesse <strong>https://access.diroma.com.br</strong> (nginx com SSL).
              </div>
            )}

            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 text-center">
              Acesso exclusivo via Microsoft Entra ID
            </p>

            <button
              id="btn-login-microsoft"
              type="button"
              onClick={handleMicrosoftLogin}
              disabled={isLoading || !secureContext}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-800 font-semibold py-3.5 px-4 rounded-md border border-slate-300 shadow-sm transition active:scale-[0.99] disabled:opacity-60"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 21 21" aria-hidden>
                <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
              </svg>
              <span className="text-sm">
                {isLoading ? 'Autenticando...' : 'Acessar com Microsoft'}
              </span>
            </button>

            {error && (
              <p className="text-[12px] text-rose-600 bg-rose-50 border border-rose-100 rounded-md px-3 py-2 text-center">
                {error}
              </p>
            )}

            <p className="text-[11px] text-slate-400 text-center leading-relaxed">
              Somente contas <strong className="text-slate-600">@diroma.com.br</strong> autorizadas.
            </p>
          </div>
        </div>

        <footer className="text-[11px] text-slate-400 space-y-2 text-center">
          <div className="flex flex-wrap gap-3 justify-center">
            <a href="#" className="hover:text-[#002d5b]">Privacidade</a>
            <a href="#" className="hover:text-[#002d5b]">Termos de Uso</a>
            <a href="#" className="hover:text-[#002d5b]">Contato</a>
          </div>
          <p>diRoma.com.br — Todos os direitos reservados. {new Date().getFullYear()}</p>
        </footer>
      </section>

      {/* Right — Hero com fundo.jpg oficial */}
      <section className="hidden lg:block flex-1 relative overflow-hidden bg-[#001529]">
        <img
          src={FUNDO_SRC}
          alt="diRoma hotéis e parques"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#001529]/75 via-[#001529]/20 to-[#001529]/35" />
        <div className="absolute top-10 left-10 right-10 text-white max-w-xl">
          <p className="text-lg font-semibold drop-shadow">
            Portal TI — Onboarding &amp; Offboarding
          </p>
          <p className="mt-2 text-sm text-white/90 drop-shadow">
            RH solicita · Service Desk executa · Acessos e ativos sob controle.
          </p>
        </div>
      </section>
    </div>
  );
};
