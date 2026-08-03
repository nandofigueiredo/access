import React, { useMemo, useState } from 'react';
import {
  LayoutDashboard,
  UserPlus,
  UserMinus,
  Ticket,
  ChevronDown,
  ChevronLeft,
  Search,
  Settings,
  Wrench,
  Shield,
  Menu,
  BarChart3,
  Download,
  Mail,
  FileText,
  Users,
  Building2,
  UserCog,
  Layers,
  ScrollText,
  Globe,
  FormInput,
  Briefcase,
  Laptop,
  MousePointer2,
  AppWindow,
  ListChecks,
  Flag,
  Package,
  Truck,
  Timer,
  KeyRound,
  SlidersHorizontal,
  GitBranch,
  Server,
} from 'lucide-react';
import { DiRomaLogo } from './DiRomaLogo';
import { Ticket as TicketType } from '../types';
import { AppPage } from '../types/catalog';
import { useAuth } from '../auth/AuthContext';

interface SidebarProps {
  activeTab: AppPage;
  setActiveTab: (tab: AppPage) => void;
  tickets: TicketType[];
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

type NavItem = { id: AppPage; label: string; icon: React.ReactNode; adminOnly?: boolean };

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  tickets,
  collapsed = false,
  onToggleCollapse,
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [menuSearch, setMenuSearch] = useState('');
  const [open, setOpen] = useState({
    assistencia: true,
    ferramentas: true,
    administracao: true,
    configuracao: true,
  });

  const pendingCount = tickets.filter((t) => t.status === 'Pendente TI').length;

  const sections = useMemo(() => {
    const assistencia: NavItem[] = [
      { id: 'dashboard', label: 'Chamados', icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
      { id: 'onboarding', label: 'Novo Onboarding', icon: <UserPlus className="w-3.5 h-3.5" /> },
      { id: 'offboarding', label: 'Novo Offboarding', icon: <UserMinus className="w-3.5 h-3.5" /> },
    ];
    const ferramentas: NavItem[] = [
      { id: 'tools-workflow', label: 'Board Workflow', icon: <GitBranch className="w-3.5 h-3.5" /> },
      { id: 'tools-reports', label: 'Relatórios', icon: <BarChart3 className="w-3.5 h-3.5" /> },
      { id: 'tools-export', label: 'Exportação', icon: <Download className="w-3.5 h-3.5" /> },
      { id: 'tools-notifications', label: 'Notificações', icon: <Mail className="w-3.5 h-3.5" /> },
      { id: 'tools-terms', label: 'Termos / Templates', icon: <FileText className="w-3.5 h-3.5" /> },
    ];
    const administracao: NavItem[] = [
      { id: 'admin-users', label: 'Usuários & Perfis', icon: <Users className="w-3.5 h-3.5" />, adminOnly: true },
      { id: 'admin-units', label: 'Unidades', icon: <Building2 className="w-3.5 h-3.5" />, adminOnly: true },
      { id: 'admin-managers', label: 'Gestores', icon: <UserCog className="w-3.5 h-3.5" />, adminOnly: true },
      { id: 'admin-queues', label: 'Filas Service Desk', icon: <Layers className="w-3.5 h-3.5" />, adminOnly: true },
      { id: 'admin-audit', label: 'Auditoria', icon: <ScrollText className="w-3.5 h-3.5" />, adminOnly: true },
      { id: 'admin-domains', label: 'Domínios', icon: <Globe className="w-3.5 h-3.5" />, adminOnly: true },
    ];
    const configuracao: NavItem[] = [
      { id: 'config-fields', label: 'Campos Automatizados', icon: <FormInput className="w-3.5 h-3.5" />, adminOnly: true },
      { id: 'config-departments', label: 'Departamentos', icon: <Building2 className="w-3.5 h-3.5" />, adminOnly: true },
      { id: 'config-positions', label: 'Cargos', icon: <Briefcase className="w-3.5 h-3.5" />, adminOnly: true },
      { id: 'config-workmodes', label: 'Modalidades', icon: <SlidersHorizontal className="w-3.5 h-3.5" />, adminOnly: true },
      { id: 'config-hardware', label: 'Perfis Hardware', icon: <Laptop className="w-3.5 h-3.5" />, adminOnly: true },
      { id: 'config-peripherals', label: 'Periféricos', icon: <MousePointer2 className="w-3.5 h-3.5" />, adminOnly: true },
      { id: 'config-systems', label: 'Sistemas & Acessos', icon: <AppWindow className="w-3.5 h-3.5" />, adminOnly: true },
      { id: 'config-checklist-onb', label: 'Checklist Onboarding', icon: <ListChecks className="w-3.5 h-3.5" />, adminOnly: true },
      { id: 'config-checklist-off', label: 'Checklist Offboarding', icon: <ListChecks className="w-3.5 h-3.5" />, adminOnly: true },
      { id: 'config-statuses', label: 'Status & Workflow', icon: <Flag className="w-3.5 h-3.5" />, adminOnly: true },
      { id: 'config-assets', label: 'Tipos de Ativos', icon: <Package className="w-3.5 h-3.5" />, adminOnly: true },
      { id: 'config-return', label: 'Devolução', icon: <Truck className="w-3.5 h-3.5" />, adminOnly: true },
      { id: 'config-sla', label: 'SLA', icon: <Timer className="w-3.5 h-3.5" />, adminOnly: true },
      { id: 'config-smtp', label: 'SMTP / E-mail', icon: <Server className="w-3.5 h-3.5" />, adminOnly: true },
      { id: 'config-workflow', label: 'Fluxo multiárea', icon: <GitBranch className="w-3.5 h-3.5" />, adminOnly: true },
      { id: 'config-entra', label: 'Entra ID / SSO', icon: <KeyRound className="w-3.5 h-3.5" />, adminOnly: true },
      { id: 'config-general', label: 'Geral', icon: <Settings className="w-3.5 h-3.5" />, adminOnly: true },
    ];

    const filter = (items: NavItem[]) =>
      items.filter((i) => {
        if (i.adminOnly && !isAdmin) return false;
        if (!menuSearch.trim()) return true;
        return i.label.toLowerCase().includes(menuSearch.toLowerCase());
      });

    return {
      assistencia: filter(assistencia),
      ferramentas: filter(ferramentas),
      administracao: filter(administracao),
      configuracao: filter(configuracao),
    };
  }, [isAdmin, menuSearch]);

  const itemClass = (active: boolean) =>
    `w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition rounded-sm ${
      active ? 'bg-[#1890ff] text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
    }`;

  const Section = ({
    title,
    icon,
    openKey,
    items,
  }: {
    title: string;
    icon: React.ReactNode;
    openKey: keyof typeof open;
    items: NavItem[];
  }) => {
    if (items.length === 0) return null;
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen((o) => ({ ...o, [openKey]: !o[openKey] }))}
          className="w-full flex items-center justify-between px-3 py-2 text-[13px] text-white/85 hover:bg-white/10 rounded-sm"
        >
          <span className="flex items-center gap-2.5">
            {icon}
            {title}
          </span>
          <ChevronDown className={`w-3.5 h-3.5 transition ${open[openKey] ? 'rotate-180' : ''}`} />
        </button>
        {open[openKey] && (
          <div className="ml-2 border-l border-white/10 pl-1 space-y-0.5 mb-2">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`${itemClass(activeTab === item.id)} justify-between`}
              >
                <span className="flex items-center gap-2.5">
                  {item.icon}
                  {item.label}
                </span>
                {item.id === 'dashboard' && pendingCount > 0 && (
                  <span className="bg-white/20 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pendingCount}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </>
    );
  };

  if (collapsed) {
    return (
      <aside className="hidden lg:flex w-14 bg-[#001529] flex-col items-center py-3 shrink-0">
        <button type="button" onClick={onToggleCollapse} className="text-white/70 hover:text-white p-2">
          <Menu className="w-5 h-5" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-full lg:w-[260px] bg-[#001529] text-white flex flex-col shrink-0 min-h-0 lg:min-h-screen">
      <div className="px-4 py-4 border-b border-white/10">
        <DiRomaLogo inverted compact />
      </div>

      <div className="px-3 py-3">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-white/40" />
          <input
            type="search"
            value={menuSearch}
            onChange={(e) => setMenuSearch(e.target.value)}
            placeholder="Search for a menu"
            className="w-full bg-[#000c17] border border-white/10 rounded text-[12px] text-white placeholder:text-white/35 pl-8 pr-2 py-2 focus:outline-none focus:border-[#1890ff]"
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        <div className="px-2 py-1.5 text-[11px] uppercase tracking-wider text-white/40 font-semibold">Assistência</div>
        <Section title="Assistência" icon={<Ticket className="w-4 h-4" />} openKey="assistencia" items={sections.assistencia} />

        <div className="pt-2 px-2 py-1.5 text-[11px] uppercase tracking-wider text-white/40 font-semibold">Sistema</div>
        <Section title="Ferramentas" icon={<Wrench className="w-4 h-4" />} openKey="ferramentas" items={sections.ferramentas} />
        {isAdmin && (
          <Section title="Administração" icon={<Shield className="w-4 h-4" />} openKey="administracao" items={sections.administracao} />
        )}
        {isAdmin && (
          <Section title="Configuração" icon={<Settings className="w-4 h-4" />} openKey="configuracao" items={sections.configuracao} />
        )}
      </nav>

      <button
        type="button"
        onClick={onToggleCollapse}
        className="hidden lg:flex items-center gap-2 px-4 py-3 border-t border-white/10 text-[12px] text-white/60 hover:text-white hover:bg-white/5"
      >
        <ChevronLeft className="w-4 h-4" />
        Collapse menu
      </button>
    </aside>
  );
};
