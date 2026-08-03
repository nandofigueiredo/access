import React, { useMemo, useState } from 'react';
import { Ticket, ToastMessage } from '../types';
import { WORKFLOW_AREAS, WORKFLOW_STAGES } from '../types/workflow';
import {
  claimByServiceDesk,
  createInitialWorkflow,
  finalizeByServiceDesk,
  openHandoff,
  updateHandoffStatus,
} from '../services/workflowEngine';
import { useWorkflowMail } from '../store/WorkflowMailContext';
import { useAuth } from '../auth/AuthContext';
import { formatDateTimeToBR } from '../utils/formatters';
import {
  Headphones,
  Network,
  Shield,
  CheckCircle2,
  Play,
  Lock,
  Mail,
} from 'lucide-react';
import { can } from '../auth/roles';

interface Props {
  ticket: Ticket;
  onUpdateTicket: (t: Ticket) => void;
  addToast: (t: Omit<ToastMessage, 'id'>) => void;
}

function mapStageToStatus(stage: string): Ticket['status'] {
  if (stage === 'completed') return 'Concluído';
  if (stage === 'ready_for_sd_closure') return 'Pronta p/ Fechamento';
  if (stage === 'waiting_n3_integration' || stage === 'n3_in_progress') return 'Aguardando N3';
  if (stage === 'in_service_desk') return 'Em Andamento';
  return 'Pendente TI';
}

export const WorkflowPanel: React.FC<Props> = ({ ticket, onUpdateTicket, addToast }) => {
  const { user } = useAuth();
  const { smtp, sendMail } = useWorkflowMail();
  const actor = user?.email || user?.name || 'operador';
  const canSD = can(user?.role, 'workflow.serviceDesk');
  const canN3 = can(user?.role, 'workflow.n3');
  const canOperate = canSD || canN3;
  const [handoffNote, setHandoffNote] = useState('');
  const [ipInfo, setIpInfo] = useState('');

  const wf = useMemo(() => ticket.workflow || createInitialWorkflow(ticket.createdBy), [ticket]);

  const persist = (nextWf: typeof wf, extra?: Partial<Ticket>) => {
    onUpdateTicket({
      ...ticket,
      ...extra,
      workflow: nextWf,
      status: mapStageToStatus(nextWf.stage),
      updatedAt: new Date().toISOString(),
    } as Ticket);
  };

  const notify = (to: string[], subject: string, body: string, template: string) => {
    const entry = sendMail({ to, subject, body, template, ticketId: ticket.id });
    addToast({
      type: 'info',
      title: 'E-mail workflow',
      message: `${entry.status === 'sent_simulated' ? 'Simulado' : 'Enfileirado'}: ${to.join(', ')}`,
    });
  };

  const handleClaim = () => {
    const next = claimByServiceDesk(wf, actor);
    persist(next);
    notify(
      [smtp.serviceDeskInbox],
      `[SD] ${ticket.id} assumido`,
      `Service Desk (${actor}) assumiu ${ticket.id} — ${ticket.nomeCompleto}.`,
      'sd_claim'
    );
    addToast({ type: 'success', title: 'Service Desk', message: 'Demanda assumida.' });
  };

  const handleOpenInfra = () => {
    const next = openHandoff(
      wf,
      'n3_infra_security',
      'N3 Infra / Segurança',
      handoffNote || 'Provisionar/revogar identidade, MFA, licenças e segurança.',
      actor
    );
    persist(next);
    notify(
      [smtp.n3InfraInbox],
      `[N3 Infra] Integração ${ticket.id}`,
      `Service Desk abriu handoff de Infra/Segurança.\nTicket: ${ticket.id}\nColaborador: ${ticket.nomeCompleto}\nDetalhe: ${handoffNote || '—'}`,
      'handoff_n3_infra'
    );
    setHandoffNote('');
  };

  const handleOpenNetworks = () => {
    const next = openHandoff(
      wf,
      'n3_networks',
      'N3 Redes — Liberação de IP',
      handoffNote || 'Liberar IP / VLAN / VPN conforme perfil do colaborador.',
      actor
    );
    persist(next);
    notify(
      [smtp.n3NetworksInbox],
      `[N3 Redes] IP/VLAN ${ticket.id}`,
      `Service Desk solicitou liberação de rede.\nTicket: ${ticket.id}\nColaborador: ${ticket.nomeCompleto}\nDetalhe: ${handoffNote || '—'}`,
      'handoff_n3_networks'
    );
    setHandoffNote('');
  };

  const handleHandoffDone = (id: string, area: string) => {
    const deliverables =
      area === 'n3_networks' && ipInfo.trim()
        ? [`IP/VLAN: ${ipInfo.trim()}`]
        : area === 'n3_infra_security'
          ? ['Identidade/MFA/Licenças tratados']
          : undefined;
    const next = updateHandoffStatus(wf, id, 'done', actor, 'Concluído pela área', deliverables);
    persist(next);
    notify(
      [smtp.serviceDeskInbox],
      `[Retorno N3] ${ticket.id}`,
      `Handoff ${area} concluído por ${actor}.${deliverables ? `\nEntregáveis: ${deliverables.join('; ')}` : ''}`,
      'handoff_done'
    );
    if (area === 'n3_networks') setIpInfo('');
  };

  const handleFinalize = () => {
    const endUserEmail =
      ticket.type === 'onboarding' ? ticket.emailPessoal : ticket.emailCorporativo;
    const requester = ticket.requesterEmail || ticket.createdBy;
    const items = [
      `Ticket ${ticket.id} (${ticket.type})`,
      `Colaborador: ${ticket.nomeCompleto}`,
      ...wf.handoffs.flatMap((h) => h.deliverables || []),
      ticket.type === 'onboarding'
        ? `Início: ${ticket.dataInicio} · Depto: ${ticket.departamento}`
        : `Desligamento: ${ticket.dataHoraDesligamento}`,
    ];
    const result = finalizeByServiceDesk(wf, actor, {
      summary: 'Service Desk finalizou a demanda com todas as integrações concluídas.',
      items,
      sentTo: [requester, endUserEmail, smtp.serviceDeskInbox].filter(Boolean),
    });

    if (result.ok === false) {
      addToast({ type: 'error', title: 'Fechamento bloqueado', message: result.error });
      return;
    }

    persist(result.workflow, { status: 'Concluído' });

    if (smtp.notifyRequesterOnClose) {
      notify(
        [requester],
        `[Concluído] ${ticket.id} — ${ticket.nomeCompleto}`,
        `Sua solicitação foi finalizada pelo Service Desk.\n\n${items.join('\n')}`,
        'close_requester'
      );
    }
    if (smtp.notifyEndUserOnComplete) {
      notify(
        [endUserEmail],
        `[Portal TI] Sua solicitação ${ticket.id} está concluída`,
        `Olá ${ticket.nomeCompleto},\n\nSegue o pacote final da sua demanda de ${ticket.type}:\n\n${items.join('\n')}\n\nQualquer dúvida, contate o Service Desk.`,
        'close_end_user'
      );
    }

    addToast({
      type: 'success',
      title: 'Finalizado pelo Service Desk',
      message: 'Pacote enviado ao solicitante e usuário final.',
    });
  };

  const openHandoffs = wf.handoffs.filter((h) => h.status === 'open' || h.status === 'in_progress');
  const canFinalize =
    openHandoffs.length === 0 &&
    wf.stage !== 'completed' &&
    (wf.stage === 'ready_for_sd_closure' ||
      wf.stage === 'in_service_desk' ||
      (wf.stage === 'awaiting_service_desk' && wf.handoffs.length === 0));

  const stageMeta = WORKFLOW_STAGES[wf.stage];
  const owner = WORKFLOW_AREAS[wf.currentOwner];
  const pipelineStages = [
    'awaiting_service_desk',
    'in_service_desk',
    'waiting_n3_integration',
    'n3_in_progress',
    'ready_for_sd_closure',
    'completed',
  ] as const;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-sky-100 bg-gradient-to-br from-[#001529] via-[#002d5b] to-[#0a4a8a] text-white p-4 shadow-sm">
        <div className="text-[11px] font-bold uppercase tracking-wide text-sky-200">Board do chamado</div>
        <div className="text-base font-bold mt-0.5">{stageMeta.label}</div>
        <p className="text-[12px] text-white/75 mt-1 leading-relaxed">{stageMeta.description}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold">
          {[
            WORKFLOW_AREAS.requester,
            WORKFLOW_AREAS.service_desk,
            WORKFLOW_AREAS.n3_infra_security,
            WORKFLOW_AREAS.n3_networks,
            WORKFLOW_AREAS.end_user,
          ].map((a, idx, arr) => (
            <React.Fragment key={a.short}>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border ${
                  owner.short === a.short
                    ? 'bg-white text-[#002d5b] border-white'
                    : 'bg-white/10 border-white/15 text-white/90'
                }`}
              >
                {a.short}
              </span>
              {idx < arr.length - 1 && <span className="text-white/40">→</span>}
            </React.Fragment>
          ))}
        </div>
        <div className="mt-3 inline-flex items-center gap-2 text-[11px] font-bold px-3 py-1 rounded-full bg-white/15 border border-white/20">
          Dono atual: {owner.label}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">
          Onde o processo está parado
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {pipelineStages.map((s) => {
            const meta = WORKFLOW_STAGES[s];
            const isCurrent = wf.stage === s;
            const done = meta.order < stageMeta.order || (wf.stage === 'completed' && s === 'completed');
            return (
              <div
                key={s}
                className={`rounded-lg border px-2.5 py-2 min-h-[72px] ${
                  isCurrent
                    ? 'border-[#1890ff] bg-sky-50 shadow-sm ring-1 ring-[#1890ff]/30'
                    : done
                      ? 'border-emerald-200 bg-emerald-50/50'
                      : 'border-slate-100 bg-slate-50/80'
                }`}
              >
                <div
                  className={`text-[10px] font-bold uppercase tracking-wide ${
                    isCurrent ? 'text-[#1890ff]' : done ? 'text-emerald-700' : 'text-slate-400'
                  }`}
                >
                  {isCurrent ? 'Aqui agora' : done ? 'Concluído' : 'Aguardando'}
                </div>
                <div className={`text-[11px] font-semibold mt-0.5 leading-snug ${isCurrent ? 'text-[#002d5b]' : 'text-slate-600'}`}>
                  {meta.label}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex gap-1">
          {pipelineStages.map((s) => {
            const active = WORKFLOW_STAGES[s].order <= stageMeta.order;
            return (
              <div
                key={s}
                className={`flex-1 h-1.5 rounded-full ${active ? 'bg-[#1890ff]' : 'bg-slate-200'}`}
                title={WORKFLOW_STAGES[s].label}
              />
            );
          })}
        </div>
      </div>

      {wf.stage !== 'completed' && canOperate && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {canSD && (wf.stage === 'awaiting_service_desk' || wf.currentOwner !== 'service_desk') && (
            <button
              type="button"
              onClick={handleClaim}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#1890ff] hover:bg-[#096dd9]"
            >
              <Headphones className="w-4 h-4" /> Service Desk assumir
            </button>
          )}
          {canSD && (
            <button
              type="button"
              onClick={handleOpenInfra}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#722ed1] hover:bg-[#531dab]"
            >
              <Shield className="w-4 h-4" /> Abrir N3 Infra/Segurança
            </button>
          )}
          {canSD && (
            <button
              type="button"
              onClick={handleOpenNetworks}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#fa8c16] hover:bg-[#d46b08]"
            >
              <Network className="w-4 h-4" /> Abrir N3 Redes (IP)
            </button>
          )}
          {canSD && (
            <button
              type="button"
              disabled={!canFinalize}
              onClick={handleFinalize}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
              title={!canFinalize ? 'Conclua todos os handoffs N3 antes. Somente SD finaliza.' : 'Fechamento exclusivo Service Desk'}
            >
              <Lock className="w-4 h-4" /> Finalizar (somente SD)
            </button>
          )}
          {canN3 && !canSD && (
            <p className="sm:col-span-2 text-[12px] text-violet-700 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2">
              Perfil Admin N3: conclua os handoffs abaixo. Abertura e fechamento ficam com o Service Desk.
            </p>
          )}
        </div>
      )}

      {!canOperate && (
        <p className="text-[12px] text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
          Você está vendo em que etapa o chamado está parado. Ações (assumir, N3, finalizar) ficam com Service Desk e Admin N3.
        </p>
      )}

      {canOperate && (
        <div>
          <label className="text-[11px] font-semibold text-slate-500">Nota para handoff N3</label>
          <textarea
            value={handoffNote}
            onChange={(e) => setHandoffNote(e.target.value)}
            rows={2}
            placeholder="Ex.: Liberar IP fixo na VLAN corporativa + VPN..."
            className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      )}

      {wf.handoffs.some((h) => h.area === 'n3_networks' && (h.status === 'open' || h.status === 'in_progress')) && (
        <div>
          <label className="text-[11px] font-semibold text-slate-500">IP / VLAN liberado (N3 Redes)</label>
          <input
            value={ipInfo}
            onChange={(e) => setIpInfo(e.target.value)}
            placeholder="Ex.: 10.20.30.45 / VLAN 120"
            className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      )}

      {/* Handoffs */}
      <div className="space-y-2">
        <h4 className="text-sm font-bold text-slate-800">Integrações entre áreas</h4>
        {wf.handoffs.length === 0 ? (
          <p className="text-[12px] text-slate-400">Nenhum handoff N3 aberto. SD pode executar e finalizar sozinho.</p>
        ) : (
          wf.handoffs.map((h) => (
            <div key={h.id} className="border border-slate-200 rounded-lg p-3 bg-white">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-sm text-slate-800">{h.title}</div>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    h.status === 'done'
                      ? 'bg-emerald-50 text-emerald-700'
                      : h.status === 'in_progress'
                        ? 'bg-sky-50 text-sky-700'
                        : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {h.status}
                </span>
              </div>
              <p className="text-[12px] text-slate-500 mt-1">{h.description}</p>
              {h.deliverables && h.deliverables.length > 0 && (
                <ul className="mt-1 text-[11px] text-emerald-700 list-disc ml-4">
                  {h.deliverables.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              )}
              {(h.status === 'open' || h.status === 'in_progress') && (canN3 || canSD) && (
                <div className="mt-2 flex gap-2">
                  {h.status === 'open' && (
                    <button
                      type="button"
                      onClick={() => persist(updateHandoffStatus(wf, h.id, 'in_progress', actor))}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded bg-sky-50 text-sky-700"
                    >
                      <Play className="w-3 h-3" /> Iniciar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleHandoffDone(h.id, h.area)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded bg-emerald-50 text-emerald-700"
                  >
                    <CheckCircle2 className="w-3 h-3" /> Concluir área
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {wf.deliveryPackage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-800">
            <Mail className="w-4 h-4" /> Pacote final enviado
          </div>
          <p className="text-[12px] text-emerald-900/80 mt-1">{wf.deliveryPackage.summary}</p>
          <ul className="mt-2 text-[11px] text-emerald-900 list-disc ml-4">
            {wf.deliveryPackage.items.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
          <p className="text-[10px] text-emerald-700/70 mt-2">
            Para: {wf.deliveryPackage.sentTo.join(', ')} · {formatDateTimeToBR(wf.deliveryPackage.sentAt)}
          </p>
        </div>
      )}

      {/* Timeline */}
      <div>
        <h4 className="text-sm font-bold text-slate-800 mb-2">Linha do tempo</h4>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {wf.timeline.map((e) => (
            <div key={e.id} className="flex gap-2 text-[11px]">
              <div className="w-1.5 rounded-full bg-[#1890ff] shrink-0" />
              <div>
                <div className="font-semibold text-slate-700">
                  {e.action} · {e.actor}
                </div>
                <div className="text-slate-500">{e.detail}</div>
                <div className="text-slate-400">{formatDateTimeToBR(e.at)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
