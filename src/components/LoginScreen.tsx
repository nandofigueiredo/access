import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { DiRomaLogo } from './DiRomaLogo';
import { Settings2, Shield, CheckCircle2 } from 'lucide-react';
import { ACCESS_PROFILES, AccessRole, getProfile } from '../auth/roles';
import { isDemoLoginEnabled } from '../auth/msalConfig';

interface LoginScreenProps {
  onOpenSettings: () => void;
}

const FUNDO_SRC = '/img/fundo.jpg';

export const LoginScreen: React.FC<LoginScreenProps> = ({ onOpenSettings }) => {
  const { loginWithMicrosoft, loginAsProfile, secureContext } = useAuth();
  const [selectedRole, setSelectedRole] = useState<AccessRole>('ti');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const demoOk = isDemoLoginEnabled();
  const selected = getProfile(selectedRole);

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

  const handleProfileLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await loginAsProfile(selectedRole);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar com este perfil.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white">
      <section className="w-full lg:w-[46%] xl:w-[42%] flex flex-col justify-between px-6 sm:px-10 py-6 relative z-10 bg-white overflow-y-auto">
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

        <div className="flex-1 flex flex-col justify-center max-w-xl mx-auto w-full py-4">
          <div className="flex justify-center mb-6">
            <DiRomaLogo sizeClass="h-16 sm:h-20" />
          </div>

          <div className="text-center mb-6">
            <h1 className="text-xl sm:text-2xl font-bold text-[#002d5b] leading-tight">
              Portal de Onboarding &amp; Offboarding
            </h1>
            <p className="mt-2 text-[13px] text-slate-500 leading-relaxed">
              Escolha o perfil de acesso. Admin é exclusivo da equipe N3; demais cargos entram
              apenas nas funções do seu papel.
            </p>
          </div>

          <div className="space-y-2.5 mb-6">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              Perfis de acesso
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ACCESS_PROFILES.map((profile) => {
                const active = selectedRole === profile.role;
                return (
                  <button
                    key={profile.role}
                    type="button"
                    onClick={() => setSelectedRole(profile.role)}
                    className={`text-left rounded-md border px-3 py-2.5 transition ${
                      active ? 'shadow-sm' : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                    style={
                      active
                        ? {
                            borderColor: profile.color,
                            backgroundColor: `${profile.color}14`,
                            boxShadow: `0 0 0 2px ${profile.color}55`,
                          }
                        : undefined
                    }
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] font-bold text-slate-800">{profile.title}</span>
                          {profile.featured && (
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded text-white bg-[#722ed1]">
                              N3
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-semibold mt-0.5" style={{ color: profile.color }}>
                          {profile.badge}
                        </div>
                      </div>
                      {active && <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: profile.color }} />}
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-500 leading-snug line-clamp-2">
                      {profile.description}
                    </p>
                  </button>
                );
              })}
            </div>

            <div
              className="rounded-md border px-3 py-2.5 text-[12px] text-slate-600"
              style={{ borderColor: `${selected.color}55`, backgroundColor: `${selected.color}0d` }}
            >
              <div className="font-semibold text-slate-800 mb-1">Acessos de {selected.title}</div>
              <ul className="space-y-0.5">
                {selected.accessSummary.map((item) => (
                  <li key={item} className="flex items-start gap-1.5">
                    <span className="mt-1 w-1 h-1 rounded-full shrink-0" style={{ background: selected.color }} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="space-y-3">
            {!secureContext && (
              <div className="text-[12px] text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3 py-2.5 leading-relaxed">
                <strong>HTTPS obrigatório para Microsoft.</strong> Use{' '}
                <strong>https://access.diroma.com.br</strong> ou entre pelo perfil em modo demo.
              </div>
            )}

            {demoOk && (
              <button
                type="button"
                onClick={handleProfileLogin}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 text-white font-semibold py-3 px-4 rounded-md transition active:scale-[0.99] disabled:opacity-60"
                style={{ backgroundColor: selected.color }}
              >
                <span className="text-sm">
                  {isLoading ? 'Entrando…' : `Entrar como ${selected.title}`}
                </span>
              </button>
            )}

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
                {isLoading ? 'Autenticando…' : 'Acessar com Microsoft'}
              </span>
            </button>

            {error && (
              <p className="text-[12px] text-rose-600 bg-rose-50 border border-rose-100 rounded-md px-3 py-2 text-center">
                {error}
              </p>
            )}

            <p className="text-[11px] text-slate-400 text-center leading-relaxed">
              Contas <strong className="text-slate-600">@diroma.com.br</strong>. O perfil Microsoft
              prevalece no SSO; Admin permanece restrito à equipe N3.
            </p>
          </div>
        </div>

        <footer className="text-[11px] text-slate-400 space-y-2 text-center pt-4">
          <p>diRoma.com.br — Todos os direitos reservados. {new Date().getFullYear()}</p>
        </footer>
      </section>

      <section className="hidden lg:block flex-1 relative overflow-hidden bg-[#001529]">
        <img
          src={FUNDO_SRC}
          alt="diRoma hotéis e parques"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#001529]/75 via-[#001529]/20 to-[#001529]/35" />
        <div className="absolute top-10 left-10 right-10 text-white max-w-xl">
          <p className="text-lg font-semibold drop-shadow">Níveis de acesso do portal</p>
          <p className="mt-2 text-sm text-white/90 drop-shadow">
            RH solicita · Service Desk executa · N3 integra · Admin só para equipe N3.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-white/90">
            {ACCESS_PROFILES.map((p) => (
              <li key={p.role} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
                <strong>{p.title}</strong>
                <span className="text-white/70">— {p.badge}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
};
