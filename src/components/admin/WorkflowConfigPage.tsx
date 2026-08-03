import React from 'react';
import {
  ArrowRight,
  Headphones,
  Network,
  Shield,
  UserCheck,
  CheckCircle2,
  Mail,
  Lock,
  GitBranch,
} from 'lucide-react';
import { WORKFLOW_AREAS, WORKFLOW_STAGES } from '../../types/workflow';
import { ToastMessage } from '../../types';

interface Props {
  addToast: (t: Omit<ToastMessage, 'id'>) => void;
}

const FLOW = [
  {
    icon: <UserCheck className="w-5 h-5" />,
    title: '1. Criador (RH / Gestor)',
    color: WORKFLOW_AREAS.requester.color,
    text: 'Registra onboarding ou offboarding. O sistema gera o ticket, coloca na fila do Service Desk e dispara e-mail de confirmação ao solicitante + alerta à caixa do SD.',
  },
  {
    icon: <Headphones className="w-5 h-5" />,
    title: '2. Service Desk (orquestrador)',
    color: WORKFLOW_AREAS.service_desk.color,
    text: 'Único dono operacional da demanda. Assume o ticket, executa checklist TI e decide se precisa integração N3. Só o SD pode finalizar e liberar para o usuário final.',
  },
  {
    icon: <Shield className="w-5 h-5" />,
    title: '3. N3 Infra / Segurança (se necessário)',
    color: WORKFLOW_AREAS.n3_infra_security.color,
    text: 'Handoff aberto pelo SD: identidade Entra ID, MFA, licenças, grupos e políticas de segurança. A área conclui e devolve entregáveis ao Service Desk.',
  },
  {
    icon: <Network className="w-5 h-5" />,
    title: '4. N3 Redes — IP / VLAN / VPN (se necessário)',
    color: WORKFLOW_AREAS.n3_networks.color,
    text: 'Handoff específico de redes: liberação de IP, VLAN ou VPN conforme o perfil. O IP informado volta no pacote final enviado ao usuário.',
  },
  {
    icon: <Lock className="w-5 h-5" />,
    title: '5. Fechamento exclusivo do Service Desk',
    color: '#08979c',
    text: 'Enquanto houver handoff N3 aberto, o fechamento fica bloqueado. Com tudo concluído, o SD finaliza e monta o pacote (acessos, IP, equipamentos, datas).',
  },
  {
    icon: <Mail className="w-5 h-5" />,
    title: '6. Usuário final + solicitante',
    color: WORKFLOW_AREAS.end_user.color,
    text: 'E-mail com o pacote completo chega ao usuário criado/desligado e ao solicitante. A demanda só “cai” para o usuário depois do fechamento do SD.',
  },
];

export const WorkflowConfigPage: React.FC<Props> = ({ addToast }) => {
  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#001529] via-[#003a70] to-[#0a4a8a] text-white p-6 shadow-lg">
        <div className="absolute right-0 top-0 w-72 h-72 bg-sky-400/15 rounded-full blur-3xl" />
        <div className="relative flex items-start gap-3">
          <GitBranch className="w-7 h-7 text-sky-300 shrink-0" />
          <div>
            <h2 className="text-xl font-bold">Fluxo multiárea — regras oficiais</h2>
            <p className="mt-2 text-sm text-white/80 max-w-3xl leading-relaxed">
              Integração entre criador, Service Desk, N3 Infra/Segurança e N3 Redes, com SMTP
              nas etapas críticas. O Service Desk é o único ponto de finalização antes do usuário final.
            </p>
          </div>
        </div>

        <div className="relative mt-5 flex flex-wrap items-center gap-2 text-[12px] font-semibold">
          {[
            WORKFLOW_AREAS.requester,
            WORKFLOW_AREAS.service_desk,
            WORKFLOW_AREAS.n3_infra_security,
            WORKFLOW_AREAS.n3_networks,
            WORKFLOW_AREAS.end_user,
          ].map((a, i, arr) => (
            <React.Fragment key={a.short}>
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/15"
                style={{ boxShadow: `inset 3px 0 0 ${a.color}` }}
              >
                {a.short}
              </span>
              {i < arr.length - 1 && <ArrowRight className="w-3.5 h-3.5 text-white/40" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {FLOW.map((step) => (
          <div
            key={step.title}
            className="bg-white border border-[#e8eef5] rounded-xl p-4 shadow-sm flex gap-3"
            style={{ borderLeftWidth: 4, borderLeftColor: step.color }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
              style={{ background: step.color }}
            >
              {step.icon}
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#002d5b]">{step.title}</h3>
              <p className="text-[12px] text-slate-600 mt-1 leading-relaxed">{step.text}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-[#e8eef5] rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-bold text-[#002d5b] mb-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#1890ff]" />
          Estágios do pipeline
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
          {(Object.keys(WORKFLOW_STAGES) as Array<keyof typeof WORKFLOW_STAGES>).map((id) => {
            const s = WORKFLOW_STAGES[id];
            return (
              <div key={id} className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5">
                <div className="text-[11px] font-bold text-[#1890ff]">Etapa {s.order}</div>
                <div className="text-sm font-semibold text-slate-800">{s.label}</div>
                <p className="text-[11px] text-slate-500 mt-0.5">{s.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            addToast({
              type: 'info',
              title: 'Operação',
              message: 'Use Ferramentas → Board Workflow para acompanhar a fila em tempo real.',
            })
          }
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#1890ff] hover:bg-[#096dd9]"
        >
          <Headphones className="w-4 h-4" />
          Ver board operacional
        </button>
        <p className="text-[12px] text-slate-500 self-center">
          SMTP em Configuração → SMTP / E-mail. Caixas SD, N3 Infra e N3 Redes alimentam os alertas.
        </p>
      </div>
    </div>
  );
};
