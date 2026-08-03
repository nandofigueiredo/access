import React from 'react';
import { useAuth } from '../auth/AuthContext';
import { LogOut, Search, Settings, ChevronRight } from 'lucide-react';
import { AppPage } from '../types/catalog';

interface HeaderProps {
  onOpenSettings: () => void;
  activeTab: AppPage;
  onAddClick: () => void;
}

const LABELS: Partial<Record<AppPage, { crumb: string; section: string }>> = {
  dashboard: { section: 'Assistência', crumb: 'Chamados' },
  onboarding: { section: 'Assistência', crumb: 'Novo Onboarding' },
  offboarding: { section: 'Assistência', crumb: 'Novo Offboarding' },
  'tools-reports': { section: 'Ferramentas', crumb: 'Relatórios' },
  'tools-export': { section: 'Ferramentas', crumb: 'Exportação' },
  'tools-notifications': { section: 'Ferramentas', crumb: 'Notificações' },
  'tools-terms': { section: 'Ferramentas', crumb: 'Termos' },
  'tools-workflow': { section: 'Ferramentas', crumb: 'Board Workflow' },
  'admin-users': { section: 'Administração', crumb: 'Usuários' },
  'admin-units': { section: 'Administração', crumb: 'Unidades' },
  'admin-managers': { section: 'Administração', crumb: 'Gestores' },
  'admin-queues': { section: 'Administração', crumb: 'Filas' },
  'admin-audit': { section: 'Administração', crumb: 'Auditoria' },
  'admin-domains': { section: 'Administração', crumb: 'Domínios' },
  'config-fields': { section: 'Configuração', crumb: 'Campos Automatizados' },
  'config-departments': { section: 'Configuração', crumb: 'Departamentos' },
  'config-positions': { section: 'Configuração', crumb: 'Cargos' },
  'config-workmodes': { section: 'Configuração', crumb: 'Modalidades' },
  'config-hardware': { section: 'Configuração', crumb: 'Hardware' },
  'config-peripherals': { section: 'Configuração', crumb: 'Periféricos' },
  'config-systems': { section: 'Configuração', crumb: 'Sistemas' },
  'config-checklist-onb': { section: 'Configuração', crumb: 'Checklist Onboarding' },
  'config-checklist-off': { section: 'Configuração', crumb: 'Checklist Offboarding' },
  'config-statuses': { section: 'Configuração', crumb: 'Status' },
  'config-assets': { section: 'Configuração', crumb: 'Ativos' },
  'config-return': { section: 'Configuração', crumb: 'Devolução' },
  'config-sla': { section: 'Configuração', crumb: 'SLA' },
  'config-smtp': { section: 'Configuração', crumb: 'SMTP / E-mail' },
  'config-workflow': { section: 'Configuração', crumb: 'Fluxo multiárea' },
  'config-entra': { section: 'Configuração', crumb: 'Entra ID' },
  'config-general': { section: 'Configuração', crumb: 'Geral' },
};

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export const Header: React.FC<HeaderProps> = ({ onOpenSettings, activeTab, onAddClick }) => {
  const { user, logout } = useAuth();
  const roleLabel = user?.role === 'admin' ? 'super-admin' : user?.role || 'user';
  const meta = LABELS[activeTab] || { section: 'Sistema', crumb: String(activeTab) };

  return (
    <header className="bg-white border-b border-[#f0f0f0] sticky top-0 z-30 px-4 py-2.5">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <nav className="flex items-center gap-1 text-[13px] text-slate-500">
            <span>Home</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <span>{meta.section}</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <span className="text-slate-800 font-medium">{meta.crumb}</span>
          </nav>

          {(activeTab === 'dashboard' || activeTab === 'onboarding' || activeTab === 'offboarding') && (
            <button
              type="button"
              onClick={onAddClick}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-sm text-[12px] font-semibold text-white bg-[#002d5b] hover:bg-[#001529] transition ml-0 lg:ml-3"
            >
              + Adicionar
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="relative flex-1 sm:w-56 lg:w-72">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="search"
              placeholder="Search"
              className="w-full border border-slate-200 rounded-sm pl-8 pr-2 py-1.5 text-[12px] focus:outline-none focus:border-[#1890ff]"
            />
          </div>

          {user && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <button
                type="button"
                onClick={onOpenSettings}
                className="p-1.5 text-slate-500 hover:text-[#002d5b] rounded hover:bg-slate-50"
                title="Configurações MSAL"
              >
                <Settings className="w-4 h-4" />
              </button>

              <div className="hidden md:block text-right leading-tight">
                <div className="text-[11px] font-semibold text-slate-800">{roleLabel}</div>
                <div className="text-[10px] text-slate-400 truncate max-w-[140px]">{user.email}</div>
              </div>

              <div className="w-8 h-8 rounded-full bg-[#002d5b] text-white text-[11px] font-bold flex items-center justify-center shrink-0" title={user.name}>
                {user.photoUrl ? (
                  <img src={user.photoUrl} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  initials(user.name || user.email)
                )}
              </div>

              <button id="btn-logout" type="button" onClick={logout} className="p-1.5 text-slate-500 hover:text-rose-600 rounded hover:bg-rose-50" title="Sair">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
