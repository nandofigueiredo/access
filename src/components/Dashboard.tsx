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
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-blue-600" />
            Painel de Gestão de Onboarding e Offboarding
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Acompanhe o ciclo de vida de colaboradores, SLAs de provisionamento e revogações no Entra ID.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onNavigateNewOnboarding}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs transition active:scale-[0.99]"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Onboarding</span>
          </button>

          <button
            onClick={onNavigateNewOffboarding}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-xs transition active:scale-[0.99]"
          >
            <UserMinus className="w-4 h-4" />
            <span>+ Offboarding</span>
          </button>

          <button
            onClick={exportToCSV}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 shadow-xs transition"
            title="Exportar Relatório CSV"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Total */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1 shadow-xs">
          <span className="text-xs text-slate-500 font-semibold block">Total Solicitações</span>
          <div className="text-2xl font-bold text-slate-900">{totalCount}</div>
          <span className="text-[10px] text-slate-400 block">Registros na fila</span>
        </div>

        {/* Pendente TI */}
        <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4 space-y-1">
          <span className="text-xs text-amber-800 font-bold block flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-600" /> Pendente TI
          </span>
          <div className="text-2xl font-bold text-amber-900">{pendingCount}</div>
          <span className="text-[10px] text-amber-700/80 block">Aguardando ação</span>
        </div>

        {/* Em Andamento */}
        <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-4 space-y-1">
          <span className="text-xs text-blue-800 font-bold block flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-blue-600" /> Em Andamento
          </span>
          <div className="text-2xl font-bold text-blue-900">{inProgressCount}</div>
          <span className="text-[10px] text-blue-700/80 block">Em atendimento</span>
        </div>

        {/* Concluído */}
        <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4 space-y-1">
          <span className="text-xs text-emerald-800 font-bold block flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Concluído
          </span>
          <div className="text-2xl font-bold text-emerald-900">{completedCount}</div>
          <span className="text-[10px] text-emerald-700/80 block">Acessos ok</span>
        </div>

        {/* SLA Alerts */}
        <div className="bg-rose-50/50 border border-rose-200 rounded-xl p-4 space-y-1 col-span-2 lg:col-span-1">
          <span className="text-xs text-rose-800 font-bold block flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Alertas SLA (&lt; 5d)
          </span>
          <div className="text-2xl font-bold text-rose-900">{slaAlertCount}</div>
          <span className="text-[10px] text-rose-700/80 block">Prioridade alta</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, e-mail, id..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:outline-none transition"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:bg-white focus:border-blue-500 focus:outline-none"
          >
            <option value="all">Todos os Tipos</option>
            <option value="onboarding">Apenas Onboarding</option>
            <option value="offboarding">Apenas Offboarding</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:bg-white focus:border-blue-500 focus:outline-none"
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
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:bg-white focus:border-blue-500 focus:outline-none"
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
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {filteredTickets.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <LayoutDashboard className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-sm font-medium">Nenhuma solicitação encontrada para os filtros selecionados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-4">Ticket / Tipo</th>
                  <th className="py-3.5 px-4">Colaborador / E-mail</th>
                  <th className="py-3.5 px-4">Gestor / Setor</th>
                  <th className="py-3.5 px-4">Data Início/Desligamento</th>
                  <th className="py-3.5 px-4">Status TI</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTickets.map((ticket) => {
                  const isOnboarding = ticket.type === 'onboarding';

                  let slaBadge = null;
                  if (isOnboarding && ticket.status !== 'Concluído') {
                    const sla = evaluateOnboardingSLA((ticket as any).dataInicio);
                    if (sla.status === 'warning') {
                      slaBadge = (
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-600" /> SLA &lt; 5d
                        </span>
                      );
                    } else if (sla.status === 'expired') {
                      slaBadge = (
                        <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-rose-600" /> Início Hoje
                        </span>
                      );
                    }
                  } else if (!isOnboarding && ticket.status !== 'Concluído') {
                    slaBadge = (
                      <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3 text-rose-600" /> Zero Day
                      </span>
                    );
                  }

                  return (
                    <tr
                      key={ticket.id}
                      className="hover:bg-slate-50 transition group"
                    >
                      {/* Ticket / Tipo */}
                      <td className="py-4 px-4 font-mono">
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <span>{ticket.id}</span>
                          {slaBadge}
                        </div>
                        <div className="mt-1">
                          {isOnboarding ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-sans font-bold">
                              <UserPlus className="w-3 h-3" /> Onboarding
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-sans font-bold">
                              <UserMinus className="w-3 h-3" /> Offboarding
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Colaborador */}
                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-900 text-sm">{ticket.nomeCompleto}</div>
                        <div className="text-slate-500 text-[11px] truncate max-w-[200px]">
                          {isOnboarding ? ticket.emailPessoal : ticket.emailCorporativo}
                        </div>
                        {isOnboarding && (
                          <div className="text-slate-400 text-[10px] mt-0.5">
                            Cargo: {(ticket as any).cargo}
                          </div>
                        )}
                      </td>

                      {/* Gestor / Setor */}
                      <td className="py-4 px-4">
                        <div className="text-slate-800 font-medium">{ticket.gestor}</div>
                        <div className="text-slate-500 text-[11px]">
                          {isOnboarding ? (ticket as any).departamento : 'Corporativo'}
                        </div>
                      </td>

                      {/* Data Início / Desligamento */}
                      <td className="py-4 px-4">
                        <div className="font-semibold text-slate-800">
                          {isOnboarding
                            ? formatDateToBR((ticket as any).dataInicio)
                            : formatDateTimeToBR((ticket as any).dataHoraDesligamento)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Criado: {formatDateToBR(ticket.createdAt)}
                        </div>
                      </td>

                      {/* Status TI */}
                      <td className="py-4 px-4">
                        <select
                          value={ticket.status}
                          onChange={(e) => onUpdateStatus(ticket.id, e.target.value as TicketStatus)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold border focus:outline-none transition ${
                            ticket.status === 'Pendente TI'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : ticket.status === 'Em Andamento'
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
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
                            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition"
                            title="Ver Detalhes & Checklist TI"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onPrintTerm(ticket)}
                            className="p-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition"
                            title="Imprimir Termo de Responsabilidade LGPD"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onDeleteTicket(ticket.id)}
                            className="p-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition"
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
