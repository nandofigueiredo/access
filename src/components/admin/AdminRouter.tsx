import React from 'react';
import { AppPage } from '../../types/catalog';
import { useCatalog } from '../../store/CatalogContext';
import { CatalogCrudPage } from './CatalogCrudPage';
import { FormFieldsConfigPage } from './FormFieldsConfigPage';
import {
  AuditPage,
  EntraConfigPage,
  ExportPage,
  GeneralConfigPage,
  ReportsPage,
  SlaConfigPage,
  TemplatesPage,
} from './SystemPages';
import { SmtpConfigPage } from './SmtpConfigPage';
import { WorkflowBoardPage } from './WorkflowBoardPage';
import { WorkflowConfigPage } from './WorkflowConfigPage';
import { ToastMessage, Ticket } from '../../types';

interface Props {
  page: AppPage;
  addToast: (t: Omit<ToastMessage, 'id'>) => void;
  tickets: Ticket[];
  onOpenEntra: () => void;
  onSelectTicket?: (t: Ticket) => void;
}

export const AdminRouter: React.FC<Props> = ({ page, addToast, tickets, onOpenEntra, onSelectTicket }) => {
  const { catalog, upsertItem, removeItem } = useCatalog();

  const crud = (
    key: Parameters<typeof upsertItem>[0],
    title: string,
    subtitle: string
  ) => (
    <CatalogCrudPage
      title={title}
      subtitle={subtitle}
      items={catalog[key]}
      onSave={(item) => upsertItem(key, item)}
      onDelete={(id) => removeItem(key, id)}
      addToast={addToast}
    />
  );

  switch (page) {
    case 'tools-reports':
      return <ReportsPage addToast={addToast} tickets={tickets} />;
    case 'tools-export':
      return <ExportPage addToast={addToast} tickets={tickets} />;
    case 'tools-notifications':
      return <TemplatesPage kind="email" addToast={addToast} />;
    case 'tools-terms':
      return <TemplatesPage kind="term" addToast={addToast} />;
    case 'tools-workflow':
      return (
        <WorkflowBoardPage
          tickets={tickets}
          addToast={addToast}
          onSelectTicket={onSelectTicket || (() => undefined)}
        />
      );

    case 'admin-users':
      return crud('users', 'Usuários & Perfis', 'Cadastro local de operadores (admin, RH, TI, gestor).');
    case 'admin-units':
      return crud('units', 'Unidades / Entidades', 'Locais físicos e entidades do Grupo diRoma.');
    case 'admin-managers':
      return crud('managers', 'Gestores', 'Gestores disponíveis para seleção nos formulários.');
    case 'admin-queues':
      return crud('serviceQueues', 'Filas Service Desk', 'Filas de atendimento para roteamento dos pedidos.');
    case 'admin-audit':
      return <AuditPage addToast={addToast} tickets={tickets} />;
    case 'admin-domains':
      return crud('allowedDomains', 'Domínios Permitidos', 'Somente e-mails destes domínios acessam o portal.');

    case 'config-fields':
      return <FormFieldsConfigPage addToast={addToast} />;
    case 'config-departments':
      return crud('departments', 'Departamentos', 'Áreas exibidas no onboarding.');
    case 'config-positions':
      return crud('positions', 'Cargos', 'Cargos/funções disponíveis no formulário.');
    case 'config-workmodes':
      return crud('workModes', 'Modalidades de Trabalho', 'Presencial, híbrido, remoto, etc.');
    case 'config-hardware':
      return crud('hardwareProfiles', 'Perfis de Hardware', 'Pacotes de notebook/configuração.');
    case 'config-peripherals':
      return crud('peripherals', 'Periféricos', 'Itens opcionais de equipamento e telefonia.');
    case 'config-systems':
      return crud('specificSystems', 'Sistemas & Acessos', 'Sistemas liberados no onboarding.');
    case 'config-checklist-onb':
      return crud('onboardingChecklist', 'Checklist TI — Onboarding', 'Itens do Service Desk no onboarding.');
    case 'config-checklist-off':
      return crud('offboardingChecklist', 'Checklist TI — Offboarding', 'Itens do Service Desk no offboarding.');
    case 'config-statuses':
      return crud('ticketStatuses', 'Status & Workflow', 'Status possíveis dos pedidos.');
    case 'config-assets':
      return crud('assetTypes', 'Tipos de Ativos', 'Ativos cobrados na devolução (offboarding).');
    case 'config-return':
      return crud('returnMethods', 'Modalidades de Devolução', 'Presencial, Correios, etc.');
    case 'config-sla':
      return <SlaConfigPage addToast={addToast} />;
    case 'config-smtp':
      return <SmtpConfigPage addToast={addToast} />;
    case 'config-workflow':
      return <WorkflowConfigPage addToast={addToast} />;
    case 'config-entra':
      return <EntraConfigPage addToast={addToast} onOpenEntra={onOpenEntra} />;
    case 'config-general':
      return <GeneralConfigPage addToast={addToast} />;
    default:
      return null;
  }
};
