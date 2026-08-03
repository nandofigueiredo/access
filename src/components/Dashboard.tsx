import React, { useState } from 'react';
import { Ticket, TicketStatus, TicketType, Department, ToastMessage } from '../types';
import { formatDateToBR, formatDateTimeToBR, evaluateOnboardingSLA } from '../utils/formatters';
import {
  LayoutDashboard,
  Search,
  Filter,
  UserPlus,
  UserMinus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Download,
  Eye,
  Trash2,
  ChevronRight,
  ShieldCheck,
  Building2
} from 'lucide-react';

interface DashboardProps {
  tickets: Ticket[];
  onSelectTicket: (ticket: Ticket) => void;
  onUpdateStatus: (ticketId: string, newStatus: TicketStatus) => void;
  onDeleteTicket: (ticketId: string) => void;
  onNavigateNewOnboarding: () => void;
  onNavigateNewOffboarding: () => void;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  onPrintTerm: (ticket: Ticket) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  tickets,
  onSelectTicket,
  onUpdateStatus,
  onDeleteTicket,
  onNavigateNewOnboarding,
  onNavigateNewOffboarding,
  addToast,
  onPrintTerm,
}) => {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | TicketType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | TicketStatus>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');

  // Stats Counters
  const totalCount = tickets.length;
  const pendingCount = tickets.filter((t) => t.status === 'Pendente TI').length;
  const inProgressCount = tickets.filter((t) => t.status === 'Em Andamento').length;
  const completedCount = tickets.filter((t) => t.status === 'Concluído').length;

  const slaAlertCount = tickets.filter((t) => {
    if (t.type === 'onboarding' && t.status !== 'Concluído') {
      const sla = evaluateOnboardingSLA(t.dataInicio);
      return sla.status === 'warning' || sla.status === 'expired';
    }
    return false;
  }).length;

  // Filter Logic
  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch =
      ticket.nomeCompleto.toLowerCase().includes(search.toLowerCase()) ||
      ticket.id.toLowerCase().includes(search.toLowerCase()) ||
      (ticket.type === 'onboarding' ? ticket.emailPessoal : ticket.emailCorporativo)
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      ticket.gestor.toLowerCase().includes(search.toLowerCase());

    const matchesType = typeFilter === 'all' || ticket.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    const matchesDept =
      deptFilter === 'all' || (ticket.type === 'onboarding' ? ticket.departamento === deptFilter : true);

    return matchesSearch && matchesType && matchesStatus && matchesDept;
  });

  const exportToCSV = () => {
    if (tickets.length === 0) return;

    const headers = [
      'ID',
      'Tipo',
      'Status',
      'Nome Colaborador',
      'E-mail',
      'Gestor',
      'Data Criacao',
      'Data Evento/Inicio',
    ];

    const rows = tickets.map((t) => [
      t.id,
      t.type,
      t.status,
      `"${t.nomeCompleto}"`,
      t.type === 'onboarding' ? t.emailPessoal : t.emailCorporativo,
      `"${t.gestor}"`,
      formatDateToBR(t.createdAt),
      t.type === 'onboarding' ? formatDateToBR(t.dataInicio) : formatDateTimeToBR(t.dataHoraDesligamento),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `relatorio_gestao_ti_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast({
      type: 'info',
      title: 'Relatório CSV Exportado',
      message: `${tickets.length} registros exportados para auditoria de TI.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-blue-400" />
            Painel de Gestão de Onboarding e Offboarding
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Acompanhe o ciclo de vida de colaboradores, SLAs de provisionamento e revogações no Entra ID.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onNavigateNewOnboarding}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md transition active:scale-[0.99]"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Onboarding</span>
          </button>

          <button
            onClick={onNavigateNewOffboarding}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 shadow-md transition active:scale-[0.99]"
          >
            <UserMinus className="w-4 h-4" />
            <span>+ Offboarding</span>
          </button>

          <button
            onClick={exportToCSV}
            className="p-2 rounded-xl text-slate-300 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 transition"
            title="Exportar Relatório CSV"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Total */}
        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 space-y-1">
          <span className="text-xs text-slate-400 font-medium block">Total Solicitações</span>
          <div className="text-2xl font-bold text-white">{totalCount}</div>
          <span className="text-[10px] text-slate-500 block">Registros na fila</span>
        </div>

        {/* Pendente TI */}
        <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-4 space-y-1 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/10 rounded-full blur-xl"></div>
          <span className="text-xs text-amber-400 font-medium block flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Pendente TI
          </span>
          <div className="text-2xl font-bold text-amber-300">{pendingCount}</div>
          <span className="text-[10px] text-slate-500 block">Aguardando ação</span>
        </div>

        {/* Em Andamento */}
        <div className="bg-slate-900 border border-blue-500/30 rounded-2xl p-4 space-y-1 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/10 rounded-full blur-xl"></div>
          <span className="text-xs text-blue-400 font-medium block flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Em Andamento
          </span>
          <div className="text-2xl font-bold text-blue-300">{inProgressCount}</div>
          <span className="text-[10px] text-slate-500 block">Em atendimento</span>
        </div>

        {/* Concluído */}
        <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-4 space-y-1 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-full blur-xl"></div>
          <span className="text-xs text-emerald-400 font-medium block flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Concluído
          </span>
          <div className="text-2xl font-bold text-emerald-300">{completedCount}</div>
          <span className="text-[10px] text-slate-500 block">Acessos ok</span>
        </div>

        {/* SLA Alerts */}
        <div className="bg-slate-900 border border-rose-500/30 rounded-2xl p-4 space-y-1 col-span-2 lg:col-span-1">
          <span className="text-xs text-rose-400 font-medium block flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Alertas SLA (&lt; 5d)
          </span>
          <div className="text-2xl font-bold text-rose-300">{slaAlertCount}</div>
          <span className="text-[10px] text-slate-500 block">Prioridade alta</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, e-mail, id..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none transition"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:border-blue-500 focus:outline-none"
          >
            <option value="all">Todos os Tipos</option>
            <option value="onboarding">Apenas Onboarding</option>
            <option value="offboarding">Apenas Offboarding</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:border-blue-500 focus:outline-none"
          >
            <option value="all">Todos os Status</option>
            <option value="Pendente TI">Pendente TI</option>
            <option value="Em Andamento">Em Andamento</option>
            <option value="Concluído">Concluído</option>
          </select>

          {/* Department Filter */}
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:border-blue-500 focus:outline-none"
          >
            <option value="all">Todos os Setores</option>
            <option value="TI">TI</option>
            <option value="Financeiro">Financeiro</option>
            <option value="RH">RH</option>
            <option value="Comercial">Comercial</option>
            <option value="Operações">Operações</option>
          </select>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {filteredTickets.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <LayoutDashboard className="w-8 h-8 mx-auto text-slate-600" />
            <p className="text-sm">Nenhuma solicitação encontrada para os filtros selecionados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Ticket / Tipo</th>
                  <th className="py-3.5 px-4">Colaborador / E-mail</th>
                  <th className="py-3.5 px-4">Gestor / Setor</th>
                  <th className="py-3.5 px-4">Data Início/Desligamento</th>
                  <th className="py-3.5 px-4">Status TI</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredTickets.map((ticket) => {
                  const isOnboarding = ticket.type === 'onboarding';

                  let slaBadge = null;
                  if (isOnboarding && ticket.status !== 'Concluído') {
                    const sla = evaluateOnboardingSLA((ticket as any).dataInicio);
                    if (sla.status === 'warning') {
                      slaBadge = (
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-medium flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> SLA &lt; 5d
                        </span>
                      );
                    } else if (sla.status === 'expired') {
                      slaBadge = (
                        <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-medium flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Início Hoje
                        </span>
                      );
                    }
                  } else if (!isOnboarding && ticket.status !== 'Concluído') {
                    slaBadge = (
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Zero Day
                      </span>
                    );
                  }

                  return (
                    <tr
                      key={ticket.id}
                      className="hover:bg-slate-800/40 transition group"
                    >
                      {/* Ticket / Tipo */}
                      <td className="py-4 px-4 font-mono">
                        <div className="font-semibold text-white flex items-center gap-2">
                          <span>{ticket.id}</span>
                          {slaBadge}
                        </div>
                        <div className="mt-1">
                          {isOnboarding ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-sans font-semibold">
                              <UserPlus className="w-3 h-3" /> Onboarding
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-sans font-semibold">
                              <UserMinus className="w-3 h-3" /> Offboarding
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Colaborador */}
                      <td className="py-4 px-4">
                        <div className="font-semibold text-slate-100 text-sm">{ticket.nomeCompleto}</div>
                        <div className="text-slate-400 text-[11px] truncate max-w-[200px]">
                          {isOnboarding ? ticket.emailPessoal : ticket.emailCorporativo}
                        </div>
                        {isOnboarding && (
                          <div className="text-slate-500 text-[10px] mt-0.5">
                            Cargo: {(ticket as any).cargo}
                          </div>
                        )}
                      </td>

                      {/* Gestor / Setor */}
                      <td className="py-4 px-4">
                        <div className="text-slate-200 font-medium">{ticket.gestor}</div>
                        <div className="text-slate-400 text-[11px]">
                          {isOnboarding ? (ticket as any).departamento : 'Corporativo'}
                        </div>
                      </td>

                      {/* Data Início / Desligamento */}
                      <td className="py-4 px-4">
                        <div className="font-medium text-slate-200">
                          {isOnboarding
                            ? formatDateToBR((ticket as any).dataInicio)
                            : formatDateTimeToBR((ticket as any).dataHoraDesligamento)}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Criado: {formatDateToBR(ticket.createdAt)}
                        </div>
                      </td>

                      {/* Status TI */}
                      <td className="py-4 px-4">
                        <select
                          value={ticket.status}
                          onChange={(e) => onUpdateStatus(ticket.id, e.target.value as TicketStatus)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border focus:outline-none transition ${
                            ticket.status === 'Pendente TI'
                              ? 'bg-amber-950/60 text-amber-300 border-amber-500/40'
                              : ticket.status === 'Em Andamento'
                              ? 'bg-blue-950/60 text-blue-300 border-blue-500/40'
                              : 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                          }`}
                        >
                          <option value="Pendente TI">🟡 Pendente TI</option>
                          <option value="Em Andamento">🔵 Em Andamento</option>
                          <option value="Concluído">🟢 Concluído</option>
                        </select>
                      </td>

                      {/* Action buttons */}
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onSelectTicket(ticket)}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition"
                            title="Ver Detalhes & Checklist TI"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onPrintTerm(ticket)}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 transition"
                            title="Imprimir Termo de Responsabilidade LGPD"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onDeleteTicket(ticket.id)}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition"
                            title="Excluir Ticket"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
