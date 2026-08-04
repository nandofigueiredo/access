import type { TicketWorkflow } from './types/workflow';

export type TicketType = 'onboarding' | 'offboarding';
export type TicketStatus = 'Pendente TI' | 'Em Andamento' | 'Concluído' | 'Aguardando N3' | 'Pronta p/ Fechamento';
export type WorkMode = 'Presencial' | 'Híbrido' | 'Remoto';
export type Department = 'Financeiro' | 'RH' | 'Operações' | 'Comercial' | 'TI' | 'Jurídico' | 'Marketing' | 'Engenharia';
export type HardwareProfile = 'Padrão Admin' | 'Padrão Avançado';
export type PowerBiRole = 'Visualizador' | 'Criador' | 'Nenhum';
export type ReturnLogisticsMode = 'Presencial' | 'Correios';

export type { TicketWorkflow };

export interface UserProfile {
  name: string;
  email: string;
  jobTitle?: string;
  department?: string;
  photoUrl?: string;
  tenantId?: string;
  role?: 'admin' | 'ti' | 'rh' | 'gestor' | 'viewer';
  isAuthenticated: boolean;
  isDemo?: boolean;
}

export interface OnboardingData {
  id: string;
  type: 'onboarding';
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  
  // 1. Dados do Colaborador
  nomeCompleto: string;
  cpf: string;
  emailPessoal: string;
  cargo: string;
  departamento: Department;
  gestor: string;
  dataInicio: string; // ISO date string YYYY-MM-DD
  modalidade: WorkMode;
  enderecoEntrega?: string;

  // 2. Especificação do Equipamento (Hardware)
  perfilHardware: HardwareProfile;
  justificativaHardware?: string;
  perifericos: {
    monitor: boolean;
    tecladoMouse: boolean;
    headset: boolean;
    suporteErgonomico: boolean;
  };
  telefonia: {
    simCard: boolean;
    smartphone: boolean;
  };

  // 3. Acessos e Sistemas Administrativos
  copiarAcessosDe?: string;
  plataformaBase: {
    office365: boolean;
    teamsSlack: boolean;
    gerenciadorSenhas: boolean;
  };
  sistemasEspecificos: {
    erp: boolean;
    erpDetalhe?: string;
    crm: boolean;
    crmDetalhe?: string;
    powerBi: PowerBiRole;
    pastasCompartilhadas: boolean;
    pastasDetalhe?: string;
    vpn: boolean;
    assinaturaDigital: boolean;
  };

  // 4. Acesso Físico
  unidade: string;
  necessitaCracha: boolean;

  // LGPD
  lgpdAceito: boolean;
  
  // IT Checklist (boolean legado ou { done, team, doneBy, doneAt })
  itChecklist?: Record<string, boolean | {
    done: boolean;
    team?: string;
    doneBy?: string;
    doneAt?: string;
  }>;
  itNotes?: string;
  /** Workflow multiárea */
  workflow?: TicketWorkflow;
  requesterEmail?: string;
  assignedQueue?: string;
  /** Número do chamado no GLPI (glpi@diroma.com.br) */
  glpiTicketNumber?: string;
}

export interface OffboardingData {
  id: string;
  type: 'offboarding';
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string;

  // 1. Dados da Revogação
  nomeCompleto: string;
  emailCorporativo: string;
  gestor: string;
  dataHoraDesligamento: string; // ISO datetime

  // 2. Tratamento de Arquivos e E-mails (LGPD)
  redirecionamentoEmail: boolean;
  emailDestinoRedirecionamento?: string;
  transferenciaArquivos: boolean;
  emailDestinoArquivos?: string;
  respostaAutomaticaAusencia: boolean;
  orientadoNaoManterArquivosPessoais: boolean;

  // 3. Devolução de Ativos / Logística Reversa
  ativos: {
    notebook: boolean;
    codigoPatrimonioNotebook?: string;
    perifericos: boolean;
    smartphone: boolean;
    cracha: boolean;
  };
  modalidadeDevolucao: ReturnLogisticsMode;
  prazoLimiteDevolucao: string;

  // 4. Checklist de Encerramento (Uso Exclusivo TI)
  itChecklist: Record<string, boolean | {
    done: boolean;
    team?: string;
    doneBy?: string;
    doneAt?: string;
  }>;
  itNotes?: string;
  workflow?: TicketWorkflow;
  requesterEmail?: string;
  assignedQueue?: string;
  /** Número do chamado no GLPI (glpi@diroma.com.br) */
  glpiTicketNumber?: string;
}

export type Ticket = OnboardingData | OffboardingData;

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
}

export interface MsalConfigState {
  clientId: string;
  tenantId: string;
  redirectUri: string;
  configured: boolean;
}
