import React, { useMemo, useState } from 'react';
import { Ticket, TicketStatus, TicketType, ToastMessage } from '../types';
import { formatDateToBR, formatDateTimeToBR, evaluateOnboardingSLA } from '../utils/formatters';
import {
  Search,
  Filter,
  Eye,
  Trash2,
  FileText,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { can, ticketInScope } from '../auth/roles';

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

const PAGE_SIZES = [15, 30, 50];

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
  const { user } = useAuth();
  const canUpdate = can(user?.role, 'tickets.updateStatus');
  const canDelete = can(user?.role, 'tickets.delete');
  const canCreateOnb = can(user?.role, 'tickets.create.onboarding');
  const canCreateOff = can(user?.role, 'tickets.create.offboarding');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | TicketType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | TicketStatus>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const totalCount = tickets.length;
  const pendingCount = tickets.filter((t) => t.status === 'Pendente TI').length;
  const inProgressCount = tickets.filter((t) => t.status === 'Em Andamento').length;
  const waitingN3Count = tickets.filter((t) => t.status === 'Aguardando N3').length;
  const readyCloseCount = tickets.filter((t) => t.status === 'Pronta p/ Fechamento').length;
  const completedCount = tickets.filter((t) => t.status === 'Concluído').length;
  const onboardingCount = tickets.filter((t) => t.type === 'onboarding').length;
  const offboardingCount = tickets.filter((t) => t.type === 'offboarding').length;
  const slaAlertCount = tickets.filter((t) => {
    if (t.type === 'onboarding' && t.status !== 'Concluído') {
      const sla = evaluateOnboardingSLA(t.dataInicio);
      return sla.status === 'warning' || sla.status === 'expired';
    }
    return false;
  }).length;

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      if (!ticketInScope(user?.role, { email: user?.email, name: user?.name }, ticket)) {
        return false;
      }
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        ticket.nomeCompleto.toLowerCase().includes(q) ||
        ticket.id.toLowerCase().includes(q) ||
        (ticket.type === 'onboarding' ? ticket.emailPessoal : ticket.emailCorporativo)
          .toLowerCase()
          .includes(q) ||
        ticket.gestor.toLowerCase().includes(q);

      const matchesType = typeFilter === 'all' || ticket.type === typeFilter;
      const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [tickets, search, typeFilter, statusFilter, user?.role, user?.email, user?.name]);

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pageItems = filteredTickets.slice(pageStart, pageStart + pageSize);

  const statusDot = (status: TicketStatus) => {
    if (status === 'Pendente TI') return 'bg-[#faad14]';
    if (status === 'Em Andamento') return 'bg-[#1890ff]';
    if (status === 'Aguardando N3') return 'bg-[#722ed1]';
    if (status === 'Pronta p/ Fechamento') return 'bg-[#13c2c2]';
    return 'bg-[#52c41a]';
  };

  return (
    <div className="space-y-3">
      {/* Metric cards — GLPI style */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
        <button type="button" onClick={() => setStatusFilter('all')} className="glpi-stat bg-[#fadb14] text-slate-900 text-left">
          <div className="text-xl font-bold leading-none">{totalCount}</div>
          <div className="text-[11px] mt-1 font-medium opacity-90">Total</div>
        </button>
        <button type="button" onClick={() => { setTypeFilter('onboarding'); setStatusFilter('all'); }} className="glpi-stat bg-[#52c41a] text-left">
          <div className="text-xl font-bold leading-none">{onboardingCount}</div>
          <div className="text-[11px] mt-1 font-medium opacity-90">Onboarding</div>
        </button>
        <button type="button" onClick={() => setStatusFilter('Pendente TI')} className="glpi-stat bg-[#fa8c16] text-left">
          <div className="text-xl font-bold leading-none">{pendingCount}</div>
          <div className="text-[11px] mt-1 font-medium opacity-90">Pendente TI</div>
        </button>
        <button type="button" onClick={() => setStatusFilter('Em Andamento')} className="glpi-stat bg-[#13c2c2] text-left">
          <div className="text-xl font-bold leading-none">{inProgressCount}</div>
          <div className="text-[11px] mt-1 font-medium opacity-90">Em Andamento</div>
        </button>
        <button type="button" onClick={() => setStatusFilter('Aguardando N3')} className="glpi-stat bg-[#722ed1] text-left">
          <div className="text-xl font-bold leading-none">{waitingN3Count}</div>
          <div className="text-[11px] mt-1 font-medium opacity-90">Aguardando N3</div>
        </button>
        <button type="button" onClick={() => setStatusFilter('Pronta p/ Fechamento')} className="glpi-stat bg-[#08979c] text-left">
          <div className="text-xl font-bold leading-none">{readyCloseCount}</div>
          <div className="text-[11px] mt-1 font-medium opacity-90">Pronta p/ Fechamento</div>
        </button>
        <button type="button" onClick={() => { setTypeFilter('offboarding'); setStatusFilter('all'); }} className="glpi-stat bg-[#1890ff] text-left">
          <div className="text-xl font-bold leading-none">{offboardingCount}</div>
          <div className="text-[11px] mt-1 font-medium opacity-90">Offboarding</div>
        </button>
        <div className="glpi-stat bg-[#bfbfbf] text-slate-800">
          <div className="text-xl font-bold leading-none">{completedCount}</div>
          <div className="text-[11px] mt-1 font-medium opacity-90">Concluídos · SLA {slaAlertCount}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-[#f0f0f0] px-3 py-2 flex flex-col md:flex-row md:items-center gap-2 justify-between">
        <div className="flex items-center gap-2 text-[12px] text-slate-500">
          <Filter className="w-3.5 h-3.5" />
          <ArrowUpDown className="w-3.5 h-3.5" />
          <span>Sorted by Last Update</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Buscar chamado..."
              className="border border-slate-200 rounded-sm pl-7 pr-2 py-1.5 text-[12px] w-48 focus:outline-none focus:border-[#1890ff]"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value as 'all' | TicketType); setPage(1); }}
            className="border border-slate-200 rounded-sm px-2 py-1.5 text-[12px]"
          >
            <option value="all">Todos os tipos</option>
            <option value="onboarding">Onboarding</option>
            <option value="offboarding">Offboarding</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as 'all' | TicketStatus); setPage(1); }}
            className="border border-slate-200 rounded-sm px-2 py-1.5 text-[12px]"
          >
            <option value="all">Todos os status</option>
            <option value="Pendente TI">Pendente TI</option>
            <option value="Em Andamento">Em Andamento</option>
            <option value="Aguardando N3">Aguardando N3</option>
            <option value="Pronta p/ Fechamento">Pronta p/ Fechamento</option>
            <option value="Concluído">Concluído</option>
          </select>
          {canCreateOnb && (
            <button
              type="button"
              onClick={onNavigateNewOnboarding}
              className="text-[12px] font-semibold text-[#1890ff] hover:underline"
            >
              + Onboarding
            </button>
          )}
          {canCreateOff && (
            <button
              type="button"
              onClick={onNavigateNewOffboarding}
              className="text-[12px] font-semibold text-[#1890ff] hover:underline"
            >
              + Offboarding
            </button>
          )}
        </div>
      </div>

      {/* Data table */}
      <div className="bg-white border border-[#f0f0f0] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px] glpi-table">
            <thead>
              <tr>
                <th className="py-2.5 px-3 w-8"><input type="checkbox" className="accent-[#1890ff]" /></th>
                <th className="py-2.5 px-3">ID</th>
                <th className="py-2.5 px-3">GLPI</th>
                <th className="py-2.5 px-3">Título</th>
                <th className="py-2.5 px-3">Entidade</th>
                <th className="py-2.5 px-3">Data de abertura</th>
                <th className="py-2.5 px-3">Requerente</th>
                <th className="py-2.5 px-3">Categoria</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Última atualização</th>
                <th className="py-2.5 px-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    Nenhum chamado encontrado.
                  </td>
                </tr>
              ) : (
                pageItems.map((ticket) => {
                  const isOnboarding = ticket.type === 'onboarding';
                  const entidade = isOnboarding
                    ? `Grupo diRoma > ${ticket.departamento}`
                    : 'Grupo diRoma > Corporativo';
                  const categoria = isOnboarding ? 'TI > Onboarding' : 'TI > Offboarding';

                  return (
                    <tr key={ticket.id} className="cursor-pointer" onClick={() => onSelectTicket(ticket)}>
                      <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" className="accent-[#1890ff]" />
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-[#1890ff]">{ticket.id}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700">
                        {ticket.glpiTicketNumber ? `#${ticket.glpiTicketNumber}` : '—'}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">
                        {ticket.nomeCompleto}
                        {isOnboarding ? ` / ${ticket.departamento}` : ''}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{entidade}</td>
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                        {formatDateTimeToBR(ticket.createdAt)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{ticket.createdBy}</td>
                      <td className="py-2.5 px-3 text-slate-600">{categoria}</td>
                      <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${statusDot(ticket.status)}`} />
                          {canUpdate ? (
                            <select
                              value={ticket.status}
                              onChange={(e) => onUpdateStatus(ticket.id, e.target.value as TicketStatus)}
                              className="bg-transparent border-0 text-[12px] font-medium focus:outline-none cursor-pointer"
                            >
                              <option value="Pendente TI">Pendente TI</option>
                              <option value="Em Andamento">Em Andamento</option>
                              <option value="Aguardando N3">Aguardando N3</option>
                              <option value="Pronta p/ Fechamento">Pronta p/ Fechamento</option>
                              <option value="Concluído">Concluído</option>
                            </select>
                          ) : (
                            <span className="text-[12px] font-medium">{ticket.status}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                        {formatDateTimeToBR(ticket.updatedAt)}
                      </td>
                      <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onSelectTicket(ticket)}
                            className="p-1.5 text-slate-500 hover:text-[#1890ff] hover:bg-sky-50 rounded"
                            title="Detalhes"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onPrintTerm(ticket)}
                            className="p-1.5 text-slate-500 hover:text-[#002d5b] hover:bg-slate-50 rounded"
                            title="Termo"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => onDeleteTicket(ticket.id)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded"
                              title="Excluir"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2 border-t border-[#f0f0f0] text-[12px] text-slate-500 bg-[#fafafa]">
          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="border border-slate-200 rounded-sm px-1.5 py-1 bg-white"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <span>lines per page</span>
            <span className="text-slate-400">
              Showing {filteredTickets.length === 0 ? 0 : pageStart + 1} to{' '}
              {Math.min(pageStart + pageSize, filteredTickets.length)} of {filteredTickets.length} lines
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1 rounded border border-slate-200 bg-white disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 py-1 rounded bg-[#1890ff] text-white font-semibold min-w-[1.75rem] text-center">
              {currentPage}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1 rounded border border-slate-200 bg-white disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
