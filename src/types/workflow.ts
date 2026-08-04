/** Workflow multiárea — RH → Service Desk → N3 → fechamento exclusivo SD → usuário final */

export type WorkflowAreaId =
  | 'requester'
  | 'service_desk'
  | 'n3_infra_security'
  | 'n3_networks'
  | 'end_user';

export type WorkflowStageId =
  | 'draft_created'
  | 'awaiting_service_desk'
  | 'in_service_desk'
  | 'waiting_n3_integration'
  | 'n3_in_progress'
  | 'ready_for_sd_closure'
  | 'completed'
  | 'cancelled';

export type HandoffStatus = 'open' | 'in_progress' | 'done' | 'cancelled';

export interface WorkflowHandoff {
  id: string;
  area: Extract<WorkflowAreaId, 'n3_infra_security' | 'n3_networks'>;
  title: string;
  description: string;
  status: HandoffStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  assignee?: string;
  notes?: string;
  /** Ex.: IP liberado, VLAN, MFA */
  deliverables?: string[];
}

export interface WorkflowEvent {
  id: string;
  at: string;
  actor: string;
  area: WorkflowAreaId | 'system';
  action: string;
  detail?: string;
  emailSent?: boolean;
  emailTo?: string[];
}

export interface TicketWorkflow {
  stage: WorkflowStageId;
  currentOwner: WorkflowAreaId;
  handoffs: WorkflowHandoff[];
  timeline: WorkflowEvent[];
  /** Somente Service Desk pode true */
  closedByServiceDesk: boolean;
  closedAt?: string;
  closedBy?: string;
  /** Pacote final enviado ao usuário */
  deliveryPackage?: {
    summary: string;
    items: string[];
    sentTo: string[];
    sentAt: string;
  };
}

export interface SmtpConfig {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
  replyTo?: string;
  /** Destinos padrão do workflow */
  serviceDeskInbox: string;
  n3InfraInbox: string;
  n3NetworksInbox: string;
  /** Caixa GLPI para abertura automática de chamado */
  glpiInbox: string;
  glpiEnabled: boolean;
  notifyRequesterOnCreate: boolean;
  notifyRequesterOnClose: boolean;
  notifyEndUserOnComplete: boolean;
  testMode: boolean;
}

export interface OutboundEmailLog {
  id: string;
  at: string;
  to: string[];
  subject: string;
  body: string;
  template: string;
  ticketId?: string;
  status: 'queued' | 'sent_simulated' | 'failed';
  error?: string;
}

export const WORKFLOW_AREAS: Record<
  WorkflowAreaId,
  { label: string; short: string; color: string; description: string }
> = {
  requester: {
    label: 'Solicitante (RH / Gestor)',
    short: 'RH',
    color: '#13c2c2',
    description: 'Cria onboarding/offboarding com data e requisitos.',
  },
  service_desk: {
    label: 'Service Desk',
    short: 'SD',
    color: '#1890ff',
    description: 'Orquestra a demanda, abre integrações N3 e é o único que finaliza.',
  },
  n3_infra_security: {
    label: 'N3 Infra / Segurança',
    short: 'N3 Infra',
    color: '#722ed1',
    description: 'Contas, MFA, licenças, MDM, hardening e segurança.',
  },
  n3_networks: {
    label: 'N3 Redes',
    short: 'N3 Redes',
    color: '#fa8c16',
    description: 'Liberação de IP, VLAN, VPN e conectividade.',
  },
  end_user: {
    label: 'Usuário final',
    short: 'User',
    color: '#52c41a',
    description: 'Recebe o pacote concluído (acessos, equipamentos, IPs).',
  },
};

export const WORKFLOW_STAGES: Record<
  WorkflowStageId,
  { label: string; description: string; order: number }
> = {
  draft_created: {
    label: 'Criada',
    description: 'Solicitação registrada pelo RH/Gestor.',
    order: 1,
  },
  awaiting_service_desk: {
    label: 'Fila Service Desk',
    description: 'Aguardando triagem do Service Desk.',
    order: 2,
  },
  in_service_desk: {
    label: 'Em atendimento SD',
    description: 'Service Desk executando ou coordenando.',
    order: 3,
  },
  waiting_n3_integration: {
    label: 'Integração N3',
    description: 'Pendências abertas em Infra/Segurança e/ou Redes.',
    order: 4,
  },
  n3_in_progress: {
    label: 'N3 em execução',
    description: 'Especialistas N3 trabalhando nos handoffs.',
    order: 5,
  },
  ready_for_sd_closure: {
    label: 'Pronta p/ fechamento',
    description: 'Handoffs concluídos — somente SD pode finalizar.',
    order: 6,
  },
  completed: {
    label: 'Concluída',
    description: 'SD finalizou e notificou solicitante/usuário final.',
    order: 7,
  },
  cancelled: {
    label: 'Cancelada',
    description: 'Demanda cancelada.',
    order: 8,
  },
};

export const DEFAULT_SMTP: SmtpConfig = {
  enabled: false,
  host: 'smtp.office365.com',
  port: 587,
  secure: false,
  username: '',
  password: '',
  fromName: 'Portal TI diRoma',
  fromEmail: 'noreply@diroma.com.br',
  replyTo: 'servicedesk@diroma.com.br',
  serviceDeskInbox: 'servicedesk@diroma.com.br',
  n3InfraInbox: 'n3.infra@diroma.com.br',
  n3NetworksInbox: 'n3.redes@diroma.com.br',
  glpiInbox: 'glpi@diroma.com.br',
  glpiEnabled: true,
  notifyRequesterOnCreate: true,
  notifyRequesterOnClose: true,
  notifyEndUserOnComplete: true,
  testMode: true,
};
