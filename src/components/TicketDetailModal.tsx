import {
  X,
  UserPlus,
  UserMinus,
  CheckSquare,
  FileText,
  Clock,
  Printer,
  ShieldCheck,
  Building2,
  Laptop,
  Server,
  AlertTriangle,
  Save,
  GitBranch,
} from 'lucide-react';
import { WorkflowPanel } from './WorkflowPanel';
import { createInitialWorkflow } from '../services/workflowEngine';
import {
  buildChecklistState,
  canAssignChecklistTeam,
  canToggleChecklistItem,
  CHECKLIST_TEAMS,
  ChecklistTeam,
  checklistKeyOf,
  checklistProgress,
  ItChecklistMap,
  ChecklistItemState,
  markTeamItemsDone,
  syncWorkflowFromChecklist,
  teamLabel,
  teamShort,
} from '../services/checklistTeams';
import React, { useEffect, useMemo, useState } from 'react';
import { Ticket, TicketStatus, ToastMessage } from '../types';
import { formatDateToBR, formatDateTimeToBR, evaluateOnboardingSLA } from '../utils/formatters';
import { useAuth } from '../auth/AuthContext';
import { can } from '../auth/roles';
import { useCatalog } from '../store/CatalogContext';

interface TicketDetailModalProps {
  ticket: Ticket;
  onClose: () => void;
  onUpdateTicket: (updated: Ticket) => void;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  onPrintTerm: (ticket: Ticket) => void;
}

export const TicketDetailModal: React.FC<TicketDetailModalProps> = ({
  ticket,
  onClose,
  onUpdateTicket,
  addToast,
  onPrintTerm,
}) => {
  const { user } = useAuth();
  const { catalog } = useCatalog();
  const canEditTI = can(user?.role, 'tickets.checklist') || can(user?.role, 'tickets.updateStatus');
  const canSD = can(user?.role, 'workflow.serviceDesk');
  const canN3 = can(user?.role, 'workflow.n3');
  const canAssign = canAssignChecklistTeam(canSD);
  const isOnboarding = ticket.type === 'onboarding';
  const [activePanel, setActivePanel] = useState<'workflow' | 'dados' | 'checklist'>('workflow');
  const actor = user?.email || user?.name || 'operador';

  const catalogChecklist = isOnboarding ? catalog.onboardingChecklist : catalog.offboardingChecklist;

  useEffect(() => {
    if (!ticket.workflow) {
      onUpdateTicket({
        ...ticket,
        workflow: createInitialWorkflow(ticket.createdBy),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket.id]);

  const [itChecklist, setItChecklist] = useState<ItChecklistMap>(() =>
    buildChecklistState(catalogChecklist, ticket.itChecklist as Record<string, unknown> | undefined)
  );

  const [itNotes, setItNotes] = useState(ticket.itNotes || '');
  const [status, setStatus] = useState<TicketStatus>(ticket.status);
  const [glpiTicketNumber, setGlpiTicketNumber] = useState(ticket.glpiTicketNumber || '');

  useEffect(() => {
    setGlpiTicketNumber(ticket.glpiTicketNumber || '');
    setStatus(ticket.status);
    setItNotes(ticket.itNotes || '');
    setItChecklist(buildChecklistState(catalogChecklist, ticket.itChecklist as Record<string, unknown> | undefined));
  }, [ticket.id, ticket.glpiTicketNumber, ticket.status, ticket.itNotes, ticket.itChecklist, catalogChecklist]);

  const progress = useMemo(() => checklistProgress(itChecklist), [itChecklist]);

  const catalogByKey = useMemo(() => {
    const map = new Map<string, (typeof catalogChecklist)[0]>();
    for (const item of catalogChecklist) {
      map.set(checklistKeyOf(item), item);
    }
    return map;
  }, [catalogChecklist]);

  const toggleChecklist = (key: string) => {
    const item = itChecklist[key];
    if (!item) return;
    if (!canToggleChecklistItem({ canServiceDesk: canSD, canN3, itemTeam: item.team })) {
      addToast({
        type: 'warning',
        title: 'Sem permissão',
        message: `Este item está atribuído a ${teamLabel(item.team)}.`,
      });
      return;
    }
    setItChecklist((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        done: !prev[key].done,
        doneBy: !prev[key].done ? actor : undefined,
        doneAt: !prev[key].done ? new Date().toISOString() : undefined,
      },
    }));
  };

  const assignTeam = (key: string, team: ChecklistTeam) => {
    if (!canAssign) return;
    setItChecklist((prev) => ({
      ...prev,
      [key]: { ...prev[key], team },
    }));
  };

  const assignAllToSd = () => {
    if (!canAssign) return;
    setItChecklist((prev) => {
      const next: ItChecklistMap = {};
      for (const key of Object.keys(prev)) {
        next[key] = { ...prev[key], team: 'service_desk' };
      }
      return next;
    });
    addToast({
      type: 'info',
      title: 'Atribuição',
      message: 'Todos os itens atribuídos ao Service Desk (execução solo).',
    });
  };

  const finishMyTeamPart = (team: ChecklistTeam) => {
    if (!canToggleChecklistItem({ canServiceDesk: canSD, canN3, itemTeam: team })) {
      addToast({ type: 'warning', title: 'Sem permissão', message: 'Você não opera esta equipe.' });
      return;
    }
    setItChecklist((prev) => markTeamItemsDone(prev, team, actor));
    addToast({
      type: 'success',
      title: 'Parte da equipe concluída',
      message: `${teamLabel(team)}: itens marcados como feitos.`,
    });
  };

  const handleSaveITChanges = () => {
    if (!canEditTI) {
      addToast({
        type: 'warning',
        title: 'Sem permissão',
        message: 'Seu perfil não pode alterar status ou checklist TI.',
      });
      return;
    }

    let workflow = ticket.workflow || createInitialWorkflow(ticket.createdBy);
    if (canSD || canN3) {
      workflow = syncWorkflowFromChecklist(workflow, itChecklist, actor);
    }

    const mapStageToStatus = (stage: string): TicketStatus => {
      if (stage === 'completed') return 'Concluído';
      if (stage === 'ready_for_sd_closure') return 'Pronta p/ Fechamento';
      if (stage === 'waiting_n3_integration' || stage === 'n3_in_progress') return 'Aguardando N3';
      if (stage === 'in_service_desk') return 'Em Andamento';
      return status === 'Pendente TI' ? 'Pendente TI' : status;
    };

    const derivedStatus =
      workflow.stage === 'completed'
        ? 'Concluído'
        : canSD || canN3
          ? mapStageToStatus(workflow.stage)
          : status;

    const updatedTicket: Ticket = {
      ...ticket,
      status: derivedStatus,
      itChecklist,
      itNotes,
      glpiTicketNumber: glpiTicketNumber.trim() || undefined,
      workflow,
      updatedAt: new Date().toISOString(),
    };

    onUpdateTicket(updatedTicket);
    setStatus(derivedStatus);

    addToast({
      type: 'success',
      title: 'Ações da TI Salvas!',
      message: `Status e checklist do ticket ${ticket.id} atualizados com sucesso.`,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-xs ${
                isOnboarding ? 'bg-emerald-600' : 'bg-rose-600'
              }`}
            >
              {isOnboarding ? <UserPlus className="w-5 h-5" /> : <UserMinus className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 font-mono">{ticket.id}</h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    isOnboarding
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {isOnboarding ? 'Onboarding' : 'Offboarding'}
                </span>
                {glpiTicketNumber.trim() && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-white border border-slate-700">
                    GLPI #{glpiTicketNumber.trim()}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium">{ticket.nomeCompleto}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-white px-4 gap-1 shrink-0">
          {(
            [
              { id: 'workflow' as const, label: 'Board do chamado', icon: <GitBranch className="w-3.5 h-3.5" />, show: true },
              { id: 'dados' as const, label: 'Dados da solicitação', icon: <FileText className="w-3.5 h-3.5" />, show: true },
              {
                id: 'checklist' as const,
                label: 'Checklist TI',
                icon: <CheckSquare className="w-3.5 h-3.5" />,
                show: canEditTI,
              },
            ] as const
          )
            .filter((t) => t.show)
            .map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActivePanel(t.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-semibold border-b-2 -mb-px transition ${
                activePanel === t.id
                  ? 'border-[#1890ff] text-[#1890ff]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Modal Body Scrollable */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
          {activePanel === 'workflow' && (
            <WorkflowPanel ticket={ticket} onUpdateTicket={onUpdateTicket} addToast={addToast} />
          )}

          {activePanel === 'dados' && (
            <>
          {/* Quick Status Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <span className="text-[11px] text-slate-500 block font-semibold">Status Atual do Atendimento</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-bold text-sm text-slate-900">{status}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {canEditTI ? (
                <>
              <button
                onClick={() => setStatus('Pendente TI')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                  status === 'Pendente TI'
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
                }`}
              >
                Pendente TI
              </button>
              <button
                onClick={() => setStatus('Em Andamento')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                  status === 'Em Andamento'
                    ? 'bg-blue-100 text-blue-900 border-blue-300'
                    : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
                }`}
              >
                Em Andamento
              </button>
              <button
                onClick={() => setStatus('Aguardando N3')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                  status === 'Aguardando N3'
                    ? 'bg-violet-100 text-violet-900 border-violet-300'
                    : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
                }`}
              >
                Aguardando N3
              </button>
              <button
                onClick={() => setStatus('Pronta p/ Fechamento')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                  status === 'Pronta p/ Fechamento'
                    ? 'bg-cyan-100 text-cyan-900 border-cyan-300'
                    : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
                }`}
              >
                Pronta p/ Fechamento
              </button>
              <button
                onClick={() => setStatus('Concluído')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                  status === 'Concluído'
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
                }`}
              >
                Concluído
              </button>
                </>
              ) : (
                <span className="text-[11px] text-slate-500">Somente leitura do status</span>
              )}
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
            <label className="block text-xs font-bold text-slate-800">
              Nº chamado GLPI <span className="font-normal text-slate-400">(glpi@diroma.com.br)</span>
            </label>
            {canEditTI ? (
              <input
                value={glpiTicketNumber}
                onChange={(e) => setGlpiTicketNumber(e.target.value)}
                placeholder="Ex.: 123456"
                className="w-full max-w-xs border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#1890ff]"
              />
            ) : (
              <p className="text-sm font-mono text-slate-800">
                {glpiTicketNumber.trim() ? `#${glpiTicketNumber.trim()}` : '— ainda não vinculado'}
              </p>
            )}
            <p className="text-[11px] text-slate-500">
              O número é preenchido automaticamente ao encontrar o chamado no banco do GLPI
              (marcador [PORTAL:…]), em até ~1 minuto. Se ainda estiver vazio, o Service Desk
              pode digitar aqui e salvar.
            </p>
          </div>

          {/* ONBOARDING DATA */}
          {isOnboarding && (
            <>
              {/* Colaborador & Logística */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2 border-b border-slate-200 pb-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  Dados Cadastrais & Modalidade
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-slate-400 block text-[10px]">CPF</span>
                    <span className="font-mono text-slate-900 font-semibold">{(ticket as any).cpf}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">E-mail Pessoal</span>
                    <span className="text-slate-900 font-medium">{(ticket as any).emailPessoal}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Cargo / Departamento</span>
                    <span className="text-slate-900 font-medium">{(ticket as any).cargo} ({(ticket as any).departamento})</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Gestor Responsável</span>
                    <span className="text-slate-900 font-medium">{ticket.gestor}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Data de Início</span>
                    <span className="font-bold text-emerald-700">{formatDateToBR((ticket as any).dataInicio)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Modalidade</span>
                    <span className="text-slate-900 font-medium">{(ticket as any).modalidade}</span>
                  </div>
                </div>

                {(ticket as any).enderecoEntrega && (
                  <div className="pt-2 border-t border-slate-200 text-[11px]">
                    <span className="text-slate-500 block font-semibold">Endereço de Entrega do Equipamento:</span>
                    <span className="text-slate-800">{(ticket as any).enderecoEntrega}</span>
                  </div>
                )}
              </div>

              {/* Hardware */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2 border-b border-slate-200 pb-2">
                  <Laptop className="w-4 h-4 text-blue-600" />
                  Perfil de Hardware & Periféricos
                </h4>
                <div className="space-y-2">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Perfil Solicitado:</span>
                    <span className="font-bold text-blue-700">{(ticket as any).perfilHardware}</span>
                  </div>
                  {(ticket as any).justificativaHardware && (
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-700">
                      <strong>Justificativa:</strong> {(ticket as any).justificativaHardware}
                    </div>
                  )}

                  <div className="pt-2">
                    <span className="text-slate-500 block text-[10px]">Periféricos e Linha Solicitados:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {(ticket as any).perifericos.monitor && (
                        <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 text-[11px] font-medium">
                          Monitor Adicional
                        </span>
                      )}
                      {(ticket as any).perifericos.tecladoMouse && (
                        <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 text-[11px] font-medium">
                          Kit Teclado + Mouse
                        </span>
                      )}
                      {(ticket as any).perifericos.headset && (
                        <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 text-[11px] font-medium">
                          Headset
                        </span>
                      )}
                      {(ticket as any).perifericos.suporteErgonomico && (
                        <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 text-[11px] font-medium">
                          Suporte Notebook
                        </span>
                      )}
                      {(ticket as any).telefonia.simCard && (
                        <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 text-[11px] font-medium">
                          SIM Card / eSIM
                        </span>
                      )}
                      {(ticket as any).telefonia.smartphone && (
                        <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 text-[11px] font-medium">
                          Smartphone Corporativo
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Software & Access */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2 border-b border-slate-200 pb-2">
                  <Server className="w-4 h-4 text-purple-600" />
                  Sistemas, E-mail & Licenças
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Modelo de Referência</span>
                    <span className="text-slate-800 font-semibold">{(ticket as any).copiarAcessosDe || 'Nenhum'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Power BI Role</span>
                    <span className="text-slate-800 font-semibold">{(ticket as any).sistemasEspecificos?.powerBi}</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* OFFBOARDING DATA */}
          {!isOnboarding && (
            <>
              {/* Revogação */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2 border-b border-slate-200 pb-2">
                  <Clock className="w-4 h-4 text-rose-600" />
                  Zero-Day Lock Info
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-slate-500 block text-[10px]">E-mail Corporativo</span>
                    <span className="font-semibold text-rose-700">{(ticket as any).emailCorporativo}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Data & Hora Bloqueio</span>
                    <span className="font-bold text-rose-700">
                      {formatDateTimeToBR((ticket as any).dataHoraDesligamento)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Gestor Direto</span>
                    <span className="text-slate-800 font-medium">{ticket.gestor}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">Redirecionar E-mail para:</span>
                    <span className="text-slate-800 font-medium">{(ticket as any).emailDestinoRedirecionamento || 'Não configurado'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Transferir Drive/OneDrive para:</span>
                    <span className="text-slate-800 font-medium">{(ticket as any).emailDestinoArquivos || 'Não configurado'}</span>
                  </div>
                </div>
              </div>

              {/* Patrimônio */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2 border-b border-slate-200 pb-2">
                  Recolhimento de Ativos
                </h4>
                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">Notebook Patrimônio:</span>
                    <span className="font-mono text-slate-900 font-bold">
                      {(ticket as any).ativos?.codigoPatrimonioNotebook || 'Sim (Sem Cód)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Modalidade de Devolução:</span>
                    <span className="text-slate-800 font-medium">{(ticket as any).modalidadeDevolucao}</span>
                  </div>
                </div>
              </div>
            </>
          )}
            </>
          )}

          {activePanel === 'checklist' && (
            <>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 border-b border-slate-200 pb-2">
              <div>
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-emerald-600" />
                  Checklist TI por equipe
                </h4>
                <p className="text-[11px] text-slate-500 mt-1">
                  Service Desk atribui cada item. SD pode executar tudo sozinho ou abrir N3.
                  Cada equipe conclui só a sua parte. Progresso: {progress.done}/{progress.total}
                </p>
              </div>
              {canAssign && (
                <button
                  type="button"
                  onClick={assignAllToSd}
                  className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100"
                >
                  Atribuir tudo ao SD
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {CHECKLIST_TEAMS.map((t) => {
                const p = progress.byTeam[t.id];
                if (!p.total) return null;
                return (
                  <div
                    key={t.id}
                    className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-[11px]"
                  >
                    <span className="font-semibold text-slate-700">{t.short}</span>
                    <span className="text-slate-500">
                      {p.done}/{p.total}
                    </span>
                    {canToggleChecklistItem({ canServiceDesk: canSD, canN3, itemTeam: t.id }) && p.done < p.total && (
                      <button
                        type="button"
                        onClick={() => finishMyTeamPart(t.id)}
                        className="font-semibold text-emerald-700 hover:underline"
                      >
                        Finalizar minha parte
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="space-y-2">
              {(Object.entries(itChecklist) as [string, ChecklistItemState][]).map(([key, item]) => {
                const cat = catalogByKey.get(key);
                const label = cat?.name || key;
                const editable = canToggleChecklistItem({
                  canServiceDesk: canSD,
                  canN3,
                  itemTeam: item.team,
                });
                return (
                  <div
                    key={key}
                    className={`flex flex-col sm:flex-row sm:items-center gap-2 p-2.5 rounded-lg bg-white border ${
                      item.done ? 'border-emerald-200' : 'border-slate-200'
                    }`}
                  >
                    <label className={`flex items-center gap-2.5 flex-1 min-w-0 ${editable && canEditTI ? 'cursor-pointer' : 'opacity-80'}`}>
                      <input
                        type="checkbox"
                        checked={item.done}
                        disabled={!canEditTI || !editable}
                        onChange={() => toggleChecklist(key)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-slate-800 font-medium text-[13px]">{label}</span>
                    </label>
                    <div className="flex items-center gap-2 shrink-0">
                      {canAssign ? (
                        <select
                          value={item.team}
                          onChange={(e) => assignTeam(key, e.target.value as ChecklistTeam)}
                          className="text-[11px] border border-slate-200 rounded-md px-2 py-1 bg-white"
                          title="Equipe responsável"
                        >
                          {CHECKLIST_TEAMS.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {teamShort(item.team)}
                        </span>
                      )}
                      {item.done && item.doneBy && (
                        <span className="text-[10px] text-slate-400 truncate max-w-[140px]" title={item.doneBy}>
                          {item.doneBy}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {Object.keys(itChecklist).length === 0 && (
                <p className="text-[12px] text-slate-500">
                  Nenhum item de checklist no catálogo. Cadastre em Configuração → Checklist TI.
                </p>
              )}
            </div>
          </div>

          {/* IT Technician Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Anotações Internas do Técnico de TI
            </label>
            <textarea
              rows={2}
              value={itNotes}
              onChange={(e) => canEditTI && setItNotes(e.target.value)}
              readOnly={!canEditTI}
              placeholder={canEditTI ? 'Digite observações de atendimento, patrimônio ou rastreio...' : 'Somente leitura'}
              className={`w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none transition ${
                canEditTI ? 'bg-slate-50 focus:bg-white focus:border-blue-500' : 'bg-slate-100 text-slate-600 cursor-default'
              }`}
            />
          </div>
            </>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <button
            onClick={() => onPrintTerm(ticket)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-blue-700 bg-white hover:bg-slate-100 border border-slate-200 transition"
          >
            <Printer className="w-4 h-4 text-blue-600" />
            <span>Imprimir Ficha/Termo LGPD</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 transition"
            >
              Fechar
            </button>
            {canEditTI && (
              <button
                onClick={handleSaveITChanges}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition"
              >
                <Save className="w-4 h-4" />
                <span>Salvar Alterações TI</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
