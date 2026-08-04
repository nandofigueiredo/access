import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { CatalogProvider } from './store/CatalogContext';
import { WorkflowMailProvider, useWorkflowMail } from './store/WorkflowMailContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { LoginScreen } from './components/LoginScreen';
import { Dashboard } from './components/Dashboard';
import { OnboardingForm } from './components/OnboardingForm';
import { OffboardingForm } from './components/OffboardingForm';
import { TicketDetailModal } from './components/TicketDetailModal';
import { PrintTermModal } from './components/PrintTermModal';
import { MsalSettingsModal } from './components/MsalSettingsModal';
import { ToastContainer } from './components/Toast';
import { AdminRouter } from './components/admin/AdminRouter';
import { Ticket, TicketStatus, ToastMessage, OnboardingData, OffboardingData } from './types';
import { AppPage } from './types/catalog';
import { api, USE_API } from './api/client';
import { createInitialWorkflow } from './services/workflowEngine';
import { can, canAccessPage, defaultPageForRole } from './auth/roles';

const POLL_MS = 8000;

const AppContent: React.FC = () => {
  const { user, accessChecking } = useAuth();
  const { smtp, sendMail } = useWorkflowMail();

  const [activeTab, setActiveTab] = useState<AppPage>('dashboard');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [printTicket, setPrintTicket] = useState<Ticket | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const selectedIdRef = useRef<string | null>(null);
  const toastWarnedRef = useRef(false);

  useEffect(() => {
    selectedIdRef.current = selectedTicket?.id ?? null;
  }, [selectedTicket?.id]);

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const refreshTickets = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!USE_API || !user?.isAuthenticated) return;
      if (!opts?.silent) setLoadingTickets(true);
      try {
        const data = await api.listAllTickets();
        setTickets(data);
        setSyncError(null);
        toastWarnedRef.current = false;
        const openId = selectedIdRef.current;
        if (openId) {
          const fresh = data.find((t) => t.id === openId);
          if (fresh) setSelectedTicket(fresh);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Falha ao sincronizar com o backend.';
        setSyncError(message);
        if (!toastWarnedRef.current) {
          toastWarnedRef.current = true;
          addToast({
            type: 'warning',
            title: 'API indisponível',
            message: 'Não foi possível sincronizar com o banco. Tentando novamente…',
          });
        }
      } finally {
        if (!opts?.silent) setLoadingTickets(false);
      }
    },
    [user?.isAuthenticated, addToast]
  );

  useEffect(() => {
    if (!user?.isAuthenticated || !USE_API) return;
    void refreshTickets();
    const timer = window.setInterval(() => {
      void refreshTickets({ silent: true });
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [user?.isAuthenticated, refreshTickets]);

  const handleAddTicket = async (newTicket: Ticket) => {
    if (!USE_API) {
      addToast({
        type: 'error',
        title: 'API não configurada',
        message: 'Defina VITE_API_BASE_URL no .env para gravar no banco.',
      });
      throw new Error('API não configurada');
    }

    const actor = user?.email || newTicket.createdBy;
    const workflow = newTicket.workflow || createInitialWorkflow(actor);

    try {
      let created: Ticket;
      if (newTicket.type === 'onboarding') {
        const { id, type, status, createdAt, updatedAt, createdBy, itChecklist, itNotes, ...body } =
          newTicket as OnboardingData;
        void id;
        void type;
        void status;
        void createdAt;
        void updatedAt;
        void createdBy;
        void itChecklist;
        void itNotes;
        created = await api.createOnboarding({
          ...body,
          workflow,
          requesterEmail: user?.email || body.requesterEmail,
          assignedQueue: body.assignedQueue || 'Service Desk N1',
        });
      } else {
        const { id, type, status, createdAt, updatedAt, createdBy, itChecklist, itNotes, ...body } =
          newTicket as OffboardingData;
        void id;
        void type;
        void status;
        void createdAt;
        void updatedAt;
        void createdBy;
        void itChecklist;
        void itNotes;
        created = await api.createOffboarding({
          ...body,
          workflow,
          requesterEmail: user?.email || body.requesterEmail,
          assignedQueue: body.assignedQueue || 'Service Desk N1',
        });
      }

      setTickets((prev) => [created, ...prev.filter((t) => t.id !== created.id)]);
      sendMail({
        to: [smtp.serviceDeskInbox],
        subject: `[Nova] ${created.id} — ${created.type} · ${created.nomeCompleto}`,
        body: `Nova solicitação na fila do Service Desk.\nID: ${created.id}\nTipo: ${created.type}\nColaborador: ${created.nomeCompleto}\nSolicitante: ${actor}`,
        template: 'ticket_created_sd',
        ticketId: created.id,
      });
      if (smtp.notifyRequesterOnCreate && user?.email) {
        sendMail({
          to: [user.email],
          subject: `[Registrada] ${created.id}`,
          body: `Sua solicitação ${created.id} foi registrada e encaminhada ao Service Desk / GLPI.`,
          template: 'ticket_created_requester',
          ticketId: created.id,
        });
      }
      addToast({
        type: 'success',
        title: 'Salvo no banco',
        message:
          smtp.glpiEnabled !== false
            ? `${created.id} criado. Chamado GLPI aberto pela API (número gravado automaticamente).`
            : `${created.id} criado e sincronizado.`,
      });
      setActiveTab('tools-workflow');
      void refreshTickets({ silent: true });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Erro ao salvar',
        message: err instanceof Error ? err.message : 'Falha ao criar chamado na API.',
      });
      throw err;
    }
  };

  const handleUpdateStatus = async (ticketId: string, newStatus: TicketStatus) => {
    if (!USE_API) return;
    try {
      const result = await api.updateStatus(ticketId, newStatus);
      setTickets((prev) =>
        prev.map((t) =>
          t.id === ticketId ? { ...t, status: result.status, updatedAt: result.updatedAt } : t
        )
      );
      addToast({
        type: 'info',
        title: 'Status Atualizado',
        message: `Solicitação ${ticketId} alterada para ${newStatus}.`,
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Erro ao atualizar',
        message: err instanceof Error ? err.message : 'Falha ao atualizar status.',
      });
    }
  };

  const handleUpdateTicket = async (updatedTicket: Ticket) => {
    if (!USE_API) return;
    try {
      const result = await api.updateStatus(updatedTicket.id, updatedTicket.status, {
        itNotes: updatedTicket.itNotes,
        itChecklist: updatedTicket.itChecklist as Record<string, boolean> | undefined,
        workflow: updatedTicket.workflow as unknown as Record<string, unknown> | undefined,
        requesterEmail: updatedTicket.requesterEmail,
        assignedQueue: updatedTicket.assignedQueue,
        glpiTicketNumber: updatedTicket.glpiTicketNumber,
      });
      const merged = {
        ...updatedTicket,
        status: result.status,
        updatedAt: result.updatedAt,
        itNotes: result.itNotes ?? updatedTicket.itNotes,
        itChecklist: (result.itChecklist as typeof updatedTicket.itChecklist) ?? updatedTicket.itChecklist,
        workflow: (result.workflow as unknown as Ticket['workflow']) ?? updatedTicket.workflow,
        requesterEmail: result.requesterEmail ?? updatedTicket.requesterEmail,
        assignedQueue: result.assignedQueue ?? updatedTicket.assignedQueue,
        glpiTicketNumber: result.glpiTicketNumber ?? updatedTicket.glpiTicketNumber,
      } as Ticket;
      setTickets((prev) => prev.map((t) => (t.id === merged.id ? merged : t)));
      setSelectedTicket(merged);
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Erro ao atualizar',
        message: err instanceof Error ? err.message : 'Falha ao sincronizar ticket.',
      });
    }
  };

  const handleDeleteTicket = async (ticketId: string) => {
    if (!confirm(`Tem certeza que deseja excluir o ticket ${ticketId}?`)) return;
    if (!USE_API) return;

    try {
      if (ticketId.startsWith('ONB')) {
        await api.deleteOnboarding(ticketId);
      } else {
        await api.deleteOffboarding(ticketId);
      }
      setTickets((prev) => prev.filter((t) => t.id !== ticketId));
      if (selectedIdRef.current === ticketId) setSelectedTicket(null);
      addToast({
        type: 'warning',
        title: 'Ticket Excluído',
        message: `Solicitação ${ticketId} foi removida do banco.`,
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Erro ao excluir',
        message: err instanceof Error ? err.message : 'Falha ao excluir chamado.',
      });
    }
  };

  useEffect(() => {
    if (!user?.isAuthenticated) return;
    if (!canAccessPage(user.role, activeTab)) {
      setActiveTab(defaultPageForRole(user.role));
    }
  }, [user?.isAuthenticated, user?.role, activeTab]);

  if (accessChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5] text-slate-600 text-sm">
        Validando cadastro em Usuários &amp; Perfis…
      </div>
    );
  }

  if (!user || !user.isAuthenticated) {
    return (
      <>
        <LoginScreen onOpenSettings={() => setIsSettingsOpen(true)} />
        {isSettingsOpen && (
          <MsalSettingsModal onClose={() => setIsSettingsOpen(false)} addToast={addToast} />
        )}
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  const handleAddClick = () => {
    if (activeTab === 'offboarding' && can(user?.role, 'tickets.create.offboarding')) {
      setActiveTab('offboarding');
      return;
    }
    if (can(user?.role, 'tickets.create.onboarding')) {
      setActiveTab('onboarding');
      return;
    }
    if (can(user?.role, 'tickets.create.offboarding')) {
      setActiveTab('offboarding');
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f2f5] text-slate-900 flex flex-col lg:flex-row">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        tickets={tickets}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
      />

      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <Header
          onOpenSettings={() => setIsSettingsOpen(true)}
          activeTab={activeTab}
          onAddClick={handleAddClick}
        />

        <main className="flex-1 p-3 sm:p-4">
          {(loadingTickets || syncError) && (
            <div
              className={`mb-3 text-[12px] ${syncError ? 'text-amber-700' : 'text-slate-500'} flex items-center gap-2`}
            >
              <span>
                {syncError
                  ? `Sync com banco falhou: ${syncError}`
                  : 'Sincronizando chamados com o banco…'}
              </span>
              {syncError && (
                <button
                  type="button"
                  className="underline text-[#1890ff]"
                  onClick={() => void refreshTickets()}
                >
                  Tentar de novo
                </button>
              )}
            </div>
          )}

          {activeTab === 'dashboard' && (
            <Dashboard
              tickets={tickets}
              onSelectTicket={(ticket) => setSelectedTicket(ticket)}
              onUpdateStatus={handleUpdateStatus}
              onDeleteTicket={handleDeleteTicket}
              onNavigateNewOnboarding={() => {
                if (can(user?.role, 'tickets.create.onboarding')) setActiveTab('onboarding');
              }}
              onNavigateNewOffboarding={() => {
                if (can(user?.role, 'tickets.create.offboarding')) setActiveTab('offboarding');
              }}
              addToast={addToast}
              onPrintTerm={(ticket) => setPrintTicket(ticket)}
            />
          )}

          {activeTab === 'onboarding' && canAccessPage(user.role, 'onboarding') && (
            <div className="bg-white border border-[#f0f0f0] p-4 sm:p-6">
              <OnboardingForm
                onSubmitTicket={handleAddTicket}
                addToast={addToast}
                onCancel={() => setActiveTab('dashboard')}
              />
            </div>
          )}

          {activeTab === 'offboarding' && canAccessPage(user.role, 'offboarding') && (
            <div className="bg-white border border-[#f0f0f0] p-4 sm:p-6">
              <OffboardingForm
                onSubmitTicket={handleAddTicket}
                addToast={addToast}
                onCancel={() => setActiveTab('dashboard')}
              />
            </div>
          )}

          {activeTab !== 'dashboard' &&
            activeTab !== 'onboarding' &&
            activeTab !== 'offboarding' &&
            canAccessPage(user.role, activeTab) && (
              <AdminRouter
                page={activeTab}
                addToast={addToast}
                tickets={tickets}
                onOpenEntra={() => setIsSettingsOpen(true)}
                onSelectTicket={(ticket) => setSelectedTicket(ticket)}
              />
            )}
        </main>
      </div>

      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onUpdateTicket={handleUpdateTicket}
          addToast={addToast}
          onPrintTerm={(ticket) => setPrintTicket(ticket)}
        />
      )}

      {printTicket && <PrintTermModal ticket={printTicket} onClose={() => setPrintTicket(null)} />}

      {isSettingsOpen && (
        <MsalSettingsModal onClose={() => setIsSettingsOpen(false)} addToast={addToast} />
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <CatalogProvider>
        <WorkflowMailProvider>
          <AppContent />
        </WorkflowMailProvider>
      </CatalogProvider>
    </AuthProvider>
  );
}
