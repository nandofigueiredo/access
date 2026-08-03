import React from 'react';
import { LayoutDashboard, UserPlus, UserMinus, ShieldCheck, HelpCircle } from 'lucide-react';
import { Ticket } from '../types';

export type ActiveTab = 'dashboard' | 'onboarding' | 'offboarding';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  tickets: Ticket[];
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, tickets }) => {
  const pendingCount = tickets.filter(t => t.status === 'Pendente TI').length;
  const inProgressCount = tickets.filter(t => t.status === 'Em Andamento').length;

  return (
    <aside className="w-full lg:w-64 bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-800 p-4 shrink-0">
      <nav className="flex lg:flex-col gap-2">
        {/* Painel de Gestão */}
        <button
          id="tab-dashboard"
          onClick={() => setActiveTab('dashboard')}
          className={`flex-1 lg:flex-none flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-150 ${
            activeTab === 'dashboard'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
          }`}
        >
          <div className="flex items-center gap-3">
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            <span>Painel de Gestão</span>
          </div>
          {pendingCount > 0 && (
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === 'dashboard'
                  ? 'bg-white/20 text-white'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}
            >
              {pendingCount}
            </span>
          )}
        </button>

        {/* Novo Onboarding */}
        <button
          id="tab-onboarding"
          onClick={() => setActiveTab('onboarding')}
          className={`flex-1 lg:flex-none flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-150 ${
            activeTab === 'onboarding'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
          }`}
        >
          <UserPlus className="w-4 h-4 shrink-0" />
          <span>Novo Onboarding</span>
        </button>

        {/* Novo Offboarding */}
        <button
          id="tab-offboarding"
          onClick={() => setActiveTab('offboarding')}
          className={`flex-1 lg:flex-none flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-150 ${
            activeTab === 'offboarding'
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
          }`}
        >
          <UserMinus className="w-4 h-4 shrink-0" />
          <span>Novo Offboarding</span>
        </button>
      </nav>

      {/* Info Card on Large Screens */}
      <div className="hidden lg:block mt-8 p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 space-y-2">
        <div className="flex items-center gap-1.5 font-semibold text-slate-300">
          <ShieldCheck className="w-4 h-4 text-blue-400" />
          <span>SLA e Governança TI</span>
        </div>
        <p className="leading-relaxed text-[11px] text-slate-400">
          - Onboarding requer mínimo de <strong>5 dias úteis</strong> de antecedência.
          <br />
          - Offboarding executa bloqueio <strong>Zero-Day</strong> imediato no Entra ID.
        </p>
      </div>
    </aside>
  );
};
