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
import React, { useEffect, useState } from 'react';
import { Ticket, TicketStatus, ToastMessage } from '../types';
import { formatDateToBR, formatDateTimeToBR, evaluateOnboardingSLA } from '../utils/formatters';
import { useAuth } from '../auth/AuthContext';
import { can } from '../auth/roles';

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
  const canEditTI = can(user?.role, 'tickets.checklist') || can(user?.role, 'tickets.updateStatus');
  const isOnboarding = ticket.type === 'onboarding';
  const [activePanel, setActivePanel] = useState<'workflow' | 'dados' | 'checklist'>('workflow');

  useEffect(() => {
    if (!ticket.workflow) {
      onUpdateTicket({
        ...ticket,
        workflow: createInitialWorkflow(ticket.createdBy),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket.id]);

  // Local state for IT Checklist
  const [itChecklist, setItChecklist] = useState<any>(
    ticket.itChecklist || (isOnboarding
      ? {
          hardwareProvisionado: false,
          contaEntraIdCriada: false,
          sistemasLiberados: false,
          crachaSolicitado: false,
          termoEnviado: false,
        }
      : {
          bloqueioIdP: false,
          encerramentoSessoes: false,
          desvinculacaoLicencas: false,
          remocaoGruposEmail: false,
          limpezaWipeMDM: false,
          registroLogsAuditoria: false,
        })
  );

  const [itNotes, setItNotes] = useState(ticket.itNotes || '');
  const [status, setStatus] = useState<TicketStatus>(ticket.status);
  const [glpiTicketNumber, setGlpiTicketNumber] = useState(ticket.glpiTicketNumber || '');

  useEffect(() => {
    setGlpiTicketNumber(ticket.glpiTicketNumber || '');
    setStatus(ticket.status);
    setItNotes(ticket.itNotes || '');
  }, [ticket.id, ticket.glpiTicketNumber, ticket.status, ticket.itNotes]);

  const toggleChecklist = (key: string) => {
    setItChecklist((prev: any) => ({
      ...prev,
      [key]: !prev[key],
    }));
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
    const updatedTicket: Ticket = {
      ...ticket,
      status,
      itChecklist,
      itNotes,
      glpiTicketNumber: glpiTicketNumber.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };

    onUpdateTicket(updatedTicket);

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
              Preenchido automaticamente quando o GLPI responde (webhook) ou manualmente pelo Service Desk.
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
          {/* INTERACTIVE IT CHECKLIST */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2 border-b border-slate-200 pb-2">
              <CheckSquare className="w-4 h-4 text-emerald-600" />
              Checklist de Atendimento Técnico (Uso Exclusivo da TI)
            </h4>

            {isOnboarding ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer hover:border-slate-300 transition">
                  <input
                    type="checkbox"
                    checked={!!itChecklist.hardwareProvisionado}
                    onChange={() => toggleChecklist('hardwareProvisionado')}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-slate-800 font-medium">Notebook/Hardware Formatado e Preparado</span>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer hover:border-slate-300 transition">
                  <input
                    type="checkbox"
                    checked={!!itChecklist.contaEntraIdCriada}
                    onChange={() => toggleChecklist('contaEntraIdCriada')}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-slate-800 font-medium">Conta criada no Microsoft Entra ID</span>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer hover:border-slate-300 transition">
                  <input
                    type="checkbox"
                    checked={!!itChecklist.sistemasLiberados}
                    onChange={() => toggleChecklist('sistemasLiberados')}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-slate-800 font-medium">Licenças e Sistemas Atribuídos</span>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer hover:border-slate-300 transition">
                  <input
                    type="checkbox"
                    checked={!!itChecklist.crachaSolicitado}
                    onChange={() => toggleChecklist('crachaSolicitado')}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-slate-800 font-medium">Crachá Físico Solicitado / Catraca Ok</span>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer hover:border-slate-300 transition col-span-2">
                  <input
                    type="checkbox"
                    checked={!!itChecklist.termoEnviado}
                    onChange={() => toggleChecklist('termoEnviado')}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-slate-800 font-medium">Termo de Responsabilidade e Ficha LGPD emitida para assinatura</span>
                </label>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer hover:border-slate-300 transition">
                  <input
                    type="checkbox"
                    checked={!!itChecklist.bloqueioIdP}
                    onChange={() => toggleChecklist('bloqueioIdP')}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-slate-800 font-medium">Bloqueio efetuado no Entra ID / SSO</span>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer hover:border-slate-300 transition">
                  <input
                    type="checkbox"
                    checked={!!itChecklist.encerramentoSessoes}
                    onChange={() => toggleChecklist('encerramentoSessoes')}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-slate-800 font-medium">Sessões encerradas em dispositivos móveis</span>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer hover:border-slate-300 transition">
                  <input
                    type="checkbox"
                    checked={!!itChecklist.desvinculacaoLicencas}
                    onChange={() => toggleChecklist('desvinculacaoLicencas')}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-slate-800 font-medium">Licenças pagas (M365/PowerBI/Salesforce) recolhidas</span>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer hover:border-slate-300 transition">
                  <input
                    type="checkbox"
                    checked={!!itChecklist.remocaoGruposEmail}
                    onChange={() => toggleChecklist('remocaoGruposEmail')}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-slate-800 font-medium">Removido de grupos de e-mail e canais Teams</span>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer hover:border-slate-300 transition">
                  <input
                    type="checkbox"
                    checked={!!itChecklist.limpezaWipeMDM}
                    onChange={() => toggleChecklist('limpezaWipeMDM')}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-slate-800 font-medium">Limpeza Wipe MDM realizada no Notebook</span>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer hover:border-slate-300 transition">
                  <input
                    type="checkbox"
                    checked={!!itChecklist.registroLogsAuditoria}
                    onChange={() => toggleChecklist('registroLogsAuditoria')}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-slate-800 font-medium">Logs de auditoria armazenados para compliance</span>
                </label>
              </div>
            )}
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
