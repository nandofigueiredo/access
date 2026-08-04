import type { CatalogItem } from '../types/catalog';
import type { WorkflowAreaId, WorkflowStageId, TicketWorkflow } from '../types/workflow';
import { openHandoff } from './workflowEngine';

/** Equipes que executam itens do checklist TI */
export type ChecklistTeam = 'service_desk' | 'n3_infra_security' | 'n3_networks';

export interface ChecklistItemState {
  done: boolean;
  team: ChecklistTeam;
  doneBy?: string;
  doneAt?: string;
}

export type ItChecklistMap = Record<string, ChecklistItemState>;

export const CHECKLIST_TEAMS: {
  id: ChecklistTeam;
  label: string;
  short: string;
}[] = [
  { id: 'service_desk', label: 'Service Desk', short: 'SD' },
  { id: 'n3_infra_security', label: 'N3 Infra / Segurança', short: 'N3 Infra' },
  { id: 'n3_networks', label: 'N3 Redes', short: 'N3 Redes' },
];

export function teamLabel(team: ChecklistTeam): string {
  return CHECKLIST_TEAMS.find((t) => t.id === team)?.label || team;
}

export function teamShort(team: ChecklistTeam): string {
  return CHECKLIST_TEAMS.find((t) => t.id === team)?.short || team;
}

function isChecklistTeam(v: unknown): v is ChecklistTeam {
  return v === 'service_desk' || v === 'n3_infra_security' || v === 'n3_networks';
}

export function parseItemState(raw: unknown, fallbackTeam: ChecklistTeam): ChecklistItemState {
  if (typeof raw === 'boolean') {
    return { done: raw, team: fallbackTeam };
  }
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    return {
      done: Boolean(o.done ?? o.checked),
      team: isChecklistTeam(o.team) ? o.team : fallbackTeam,
      doneBy: typeof o.doneBy === 'string' ? o.doneBy : undefined,
      doneAt: typeof o.doneAt === 'string' ? o.doneAt : undefined,
    };
  }
  return { done: false, team: fallbackTeam };
}

export function defaultTeamFromCatalog(item: CatalogItem): ChecklistTeam {
  const t = item.meta?.team;
  return isChecklistTeam(t) ? t : 'service_desk';
}

export function checklistKeyOf(item: CatalogItem): string {
  const k = item.meta?.key;
  if (typeof k === 'string' && k.trim()) return k.trim();
  return item.id;
}

/** Monta mapa a partir do catálogo + estado salvo no ticket (legado boolean ok). */
export function buildChecklistState(
  catalogItems: CatalogItem[],
  saved: Record<string, unknown> | null | undefined
): ItChecklistMap {
  const out: ItChecklistMap = {};
  const active = [...catalogItems]
    .filter((i) => i.active !== false)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  for (const item of active) {
    const key = checklistKeyOf(item);
    const fallback = defaultTeamFromCatalog(item);
    out[key] = parseItemState(saved?.[key], fallback);
    // Se ainda não havia atribuição no ticket, usa default do catálogo
    if (!saved?.[key] || typeof saved[key] === 'boolean') {
      out[key] = { ...out[key], team: fallback };
    }
  }

  // Preserva chaves legadas que não estão no catálogo
  if (saved) {
    for (const [key, val] of Object.entries(saved)) {
      if (out[key]) continue;
      out[key] = parseItemState(val, 'service_desk');
    }
  }
  return out;
}

export function checklistProgress(state: ItChecklistMap): { done: number; total: number; byTeam: Record<ChecklistTeam, { done: number; total: number }> } {
  const keys = Object.keys(state);
  const byTeam: Record<ChecklistTeam, { done: number; total: number }> = {
    service_desk: { done: 0, total: 0 },
    n3_infra_security: { done: 0, total: 0 },
    n3_networks: { done: 0, total: 0 },
  };
  let done = 0;
  for (const key of keys) {
    const item = state[key];
    byTeam[item.team].total += 1;
    if (item.done) {
      done += 1;
      byTeam[item.team].done += 1;
    }
  }
  return { done, total: keys.length, byTeam };
}

/** SD atribui qualquer; N3 só marca itens da própria área; admin N3 cobre as duas áreas N3. */
export function canToggleChecklistItem(opts: {
  canServiceDesk: boolean;
  canN3: boolean;
  itemTeam: ChecklistTeam;
}): boolean {
  if (opts.canServiceDesk) return true;
  if (!opts.canN3) return false;
  return opts.itemTeam === 'n3_infra_security' || opts.itemTeam === 'n3_networks';
}

export function canAssignChecklistTeam(canServiceDesk: boolean): boolean {
  return canServiceDesk;
}

/** Abre handoffs N3 para equipes com itens atribuídos e ainda não concluídos. */
export function ensureHandoffsForAssignedTeams(
  wf: TicketWorkflow,
  state: ItChecklistMap,
  actor: string
): TicketWorkflow {
  let next = wf;
  const needed = new Set<ChecklistTeam>();
  for (const item of Object.values(state)) {
    if (item.team !== 'service_desk' && !item.done) {
      needed.add(item.team);
    }
  }
  for (const area of needed) {
    const already = next.handoffs.some(
      (h) => h.area === area && (h.status === 'open' || h.status === 'in_progress')
    );
    if (already) continue;
    const title =
      area === 'n3_infra_security' ? 'N3 Infra / Segurança (checklist)' : 'N3 Redes (checklist)';
    next = openHandoff(
      next,
      area as 'n3_infra_security' | 'n3_networks',
      title,
      'Handoff aberto automaticamente a partir da atribuição do checklist pelo Service Desk.',
      actor
    );
  }
  return next;
}

/** Cancela handoffs N3 de equipes que não têm mais itens pendentes atribuídos. */
export function pruneUnusedHandoffs(
  wf: TicketWorkflow,
  state: ItChecklistMap,
  actor: string
): TicketWorkflow {
  const needed = new Set<string>();
  for (const item of Object.values(state)) {
    if (item.team !== 'service_desk' && !item.done) {
      needed.add(item.team);
    }
  }
  // Também mantém handoff se ainda há itens da equipe (mesmo concluídos) com handoff in_progress? 
  // Só cancela se a equipe não aparece em nenhum item incompleto.
  let changed = false;
  const handoffs = wf.handoffs.map((h) => {
    if (
      (h.status === 'open' || h.status === 'in_progress') &&
      (h.area === 'n3_infra_security' || h.area === 'n3_networks') &&
      !needed.has(h.area)
    ) {
      changed = true;
      return {
        ...h,
        status: 'cancelled' as const,
        updatedAt: new Date().toISOString(),
        notes: 'Cancelado: equipe não atribuída neste chamado.',
      };
    }
    return h;
  });
  if (!changed) return wf;
  let next: TicketWorkflow = { ...wf, handoffs };
  next = {
    ...next,
    timeline: [
      {
        id: `evt-${Date.now().toString(36)}`,
        at: new Date().toISOString(),
        actor,
        area: 'service_desk',
        action: 'HANDOFF_CANCELADO',
        detail: 'Handoffs de equipes não necessárias foram cancelados.',
      },
      ...next.timeline,
    ],
  };
  return next;
}

/**
 * Atualiza stage/dono do workflow com base na checklist e handoffs.
 * Etapas N3 só entram no caminho se houver atribuição.
 */
export function syncWorkflowFromChecklist(
  wf: TicketWorkflow,
  state: ItChecklistMap,
  actor: string
): TicketWorkflow {
  let next = ensureHandoffsForAssignedTeams(wf, state, actor);
  next = pruneUnusedHandoffs(next, state, actor);

  if (next.stage === 'completed') return next;

  const items = Object.values(state);
  const allDone = items.length > 0 && items.every((i) => i.done);
  const hasN3Pending = items.some((i) => i.team !== 'service_desk' && !i.done);
  const hasSdPending = items.some((i) => i.team === 'service_desk' && !i.done);
  const openHandoffs = next.handoffs.filter((h) => h.status === 'open' || h.status === 'in_progress');
  const claimed =
    next.stage !== 'awaiting_service_desk' ||
    next.currentOwner === 'service_desk' ||
    next.timeline.some((e) => e.action === 'SD_ASSUMIU');

  if (allDone && openHandoffs.length === 0) {
    next = {
      ...next,
      stage: 'ready_for_sd_closure',
      currentOwner: 'service_desk',
    };
  } else if (hasN3Pending || openHandoffs.length > 0) {
    const inProgress = openHandoffs.some((h) => h.status === 'in_progress');
    const active = openHandoffs.find((h) => h.status === 'open' || h.status === 'in_progress');
    next = {
      ...next,
      stage: inProgress ? 'n3_in_progress' : 'waiting_n3_integration',
      currentOwner: (active?.area as WorkflowAreaId) || 'n3_infra_security',
    };
  } else if (claimed || hasSdPending) {
    next = {
      ...next,
      stage: 'in_service_desk',
      currentOwner: 'service_desk',
    };
  } else {
    next = {
      ...next,
      stage: 'awaiting_service_desk',
      currentOwner: 'service_desk',
    };
  }

  return next;
}

/** Etapas do pipeline relevantes para este chamado (sem N3 se não atribuído). */
export function relevantPipelineStages(state: ItChecklistMap, wf: TicketWorkflow): WorkflowStageId[] {
  const needsInfra =
    Object.values(state).some((i) => i.team === 'n3_infra_security') ||
    wf.handoffs.some((h) => h.area === 'n3_infra_security' && h.status !== 'cancelled');
  const needsNetworks =
    Object.values(state).some((i) => i.team === 'n3_networks') ||
    wf.handoffs.some((h) => h.area === 'n3_networks' && h.status !== 'cancelled');

  const stages: WorkflowStageId[] = ['awaiting_service_desk', 'in_service_desk'];
  if (needsInfra || needsNetworks) {
    stages.push('waiting_n3_integration', 'n3_in_progress');
  }
  stages.push('ready_for_sd_closure', 'completed');
  return stages;
}

export function relevantAreaPipeline(state: ItChecklistMap, wf: TicketWorkflow): WorkflowAreaId[] {
  const areas: WorkflowAreaId[] = ['requester', 'service_desk'];
  const needsInfra =
    Object.values(state).some((i) => i.team === 'n3_infra_security') ||
    wf.handoffs.some((h) => h.area === 'n3_infra_security' && h.status !== 'cancelled');
  const needsNetworks =
    Object.values(state).some((i) => i.team === 'n3_networks') ||
    wf.handoffs.some((h) => h.area === 'n3_networks' && h.status !== 'cancelled');
  if (needsInfra) areas.push('n3_infra_security');
  if (needsNetworks) areas.push('n3_networks');
  areas.push('end_user');
  return areas;
}

export function markTeamItemsDone(
  state: ItChecklistMap,
  team: ChecklistTeam,
  actor: string
): ItChecklistMap {
  const now = new Date().toISOString();
  const out: ItChecklistMap = { ...state };
  for (const [key, item] of Object.entries(state)) {
    if (item.team === team) {
      out[key] = { ...item, done: true, doneBy: actor, doneAt: now };
    }
  }
  return out;
}

export function areaFromRole(canServiceDesk: boolean, canN3: boolean): ChecklistTeam | null {
  if (canServiceDesk) return 'service_desk';
  if (canN3) return 'n3_infra_security'; // admin cobre ambas via canToggle
  return null;
}
