/** Catálogos e configurações do Portal TI (admin). */

export type CatalogKey =
  | 'departments'
  | 'positions'
  | 'workModes'
  | 'hardwareProfiles'
  | 'peripherals'
  | 'basePlatforms'
  | 'specificSystems'
  | 'units'
  | 'managers'
  | 'ticketStatuses'
  | 'returnMethods'
  | 'assetTypes'
  | 'onboardingChecklist'
  | 'offboardingChecklist'
  | 'users'
  | 'serviceQueues'
  | 'emailTemplates'
  | 'termTemplates'
  | 'allowedDomains'
  | 'formFields';

export interface CatalogItem {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  sortOrder: number;
  meta?: Record<string, string | number | boolean | null>;
}

export interface FormFieldConfig {
  id: string;
  form: 'onboarding' | 'offboarding' | 'both';
  key: string;
  label: string;
  section: string;
  fieldType: 'text' | 'email' | 'date' | 'datetime' | 'select' | 'multiselect' | 'checkbox' | 'textarea' | 'boolean_group';
  required: boolean;
  visible: boolean;
  catalogSource?: CatalogKey;
  placeholder?: string;
  helpText?: string;
  sortOrder: number;
  active: boolean;
}

export interface SlaSettings {
  onboardingMinBusinessDays: number;
  offboardingZeroDay: boolean;
  defaultQueue: string;
}

export interface SystemCatalog {
  departments: CatalogItem[];
  positions: CatalogItem[];
  workModes: CatalogItem[];
  hardwareProfiles: CatalogItem[];
  peripherals: CatalogItem[];
  basePlatforms: CatalogItem[];
  specificSystems: CatalogItem[];
  units: CatalogItem[];
  managers: CatalogItem[];
  ticketStatuses: CatalogItem[];
  returnMethods: CatalogItem[];
  assetTypes: CatalogItem[];
  onboardingChecklist: CatalogItem[];
  offboardingChecklist: CatalogItem[];
  users: CatalogItem[];
  serviceQueues: CatalogItem[];
  emailTemplates: CatalogItem[];
  termTemplates: CatalogItem[];
  allowedDomains: CatalogItem[];
  formFields: FormFieldConfig[];
  sla: SlaSettings;
  updatedAt: string;
}

export type AppPage =
  | 'dashboard'
  | 'onboarding'
  | 'offboarding'
  // Ferramentas
  | 'tools-reports'
  | 'tools-export'
  | 'tools-notifications'
  | 'tools-terms'
  // Administração
  | 'admin-users'
  | 'admin-units'
  | 'admin-managers'
  | 'admin-queues'
  | 'admin-audit'
  | 'admin-domains'
  // Configuração
  | 'config-fields'
  | 'config-departments'
  | 'config-positions'
  | 'config-workmodes'
  | 'config-hardware'
  | 'config-peripherals'
  | 'config-systems'
  | 'config-checklist-onb'
  | 'config-checklist-off'
  | 'config-statuses'
  | 'config-assets'
  | 'config-return'
  | 'config-sla'
  | 'config-smtp'
  | 'config-workflow'
  | 'config-entra'
  | 'config-general'
  | 'tools-workflow';
