import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { Header } from './components/Header';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { LoginScreen } from './components/LoginScreen';
import { Dashboard } from './components/Dashboard';
import { OnboardingForm } from './components/OnboardingForm';
import { OffboardingForm } from './components/OffboardingForm';
import { TicketDetailModal } from './components/TicketDetailModal';
import { PrintTermModal } from './components/PrintTermModal';
import { MsalSettingsModal } from './components/MsalSettingsModal';
import { ToastContainer } from './components/Toast';
import { Ticket, TicketStatus, ToastMessage, OnboardingData, OffboardingData } from './types';
import { INITIAL_TICKETS } from './data/initialTickets';

const TICKETS_STORAGE_KEY = 'portal_ti_onboarding_offboarding_tickets';

const AppContent: React.FC = () => {
  const { user } = useAuth();

  // Active Navigation Tab
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  // Tickets State
  const [tickets, setTickets] = useState<Ticket[]>(() => {
    const saved = localStorage.getItem(TICKETS_STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return INITIAL_TICKETS;
  });

  // Modal States
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [printTicket, setPrintTicket] = useState<Ticket | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Toasts State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (toast: Omit<ToastMessage, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast = { ...toast, id };
    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      dismissToast(id);
    }, 5000);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Sync tickets to LocalStorage
  useEffect(() => {
    localStorage.setItem(TICKETS_STORAGE_KEY, JSON.stringify(tickets));
  }, [tickets]);

  // Handlers for Tickets
  const handleAddTicket = (newTicket: Ticket) => {
    setTickets((prev) => [newTicket, ...prev]);
    setActiveTab('dashboard');
  };

  const handleUpdateStatus = (ticketId: string, newStatus: TicketStatus) => {
    setTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, status: newStatus, updatedAt: new Date().toISOString() } : t))
    );

    addToast({
      type: 'info',
      title: 'Status Atualizado',
      message: `Solicitação ${ticketId} alterada para ${newStatus}.`,
    });
  };

  const handleUpdateTicket = (updatedTicket: Ticket) => {
    setTickets((prev) => prev.map((t) => (t.id === updatedTicket.id ? updatedTicket : t)));
    setSelectedTicket(updatedTicket);
  };

  const handleDeleteTicket = (ticketId: string) => {
    if (confirm(`Tem certeza que deseja excluir o ticket ${ticketId}?`)) {
      setTickets((prev) => prev.filter((t) => t.id !== ticketId));
      addToast({
        type: 'warning',
        title: 'Ticket Excluído',
        message: `Solicitação ${ticketId} foi removida.`,
      });
    }
  };

  // If user is not authenticated, show LoginScreen
  if (!user || !user.isAuthenticated) {
    return (
      <>
        <LoginScreen onOpenSettings={() => setIsSettingsOpen(true)} />

        {isSettingsOpen && (
          <MsalSettingsModal
            onClose={() => setIsSettingsOpen(false)}
            addToast={addToast}
          />
        )}

        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Header */}
      <Header onOpenSettings={() => setIsSettingsOpen(true)} />

      {/* Main Layout */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl w-full mx-auto">
        {/* Navigation Sidebar */}
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} tickets={tickets} />

        {/* Dynamic Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {activeTab === 'dashboard' && (
            <Dashboard
              tickets={tickets}
              onSelectTicket={(ticket) => setSelectedTicket(ticket)}
              onUpdateStatus={handleUpdateStatus}
              onDeleteTicket={handleDeleteTicket}
              onNavigateNewOnboarding={() => setActiveTab('onboarding')}
              onNavigateNewOffboarding={() => setActiveTab('offboarding')}
              addToast={addToast}
              onPrintTerm={(ticket) => setPrintTicket(ticket)}
            />
          )}

          {activeTab === 'onboarding' && (
            <OnboardingForm
              onSubmitTicket={handleAddTicket}
              addToast={addToast}
              onCancel={() => setActiveTab('dashboard')}
            />
          )}

          {activeTab === 'offboarding' && (
            <OffboardingForm
              onSubmitTicket={handleAddTicket}
              addToast={addToast}
              onCancel={() => setActiveTab('dashboard')}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onUpdateTicket={handleUpdateTicket}
          addToast={addToast}
          onPrintTerm={(ticket) => setPrintTicket(ticket)}
        />
      )}

      {printTicket && (
        <PrintTermModal ticket={printTicket} onClose={() => setPrintTicket(null)} />
      )}

      {isSettingsOpen && (
        <MsalSettingsModal onClose={() => setIsSettingsOpen(false)} addToast={addToast} />
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
