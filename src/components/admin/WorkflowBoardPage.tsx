import React, { useMemo } from 'react';
import { Ticket, ToastMessage } from '../../types';
import {
  WORKFLOW_AREAS,
  WORKFLOW_STAGES,
  WorkflowStageId,
} from '../../types/workflow';
import { createInitialWorkflow } from '../../services/workflowEngine';
import {
  ArrowRight,
  GitBranch,
  Network,
  Shield,
  Headphones,
  UserCheck,
  CheckCircle2,
} from 'lucide-react';

interface Props {
  tickets: Ticket[];
  onSelectTicket: (t: Ticket) => void;
  addToast: (t: Omit<ToastMessage, 'id'>) => void;
}

const PIPELINE: WorkflowStageId[] = [
  'awaiting_service_desk',
  'in_service_desk',
  'waiting_n3_integration',
  'n3_in_progress',
  'ready_for_sd_closure',
  'completed',
];

function ensureWorkflow(t: Ticket) {
  return t.workflow || createInitialWorkflow(t.createdBy);
}

export const WorkflowBoardPage: React.FC<Props> = ({ tickets, onSelectTicket }) => {
  const columns = useMemo(() => {
    return PIPELINE.map((stage) => ({
      stage,
      meta: WORKFLOW_STAGES[stage],
      items: tickets.filter((t) => ensureWorkflow(t).stage === stage),
    }));
  }, [tickets]);

  return (
    <div className="space-y-4">
      {/* Hero architecture */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#001529] via-[#002d5b] to-[#0a4a8a] text-white p-6 shadow-lg">
        <div className="absolute -right-10 -top-10 w-56 h-56 bg-sky-400/20 rounded-full blur-3xl" />
        <div className="absolute -left-8 bottom-0 w-40 h-40 bg-cyan-300/10 rounded-full blur-2xl" />
        <h2 className="text-xl font-bold relative">Workflow integrado — Onboarding & Offboarding</h2>
        <p className="mt-2 text-sm text-white/80 max-w-3xl relative leading-relaxed">
          O RH cria a solicitação. O <strong>Service Desk</strong> orquestra tudo e, se necessário,
          abre integrações com <strong>N3 Infra/Segurança</strong> e <strong>N3 Redes</strong> (liberação de IP).
          Somente o Service Desk finaliza a demanda e dispara o e-mail com o pacote completo ao usuário final.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-2 relative text-[12px] font-semibold">
          {[
            { icon: <UserCheck className="w-3.5 h-3.5" />, ...WORKFLOW_AREAS.requester },
            { icon: <Headphones className="w-3.5 h-3.5" />, ...WORKFLOW_AREAS.service_desk },
            { icon: <Shield className="w-3.5 h-3.5" />, ...WORKFLOW_AREAS.n3_infra_security },
            { icon: <Network className="w-3.5 h-3.5" />, ...WORKFLOW_AREAS.n3_networks },
            { icon: <CheckCircle2 className="w-3.5 h-3.5" />, ...WORKFLOW_AREAS.end_user },
          ].map((a, idx, arr) => (
            <React.Fragment key={a.short}>
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 backdrop-blur-sm"
                style={{ boxShadow: `inset 3px 0 0 ${a.color}` }}
              >
                {a.icon}
                {a.short}
              </span>
              {idx < arr.length - 1 && <ArrowRight className="w-3.5 h-3.5 text-white/40" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Rules card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          {
            title: '1. Entrada',
            text: 'RH registra onboarding/offboarding. E-mail alerta Service Desk + confirmação ao solicitante.',
          },
          {
            title: '2. Integração N3',
            text: 'SD abre handoffs: Infra/Segurança e Redes (IP/VLAN/VPN). Cada área conclui sua parte.',
          },
          {
            title: '3. Fechamento único',
            text: 'Apenas Service Desk fecha. Pacote final (acessos, IP, equipamentos) vai por e-mail ao usuário.',
          },
        ].map((c) => (
          <div key={c.title} className="bg-white border border-[#e8eef5] rounded-xl p-4 shadow-sm">
            <div className="text-sm font-bold text-[#002d5b] flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-[#1890ff]" />
              {c.title}
            </div>
            <p className="text-[12px] text-slate-500 mt-2 leading-relaxed">{c.text}</p>
          </div>
        ))}
      </div>

      {/* Kanban */}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-3 min-w-max">
          {columns.map((col) => (
            <div key={col.stage} className="w-72 bg-[#f7f9fc] border border-[#e8eef5] rounded-xl flex flex-col max-h-[560px]">
              <div className="px-3 py-2.5 border-b border-[#e8eef5] sticky top-0 bg-[#f7f9fc] rounded-t-xl">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold text-slate-700">{col.meta.label}</span>
                  <span className="text-[11px] font-bold bg-white border border-slate-200 rounded-full px-2 py-0.5 text-slate-600">
                    {col.items.length}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{col.meta.description}</p>
              </div>
              <div className="p-2 space-y-2 overflow-y-auto flex-1">
                {col.items.length === 0 ? (
                  <div className="text-[11px] text-slate-400 text-center py-8">Vazio</div>
                ) : (
                  col.items.map((t) => {
                    const wf = ensureWorkflow(t);
                    const owner = WORKFLOW_AREAS[wf.currentOwner];
                    const openH = wf.handoffs.filter((h) => h.status === 'open' || h.status === 'in_progress').length;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onSelectTicket(t)}
                        className="w-full text-left bg-white border border-[#e8eef5] rounded-lg p-3 shadow-sm hover:border-[#1890ff] hover:shadow-md transition"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-[#1890ff]">{t.id}</span>
                          <span
                            className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              t.type === 'onboarding' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {t.type}
                          </span>
                        </div>
                        <div className="text-[13px] font-semibold text-slate-800 mt-1 truncate">{t.nomeCompleto}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate">Solicitante: {t.createdBy}</div>
                        <div className="mt-2 flex items-center justify-between">
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white"
                            style={{ background: owner.color }}
                          >
                            {owner.short}
                          </span>
                          {openH > 0 && (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                              {openH} N3 aberto(s)
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
