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

  return (
    <aside className="w-full lg:w-64 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 p-4 shrink-0">
      <nav className="flex lg:flex-col gap-2">
        {/* Painel de Gestão */}
        <button
          id="tab-dashboard"
          onClick={() => setActiveTab('dashboard')}
          className={`flex-1 lg:flex-none flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-150 ${
            activeTab === 'dashboard'
              ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
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
                  ? 'bg-blue-200/60 text-blue-900'
                  : 'bg-amber-100 text-amber-800 border border-amber-200'
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
              ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
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
              ? 'bg-rose-50 text-rose-700 font-bold border border-rose-200 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <UserMinus className="w-4 h-4 shrink-0" />
          <span>Novo Offboarding</span>
        </button>
      </nav>

      {/* Info Card on Large Screens */}
      <div className="hidden lg:block mt-8 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2">
        <div className="flex items-center gap-1.5 font-bold text-slate-800">
          <ShieldCheck className="w-4 h-4 text-blue-600" />
          <span>SLA e Governança TI</span>
        </div>
        <p className="leading-relaxed text-[11px] text-slate-500">
          - Onboarding requer mínimo de <strong>5 dias úteis</strong> de antecedência.
          <br />
          - Offboarding executa bloqueio <strong>Zero-Day</strong> imediato no Entra ID.
        </p>
      </div>
    </aside>
  );
};
