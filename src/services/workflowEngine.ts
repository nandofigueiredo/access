import {
  DEFAULT_SMTP,
  OutboundEmailLog,
  SmtpConfig,
  TicketWorkflow,
  WorkflowAreaId,
  WorkflowEvent,
  WorkflowHandoff,
  WorkflowStageId,
} from '../types/workflow';

const SMTP_KEY = 'portal_ti_smtp_config_v1';
const MAIL_LOG_KEY = 'portal_ti_email_log_v1';

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function loadSmtpConfig(): SmtpConfig {
  try {
    const raw = localStorage.getItem(SMTP_KEY);
    if (raw) return { ...DEFAULT_SMTP, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return { ...DEFAULT_SMTP };
}

export function saveSmtpConfig(cfg: SmtpConfig) {
  localStorage.setItem(SMTP_KEY, JSON.stringify(cfg));
}

export function loadEmailLog(): OutboundEmailLog[] {
  try {
    const raw = localStorage.getItem(MAIL_LOG_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

export function pushEmailLog(entry: OutboundEmailLog) {
  const list = [entry, ...loadEmailLog()].slice(0, 200);
  localStorage.setItem(MAIL_LOG_KEY, JSON.stringify(list));
  return list;
}

export function createInitialWorkflow(actor: string): TicketWorkflow {
  const now = new Date().toISOString();
  const event: WorkflowEvent = {
    id: uid('evt'),
    at: now,
    actor,
    area: 'requester',
    action: 'SOLICITACAO_CRIADA',
    detail: 'Demanda enviada para a fila do Service Desk.',
  };
  return {
    stage: 'awaiting_service_desk',
    currentOwner: 'service_desk',
    handoffs: [],
    timeline: [event],
    closedByServiceDesk: false,
  };
}

export function appendEvent(
  wf: TicketWorkflow,
  partial: Omit<WorkflowEvent, 'id' | 'at'> & { at?: string }
): TicketWorkflow {
  const event: WorkflowEvent = {
    id: uid('evt'),
    at: partial.at || new Date().toISOString(),
    actor: partial.actor,
    area: partial.area,
    action: partial.action,
    detail: partial.detail,
    emailSent: partial.emailSent,
    emailTo: partial.emailTo,
  };
  return { ...wf, timeline: [event, ...wf.timeline] };
}

export function openHandoff(
  wf: TicketWorkflow,
  area: WorkflowHandoff['area'],
  title: string,
  description: string,
  actor: string
): TicketWorkflow {
  const now = new Date().toISOString();
  const handoff: WorkflowHandoff = {
    id: uid('hd'),
    area,
    title,
    description,
    status: 'open',
    createdAt: now,
    updatedAt: now,
    createdBy: actor,
  };
  let next = {
    ...wf,
    handoffs: [...wf.handoffs, handoff],
    stage: 'waiting_n3_integration' as WorkflowStageId,
    currentOwner: area as WorkflowAreaId,
  };
  next = appendEvent(next, {
    actor,
    area: 'service_desk',
    action: 'HANDOFF_ABERTO',
    detail: `${title} → ${area}`,
  });
  return next;
}

export function updateHandoffStatus(
  wf: TicketWorkflow,
  handoffId: string,
  status: WorkflowHandoff['status'],
  actor: string,
  notes?: string,
  deliverables?: string[]
): TicketWorkflow {
  const handoffs = wf.handoffs.map((h) =>
    h.id === handoffId
      ? {
          ...h,
          status,
          notes: notes ?? h.notes,
          deliverables: deliverables ?? h.deliverables,
          updatedAt: new Date().toISOString(),
          assignee: actor,
        }
      : h
  );
  const openLeft = handoffs.some((h) => h.status === 'open' || h.status === 'in_progress');
  let stage: WorkflowStageId = wf.stage;
  let currentOwner: WorkflowAreaId = wf.currentOwner;

  if (openLeft) {
    stage = handoffs.some((h) => h.status === 'in_progress') ? 'n3_in_progress' : 'waiting_n3_integration';
    const active = handoffs.find((h) => h.status === 'open' || h.status === 'in_progress');
    if (active) currentOwner = active.area;
  } else if (handoffs.length > 0) {
    stage = 'ready_for_sd_closure';
    currentOwner = 'service_desk';
  }

  let next: TicketWorkflow = { ...wf, handoffs, stage, currentOwner };
  next = appendEvent(next, {
    actor,
    area: handoffs.find((h) => h.id === handoffId)?.area || 'system',
    action: 'HANDOFF_ATUALIZADO',
    detail: `Status → ${status}${notes ? ` · ${notes}` : ''}`,
  });
  return next;
}

export function claimByServiceDesk(wf: TicketWorkflow, actor: string): TicketWorkflow {
  let next: TicketWorkflow = {
    ...wf,
    stage: 'in_service_desk',
    currentOwner: 'service_desk',
  };
  next = appendEvent(next, {
    actor,
    area: 'service_desk',
    action: 'SD_ASSUMIU',
    detail: 'Service Desk iniciou o atendimento.',
  });
  return next;
}

/**
 * Regra de ouro: somente Service Desk finaliza.
 * Exige handoffs abertos = 0 (ou inexistentes).
 */
export function finalizeByServiceDesk(
  wf: TicketWorkflow,
  actor: string,
  delivery: { summary: string; items: string[]; sentTo: string[] }
): { ok: true; workflow: TicketWorkflow } | { ok: false; error: string } {
  const open = wf.handoffs.filter((h) => h.status === 'open' || h.status === 'in_progress');
  if (open.length > 0) {
    return {
      ok: false,
      error: `Ainda há ${open.length} integração(ões) N3 aberta(s). O Service Desk só pode finalizar após todas concluírem.`,
    };
  }
  if (wf.currentOwner !== 'service_desk' && wf.stage !== 'ready_for_sd_closure' && wf.stage !== 'in_service_desk' && wf.stage !== 'awaiting_service_desk') {
    return { ok: false, error: 'A demanda precisa estar sob responsabilidade do Service Desk para fechamento.' };
  }

  const now = new Date().toISOString();
  let next: TicketWorkflow = {
    ...wf,
    stage: 'completed',
    currentOwner: 'end_user',
    closedByServiceDesk: true,
    closedAt: now,
    closedBy: actor,
    deliveryPackage: { ...delivery, sentAt: now },
  };
  next = appendEvent(next, {
    actor,
    area: 'service_desk',
    action: 'SD_FINALIZOU',
    detail: delivery.summary,
    emailSent: true,
    emailTo: delivery.sentTo,
  });
  return { ok: true, workflow: next };
}

export function queueWorkflowEmail(params: {
  smtp: SmtpConfig;
  to: string[];
  subject: string;
  body: string;
  template: string;
  ticketId?: string;
}): OutboundEmailLog {
  const entry: OutboundEmailLog = {
    id: uid('mail'),
    at: new Date().toISOString(),
    to: params.to.filter(Boolean),
    subject: params.subject,
    body: params.body,
    template: params.template,
    ticketId: params.ticketId,
    status: params.smtp.testMode || !params.smtp.enabled ? 'sent_simulated' : 'queued',
  };
  pushEmailLog(entry);
  return entry;
}
