import type { UserProfile } from '../types';
import type { AppPage } from '../types/catalog';

/** Papéis do portal — admin reservado à equipe N3 */
export type AccessRole = NonNullable<UserProfile['role']>;

export type Permission =
  | 'tickets.view'
  | 'tickets.create.onboarding'
  | 'tickets.create.offboarding'
  | 'tickets.updateStatus'
  | 'tickets.delete'
  | 'tickets.checklist'
  | 'workflow.board'
  | 'workflow.serviceDesk'
  | 'workflow.n3'
  | 'tools.reports'
  | 'tools.export'
  | 'tools.templates'
  | 'admin.manage'
  | 'config.manage'
  | 'audit.view'
  | 'entra.manage';

export interface AccessProfile {
  role: AccessRole;
  title: string;
  short: string;
  badge: string;
  description: string;
  accessSummary: string[];
  color: string;
  /** Destaque visual no login (Admin N3) */
  featured?: boolean;
}

/** Catálogo exibido na tela de login / Usuários & Perfis */
export const ACCESS_PROFILES: AccessProfile[] = [
  {
    role: 'admin',
    title: 'Admin N3',
    short: 'N3',
    badge: 'Equipe N3',
    description:
      'Exclusivo da equipe N3 (Infra, Segurança e Redes). Administração completa do portal, integrações N3 e configuração do sistema.',
    accessSummary: [
      'Administração e configuração',
      'Handoffs N3 Infra / Redes',
      'Auditoria e Entra ID',
      'Todos os chamados e ferramentas',
    ],
    color: '#722ed1',
    featured: true,
  },
  {
    role: 'ti',
    title: 'Service Desk',
    short: 'SD',
    badge: 'N1 / N2',
    description:
      'Opera a fila de onboarding e offboarding: assume chamados, executa checklist TI e finaliza demandas.',
    accessSummary: [
      'Fila completa de chamados',
      'Checklist, status e board',
      'Abre integração N3',
      'Relatórios, exportação e templates',
    ],
    color: '#1890ff',
  },
  {
    role: 'rh',
    title: 'Recursos Humanos',
    short: 'RH',
    description:
      'Registra contratações e desligamentos. Acompanha o andamento de todos os chamados sem operar checklist TI nem configurar o sistema.',
    badge: 'Solicitante',
    accessSummary: [
      'Novo onboarding / offboarding',
      'Ver todos os chamados (leitura)',
      'Board e relatórios',
      'Sem admin, export ou templates',
    ],
    color: '#13c2c2',
  },
  {
    role: 'gestor',
    title: 'Gestor',
    short: 'Gestão',
    badge: 'Liderança',
    description:
      'Abre onboarding da equipe e acompanha apenas os chamados em que é solicitante ou gestor indicado.',
    accessSummary: [
      'Novo onboarding',
      'Chamados do seu escopo',
      'Board e relatórios filtrados',
      'Sem offboarding, exclusão ou config',
    ],
    color: '#fa8c16',
  },
  {
    role: 'viewer',
    title: 'Visualizador',
    short: 'Leitura',
    badge: 'Somente leitura',
    description:
      'Consulta somente os chamados que solicitou. Sem criar, editar ou administrar o portal.',
    accessSummary: ['Ver próprios chamados', 'Consultar board/relatórios', 'Sem alterações'],
    color: '#8c8c8c',
  },
];

const ROLE_PERMISSIONS: Record<AccessRole, Permission[]> = {
  admin: [
    'tickets.view',
    'tickets.create.onboarding',
    'tickets.create.offboarding',
    'tickets.updateStatus',
    'tickets.delete',
    'tickets.checklist',
    'workflow.board',
    'workflow.serviceDesk',
    'workflow.n3',
    'tools.reports',
    'tools.export',
    'tools.templates',
    'admin.manage',
    'config.manage',
    'audit.view',
    'entra.manage',
  ],
  ti: [
    'tickets.view',
    'tickets.updateStatus',
    'tickets.delete',
    'tickets.checklist',
    'workflow.board',
    'workflow.serviceDesk',
    'tools.reports',
    'tools.export',
    'tools.templates',
  ],
  rh: [
    'tickets.view',
    'tickets.create.onboarding',
    'tickets.create.offboarding',
    'workflow.board',
    'tools.reports',
  ],
  gestor: [
    'tickets.view',
    'tickets.create.onboarding',
    'workflow.board',
    'tools.reports',
  ],
  viewer: ['tickets.view', 'workflow.board', 'tools.reports'],
};

/** Páginas liberadas por papel */
export const ROLE_PAGES: Record<AccessRole, AppPage[]> = {
  admin: [
    'dashboard',
    'onboarding',
    'offboarding',
    'tools-workflow',
    'tools-reports',
    'tools-export',
    'tools-notifications',
    'tools-terms',
    'admin-users',
    'admin-units',
    'admin-managers',
    'admin-queues',
    'admin-audit',
    'admin-domains',
    'config-fields',
    'config-departments',
    'config-positions',
    'config-workmodes',
    'config-hardware',
    'config-peripherals',
    'config-systems',
    'config-checklist-onb',
    'config-checklist-off',
    'config-statuses',
    'config-assets',
    'config-return',
    'config-sla',
    'config-smtp',
    'config-workflow',
    'config-entra',
    'config-general',
  ],
  ti: [
    'dashboard',
    'tools-workflow',
    'tools-reports',
    'tools-export',
    'tools-notifications',
    'tools-terms',
  ],
  rh: ['dashboard', 'onboarding', 'offboarding', 'tools-workflow', 'tools-reports'],
  gestor: ['dashboard', 'onboarding', 'tools-workflow', 'tools-reports'],
  viewer: ['dashboard', 'tools-workflow', 'tools-reports'],
};

export function getProfile(role: AccessRole | undefined | null): AccessProfile {
  return ACCESS_PROFILES.find((p) => p.role === role) || ACCESS_PROFILES[ACCESS_PROFILES.length - 1];
}

export function can(role: AccessRole | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function canAccessPage(role: AccessRole | undefined | null, page: AppPage): boolean {
  if (!role) return false;
  return ROLE_PAGES[role]?.includes(page) ?? false;
}

export function defaultPageForRole(role: AccessRole | undefined | null): AppPage {
  const pages = role ? ROLE_PAGES[role] : undefined;
  return pages?.[0] || 'dashboard';
}

export function roleLabel(role: AccessRole | undefined | null): string {
  return getProfile(role).title;
}

/** Quem vê todos os chamados (sem filtro de solicitante/gestor). */
export function seesAllTickets(role: AccessRole | undefined | null): boolean {
  return role === 'admin' || role === 'ti' || role === 'rh';
}

/**
 * Escopo de chamados no front (espelha o backend).
 * admin/ti/rh: todos; gestor: solicitante ou gestor; viewer: só solicitante.
 */
export function ticketInScope(
  role: AccessRole | undefined | null,
  user: { email?: string; name?: string } | null | undefined,
  ticket: { requesterEmail?: string | null; gestor?: string | null },
): boolean {
  if (!role) return false;
  if (seesAllTickets(role)) return true;
  const email = (user?.email || '').trim().toLowerCase();
  const requester = (ticket.requesterEmail || '').trim().toLowerCase();
  if (role === 'viewer') {
    return Boolean(email) && requester === email;
  }
  if (role === 'gestor') {
    if (email && requester === email) return true;
    const name = (user?.name || '').trim().toLowerCase();
    const manager = (ticket.gestor || '').trim().toLowerCase();
    return Boolean(name) && Boolean(manager) && manager.includes(name);
  }
  return false;
}

/** Perfis de demonstração (login local) */
export const DEMO_USERS: Record<AccessRole, UserProfile> = {
  admin: {
    name: 'Equipe N3 Admin',
    email: 'n3.admin@diroma.com.br',
    jobTitle: 'Especialista N3 — Infra / Segurança',
    department: 'TI',
    role: 'admin',
    isAuthenticated: true,
    isDemo: true,
    tenantId: 'diroma-demo',
  },
  ti: {
    name: 'Operador Service Desk',
    email: 'sd.operador@diroma.com.br',
    jobTitle: 'Analista Service Desk',
    department: 'TI',
    role: 'ti',
    isAuthenticated: true,
    isDemo: true,
    tenantId: 'diroma-demo',
  },
  rh: {
    name: 'Analista de RH',
    email: 'rh.operacoes@diroma.com.br',
    jobTitle: 'Analista de Recursos Humanos',
    department: 'RH',
    role: 'rh',
    isAuthenticated: true,
    isDemo: true,
    tenantId: 'diroma-demo',
  },
  gestor: {
    name: 'Gestor de Área',
    email: 'gestor.area@diroma.com.br',
    jobTitle: 'Gestor',
    department: 'Operações',
    role: 'gestor',
    isAuthenticated: true,
    isDemo: true,
    tenantId: 'diroma-demo',
  },
  viewer: {
    name: 'Consultor Visualização',
    email: 'viewer@diroma.com.br',
    jobTitle: 'Visualizador',
    department: 'TI',
    role: 'viewer',
    isAuthenticated: true,
    isDemo: true,
    tenantId: 'diroma-demo',
  },
};
