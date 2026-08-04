import { FormFieldConfig, SystemCatalog } from '../types/catalog';

const now = () => new Date().toISOString();

let seq = 1;
const id = (prefix: string) => `${prefix}-${String(seq++).padStart(3, '0')}`;

function item(name: string, extra?: Partial<{ description: string; meta: Record<string, string | boolean | number | null>; sortOrder: number }>) {
  return {
    id: id('cat'),
    name,
    description: extra?.description,
    active: true,
    sortOrder: extra?.sortOrder ?? seq,
    meta: extra?.meta,
  };
}

function field(partial: Omit<FormFieldConfig, 'id' | 'active'> & { id?: string }): FormFieldConfig {
  return {
    id: partial.id ?? id('fld'),
    active: true,
    ...partial,
  };
}

export function createDefaultCatalog(): SystemCatalog {
  seq = 1;
  return {
    departments: [
      item('Financeiro'),
      item('RH'),
      item('Operações'),
      item('Comercial'),
      item('TI'),
      item('Jurídico'),
      item('Marketing'),
      item('Engenharia'),
    ],
    positions: [
      item('Analista'),
      item('Assistente'),
      item('Coordenador'),
      item('Gerente'),
      item('Desenvolvedor'),
      item('Especialista'),
    ],
    workModes: [
      item('Presencial'),
      item('Híbrido'),
      item('Remoto'),
    ],
    hardwareProfiles: [
      item('Padrão Admin', { description: 'Notebook corporativo padrão (i5/16GB)' }),
      item('Padrão Avançado', { description: 'Notebook avançado (i7/32GB) — exige justificativa', meta: { requiresJustification: true } }),
    ],
    peripherals: [
      item('Monitor', { meta: { key: 'monitor' } }),
      item('Teclado e Mouse', { meta: { key: 'tecladoMouse' } }),
      item('Headset', { meta: { key: 'headset' } }),
      item('Suporte Ergonômico', { meta: { key: 'suporteErgonomico' } }),
      item('SIM Card', { meta: { key: 'simCard', group: 'telefonia' } }),
      item('Smartphone', { meta: { key: 'smartphone', group: 'telefonia' } }),
    ],
    basePlatforms: [
      item('Microsoft 365', { meta: { key: 'office365' } }),
      item('Teams / Slack', { meta: { key: 'teamsSlack' } }),
      item('Gerenciador de Senhas', { meta: { key: 'gerenciadorSenhas' } }),
    ],
    specificSystems: [
      item('ERP', { meta: { key: 'erp', hasDetail: true } }),
      item('CRM', { meta: { key: 'crm', hasDetail: true } }),
      item('Power BI', { meta: { key: 'powerBi', options: 'Visualizador,Criador,Nenhum' } }),
      item('Pastas Compartilhadas', { meta: { key: 'pastasCompartilhadas', hasDetail: true } }),
      item('VPN', { meta: { key: 'vpn' } }),
      item('Assinatura Digital', { meta: { key: 'assinaturaDigital' } }),
    ],
    units: [
      item('Sede Principal — São Paulo'),
      item('Caldas Novas — Hotéis & Parques'),
      item('Unidade Remota'),
    ],
    managers: [
      item('Ana Paula Souza', { meta: { email: 'ana.souza@diroma.com.br', department: 'TI' } }),
      item('Carlos Alberto Lima', { meta: { email: 'carlos.lima@diroma.com.br', department: 'RH' } }),
      item('Roberto Costa', { meta: { email: 'roberto.costa@diroma.com.br', department: 'Comercial' } }),
    ],
    ticketStatuses: [
      item('Pendente TI', { meta: { color: 'amber' } }),
      item('Em Andamento', { meta: { color: 'blue' } }),
      item('Concluído', { meta: { color: 'green' } }),
    ],
    returnMethods: [
      item('Presencial'),
      item('Correios'),
    ],
    assetTypes: [
      item('Notebook', { meta: { key: 'notebook', hasPatrimonio: true } }),
      item('Periféricos', { meta: { key: 'perifericos' } }),
      item('Smartphone', { meta: { key: 'smartphone' } }),
      item('Crachá', { meta: { key: 'cracha' } }),
    ],
    onboardingChecklist: [
      item('Hardware provisionado', { meta: { key: 'hardwareProvisionado', team: 'service_desk' } }),
      item('Conta Entra ID criada', { meta: { key: 'contaEntraIdCriada', team: 'n3_infra_security' } }),
      item('Sistemas liberados', { meta: { key: 'sistemasLiberados', team: 'n3_infra_security' } }),
      item('Rede / VPN / VLAN', { meta: { key: 'redeVpnVlan', team: 'n3_networks' } }),
      item('Crachá solicitado', { meta: { key: 'crachaSolicitado', team: 'service_desk' } }),
      item('Termo enviado', { meta: { key: 'termoEnviado', team: 'service_desk' } }),
    ],
    offboardingChecklist: [
      item('Bloqueio de identidade', { meta: { key: 'bloqueioIdP', team: 'n3_infra_security' } }),
      item('Encerramento de sessões', { meta: { key: 'encerramentoSessoes', team: 'n3_infra_security' } }),
      item('Desvinculação de licenças', { meta: { key: 'desvinculacaoLicencas', team: 'n3_infra_security' } }),
      item('Remoção de grupos de e-mail', { meta: { key: 'remocaoGruposEmail', team: 'service_desk' } }),
      item('Wipe / limpeza MDM', { meta: { key: 'limpezaWipeMDM', team: 'n3_infra_security' } }),
      item('Revogação de acessos de rede', { meta: { key: 'revogacaoRede', team: 'n3_networks' } }),
      item('Registro em logs de auditoria', { meta: { key: 'registroLogsAuditoria', team: 'service_desk' } }),
    ],
    users: [
      item('Luis Figueiredo', {
        description: 'Administrador',
        meta: { email: 'luis.figueiredo@diroma.com.br', role: 'admin' },
      }),
    ],
    serviceQueues: [
      item('Service Desk N1'),
      item('Service Desk N2 — Infra'),
      item('Service Desk N3 — Sistemas'),
      item('Identidade & Acessos'),
    ],
    emailTemplates: [
      item('Boas-vindas Onboarding', { description: 'E-mail ao gestor e colaborador' }),
      item('Confirmação Offboarding', { description: 'Alerta Zero-Day para TI' }),
      item('Resposta automática de ausência', { description: 'Template OOO' }),
    ],
    termTemplates: [
      item('Termo de Responsabilidade — Equipamento'),
      item('Termo LGPD — Tratamento de dados onboarding'),
      item('Termo de Devolução — Offboarding'),
    ],
    allowedDomains: [
      item('diroma.com.br'),
    ],
    formFields: [
      field({ form: 'onboarding', key: 'nomeCompleto', label: 'Nome completo', section: 'Colaborador', fieldType: 'text', required: true, visible: true, sortOrder: 1 }),
      field({ form: 'onboarding', key: 'cpf', label: 'CPF', section: 'Colaborador', fieldType: 'text', required: true, visible: true, sortOrder: 2 }),
      field({ form: 'onboarding', key: 'emailPessoal', label: 'E-mail pessoal', section: 'Colaborador', fieldType: 'email', required: true, visible: true, sortOrder: 3 }),
      field({ form: 'onboarding', key: 'cargo', label: 'Cargo', section: 'Colaborador', fieldType: 'select', required: true, visible: true, catalogSource: 'positions', sortOrder: 4 }),
      field({ form: 'onboarding', key: 'departamento', label: 'Departamento', section: 'Colaborador', fieldType: 'select', required: true, visible: true, catalogSource: 'departments', sortOrder: 5 }),
      field({ form: 'onboarding', key: 'gestor', label: 'Gestor', section: 'Colaborador', fieldType: 'select', required: true, visible: true, catalogSource: 'managers', sortOrder: 6 }),
      field({ form: 'onboarding', key: 'dataInicio', label: 'Data de início', section: 'Colaborador', fieldType: 'date', required: true, visible: true, sortOrder: 7 }),
      field({ form: 'onboarding', key: 'modalidade', label: 'Modalidade', section: 'Colaborador', fieldType: 'select', required: true, visible: true, catalogSource: 'workModes', sortOrder: 8 }),
      field({ form: 'onboarding', key: 'enderecoEntrega', label: 'Endereço de entrega', section: 'Colaborador', fieldType: 'textarea', required: false, visible: true, sortOrder: 9 }),
      field({ form: 'onboarding', key: 'perfilHardware', label: 'Perfil de hardware', section: 'Equipamento', fieldType: 'select', required: true, visible: true, catalogSource: 'hardwareProfiles', sortOrder: 10 }),
      field({ form: 'onboarding', key: 'perifericos', label: 'Periféricos', section: 'Equipamento', fieldType: 'boolean_group', required: false, visible: true, catalogSource: 'peripherals', sortOrder: 11 }),
      field({ form: 'onboarding', key: 'sistemas', label: 'Sistemas e acessos', section: 'Acessos', fieldType: 'boolean_group', required: false, visible: true, catalogSource: 'specificSystems', sortOrder: 12 }),
      field({ form: 'onboarding', key: 'unidade', label: 'Unidade', section: 'Acesso físico', fieldType: 'select', required: true, visible: true, catalogSource: 'units', sortOrder: 13 }),
      field({ form: 'onboarding', key: 'necessitaCracha', label: 'Necessita crachá', section: 'Acesso físico', fieldType: 'checkbox', required: false, visible: true, sortOrder: 14 }),
      field({ form: 'onboarding', key: 'lgpdAceito', label: 'Aceite LGPD', section: 'LGPD', fieldType: 'checkbox', required: true, visible: true, sortOrder: 15 }),

      field({ form: 'offboarding', key: 'nomeCompleto', label: 'Nome completo', section: 'Colaborador', fieldType: 'text', required: true, visible: true, sortOrder: 1 }),
      field({ form: 'offboarding', key: 'emailCorporativo', label: 'E-mail corporativo', section: 'Colaborador', fieldType: 'email', required: true, visible: true, sortOrder: 2 }),
      field({ form: 'offboarding', key: 'gestor', label: 'Gestor', section: 'Colaborador', fieldType: 'select', required: true, visible: true, catalogSource: 'managers', sortOrder: 3 }),
      field({ form: 'offboarding', key: 'dataHoraDesligamento', label: 'Data/hora desligamento', section: 'Colaborador', fieldType: 'datetime', required: true, visible: true, sortOrder: 4 }),
      field({ form: 'offboarding', key: 'redirecionamentoEmail', label: 'Redirecionar e-mail', section: 'Dados & LGPD', fieldType: 'checkbox', required: false, visible: true, sortOrder: 5 }),
      field({ form: 'offboarding', key: 'transferenciaArquivos', label: 'Transferir arquivos cloud', section: 'Dados & LGPD', fieldType: 'checkbox', required: false, visible: true, sortOrder: 6 }),
      field({ form: 'offboarding', key: 'ativos', label: 'Ativos a devolver', section: 'Devolução', fieldType: 'boolean_group', required: false, visible: true, catalogSource: 'assetTypes', sortOrder: 7 }),
      field({ form: 'offboarding', key: 'modalidadeDevolucao', label: 'Modalidade de devolução', section: 'Devolução', fieldType: 'select', required: true, visible: true, catalogSource: 'returnMethods', sortOrder: 8 }),
    ],
    sla: {
      onboardingMinBusinessDays: 5,
      offboardingZeroDay: true,
      defaultQueue: 'Service Desk N1',
    },
    updatedAt: now(),
  };
}
