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

/** Catálogo exibido na tela de login */
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
      'Chamados e board workflow',
      'Checklist e status',
      'Abre integração N3',
      'Relatórios e exportação',
    ],
    color: '#1890ff',
  },
  {
    role: 'rh',
    title: 'Recursos Humanos',
    short: 'RH',
    badge: 'Solicitante',
    description:
      'Registra contratações e desligamentos. Acompanha o andamento sem alterar configuração do sistema.',
    accessSummary: [
      'Novo onboarding / offboarding',
      'Acompanhar chamados',
      'Board e relatórios',
      'Templates de notificação',
    ],
    color: '#13c2c2',
  },
  {
    role: 'gestor',
    title: 'Gestor',
    short: 'Gestão',
    badge: 'Liderança',
    description:
      'Acompanha solicitações da equipe e pode abrir onboarding de novos colaboradores sob sua gestão.',
    accessSummary: [
      'Visualizar chamados',
      'Novo onboarding',
      'Relatórios da operação',
      'Sem exclusão ou config',
    ],
    color: '#fa8c16',
  },
  {
    role: 'viewer',
    title: 'Visualizador',
    short: 'Leitura',
    badge: 'Somente leitura',
    description: 'Consulta o andamento dos chamados sem criar, editar ou administrar o portal.',
    accessSummary: ['Ver chamados', 'Consultar board', 'Sem alterações'],
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
    'tools.export',
    'tools.templates',
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
  rh: [
    'dashboard',
    'onboarding',
    'offboarding',
    'tools-workflow',
    'tools-reports',
    'tools-export',
    'tools-notifications',
    'tools-terms',
  ],
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
