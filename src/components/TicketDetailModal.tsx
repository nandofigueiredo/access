import React, { useState } from 'react';
import { Ticket, TicketStatus, ToastMessage } from '../types';
import { formatDateToBR, formatDateTimeToBR, evaluateOnboardingSLA } from '../utils/formatters';
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
  Save
} from 'lucide-react';

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
  const isOnboarding = ticket.type === 'onboarding';

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

  const toggleChecklist = (key: string) => {
    setItChecklist((prev: any) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSaveITChanges = () => {
    const updatedTicket: Ticket = {
      ...ticket,
      status,
      itChecklist,
      itNotes,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold ${
                isOnboarding ? 'bg-emerald-600' : 'bg-rose-600'
              }`}
            >
              {isOnboarding ? <UserPlus className="w-5 h-5" /> : <UserMinus className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white font-mono">{ticket.id}</h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    isOnboarding
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {isOnboarding ? 'Onboarding' : 'Offboarding'}
                </span>
              </div>
              <p className="text-xs text-slate-400">{ticket.nomeCompleto}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Scrollable */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-300">
          {/* Quick Status Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-950 border border-slate-800">
            <div>
              <span className="text-[11px] text-slate-400 block font-medium">Status Atual do Atendimento</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-bold text-sm text-white">{status}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setStatus('Pendente TI')}
                className={`px-3 py-1.5 rounded-lg font-medium border transition ${
                  status === 'Pendente TI'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Pendente TI
              </button>
              <button
                onClick={() => setStatus('Em Andamento')}
                className={`px-3 py-1.5 rounded-lg font-medium border transition ${
                  status === 'Em Andamento'
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Em Andamento
              </button>
              <button
                onClick={() => setStatus('Concluído')}
                className={`px-3 py-1.5 rounded-lg font-medium border transition ${
                  status === 'Concluído'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Concluído
              </button>
            </div>
          </div>

          {/* ONBOARDING DATA */}
          {isOnboarding && (
            <>
              {/* Colaborador & Logística */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <h4 className="font-semibold text-slate-200 text-xs flex items-center gap-2 border-b border-slate-800/80 pb-2">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  Dados Cadastrais & Modalidade
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-slate-500 block text-[10px]">CPF</span>
                    <span className="font-mono text-slate-200">{(ticket as any).cpf}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">E-mail Pessoal</span>
                    <span className="text-slate-200">{(ticket as any).emailPessoal}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Cargo / Departamento</span>
                    <span className="text-slate-200">{(ticket as any).cargo} ({(ticket as any).departamento})</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Gestor Responsável</span>
                    <span className="text-slate-200">{ticket.gestor}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Data de Início</span>
                    <span className="font-semibold text-emerald-400">{formatDateToBR((ticket as any).dataInicio)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Modalidade</span>
                    <span className="text-slate-200">{(ticket as any).modalidade}</span>
                  </div>
                </div>

                {(ticket as any).enderecoEntrega && (
                  <div className="pt-2 border-t border-slate-800 text-[11px]">
                    <span className="text-slate-500 block">Endereço de Entrega do Equipamento:</span>
                    <span className="text-slate-200">{(ticket as any).enderecoEntrega}</span>
                  </div>
                )}
              </div>

              {/* Hardware */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <h4 className="font-semibold text-slate-200 text-xs flex items-center gap-2 border-b border-slate-800/80 pb-2">
                  <Laptop className="w-4 h-4 text-blue-400" />
                  Perfil de Hardware & Periféricos
                </h4>
                <div className="space-y-2">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Perfil Solicitado:</span>
                    <span className="font-semibold text-blue-300">{(ticket as any).perfilHardware}</span>
                  </div>
                  {(ticket as any).justificativaHardware && (
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
                      <strong>Justificativa:</strong> {(ticket as any).justificativaHardware}
                    </div>
                  )}

                  <div className="pt-2">
                    <span className="text-slate-500 block text-[10px]">Periféricos e Linha Solicitados:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {(ticket as any).perifericos.monitor && (
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px]">
                          Monitor Adicional
                        </span>
                      )}
                      {(ticket as any).perifericos.tecladoMouse && (
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px]">
                          Kit Teclado + Mouse
                        </span>
                      )}
                      {(ticket as any).perifericos.headset && (
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px]">
                          Headset
                        </span>
                      )}
                      {(ticket as any).perifericos.suporteErgonomico && (
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px]">
                          Suporte Notebook
                        </span>
                      )}
                      {(ticket as any).telefonia.simCard && (
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px]">
                          SIM Card / eSIM
                        </span>
                      )}
                      {(ticket as any).telefonia.smartphone && (
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px]">
                          Smartphone Corporativo
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Software & Access */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <h4 className="font-semibold text-slate-200 text-xs flex items-center gap-2 border-b border-slate-800/80 pb-2">
                  <Server className="w-4 h-4 text-purple-400" />
                  Sistemas, E-mail & Licenças
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Modelo de Referência</span>
                    <span className="text-slate-200">{(ticket as any).copiarAcessosDe || 'Nenhum'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Power BI Role</span>
                    <span className="text-slate-200">{(ticket as any).sistemasEspecificos?.powerBi}</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* OFFBOARDING DATA */}
          {!isOnboarding && (
            <>
              {/* Revogação */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <h4 className="font-semibold text-slate-200 text-xs flex items-center gap-2 border-b border-slate-800/80 pb-2">
                  <Clock className="w-4 h-4 text-rose-400" />
                  Zero-Day Lock Info
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-slate-500 block text-[10px]">E-mail Corporativo</span>
                    <span className="font-semibold text-rose-300">{(ticket as any).emailCorporativo}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Data & Hora Bloqueio</span>
                    <span className="font-bold text-rose-400">
                      {formatDateTimeToBR((ticket as any).dataHoraDesligamento)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Gestor Direto</span>
                    <span className="text-slate-200">{ticket.gestor}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">Redirecionar E-mail para:</span>
                    <span className="text-slate-200">{(ticket as any).emailDestinoRedirecionamento || 'Não configurado'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Transferir Drive/OneDrive para:</span>
                    <span className="text-slate-200">{(ticket as any).emailDestinoArquivos || 'Não configurado'}</span>
                  </div>
                </div>
              </div>

              {/* Patrimônio */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                <h4 className="font-semibold text-slate-200 text-xs flex items-center gap-2 border-b border-slate-800/80 pb-2">
                  Recolhimento de Ativos
                </h4>
                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">Notebook Patrimônio:</span>
                    <span className="font-mono text-slate-200">
                      {(ticket as any).ativos?.codigoPatrimonioNotebook || 'Sim (Sem Cód)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Modalidade de Devolução:</span>
                    <span className="text-slate-200">{(ticket as any).modalidadeDevolucao}</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* INTERACTIVE IT CHECKLIST */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
            <h4 className="font-bold text-white text-xs flex items-center gap-2 border-b border-slate-800/80 pb-2">
              <CheckSquare className="w-4 h-4 text-emerald-400" />
              Checklist de Atendimento Técnico (Uso Exclusivo da TI)
            </h4>

            {isOnboarding ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={!!itChecklist.hardwareProvisionado}
                    onChange={() => toggleChecklist('hardwareProvisionado')}
                    className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span>Notebook/Hardware Formatado e Preparado</span>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={!!itChecklist.contaEntraIdCriada}
                    onChange={() => toggleChecklist('contaEntraIdCriada')}
                    className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span>Conta criada no Microsoft Entra ID</span>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={!!itChecklist.sistemasLiberados}
                    onChange={() => toggleChecklist('sistemasLiberados')}
                    className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span>Licenças e Sistemas Atribuídos</span>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={!!itChecklist.crachaSolicitado}
                    onChange={() => toggleChecklist('crachaSolicitado')}
                    className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span>Crachá Físico Solicitado / Catraca Ok</span>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer hover:border-slate-700 col-span-2">
                  <input
                    type="checkbox"
                    checked={!!itChecklist.termoEnviado}
                    onChange={() => toggleChecklist('termoEnviado')}
                    className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span>Termo de Responsabilidade e Ficha LGPD emitida para assinatura</span>
                </label>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={!!itChecklist.bloqueioIdP}
                    onChange={() => toggleChecklist('bloqueioIdP')}
                    className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span>Bloqueio efetuado no Entra ID / SSO</span>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={!!itChecklist.encerramentoSessoes}
                    onChange={() => toggleChecklist('encerramentoSessoes')}
                    className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span>Sessões encerradas em dispositivos móveis</span>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={!!itChecklist.desvinculacaoLicencas}
                    onChange={() => toggleChecklist('desvinculacaoLicencas')}
                    className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span>Licenças pagas (M365/PowerBI/Salesforce) recolhidas</span>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={!!itChecklist.remocaoGruposEmail}
                    onChange={() => toggleChecklist('remocaoGruposEmail')}
                    className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span>Removido de grupos de e-mail e canais Teams</span>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={!!itChecklist.limpezaWipeMDM}
                    onChange={() => toggleChecklist('limpezaWipeMDM')}
                    className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span>Limpeza Wipe MDM realizada no Notebook</span>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={!!itChecklist.registroLogsAuditoria}
                    onChange={() => toggleChecklist('registroLogsAuditoria')}
                    className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span>Logs de auditoria armazenados para compliance</span>
                </label>
              </div>
            )}
          </div>

          {/* IT Technician Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Anotações Internas do Técnico de TI
            </label>
            <textarea
              rows={2}
              value={itNotes}
              onChange={(e) => setItNotes(e.target.value)}
              placeholder="Digite observações de atendimento, patrimônio ou rastreio..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
          <button
            onClick={() => onPrintTerm(ticket)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition"
          >
            <Printer className="w-4 h-4 text-blue-400" />
            <span>Imprimir Ficha/Termo LGPD</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-900 transition"
            >
              Fechar
            </button>
            <button
              onClick={handleSaveITChanges}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-md transition"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Alterações TI</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
