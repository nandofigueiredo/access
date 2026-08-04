import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_SMTP, OutboundEmailLog, SmtpConfig } from '../types/workflow';
import {
  loadEmailLog,
  loadSmtpConfig,
  queueWorkflowEmail,
  saveSmtpConfig,
} from '../services/workflowEngine';
import { api, USE_API } from '../api/client';
import { useAuth } from '../auth/AuthContext';

interface WorkflowMailContextValue {
  smtp: SmtpConfig;
  emailLog: OutboundEmailLog[];
  saveSmtp: (cfg: SmtpConfig) => Promise<void>;
  sendMail: (params: {
    to: string[];
    subject: string;
    body: string;
    template: string;
    ticketId?: string;
  }) => OutboundEmailLog;
  refreshLog: () => void;
}

const Ctx = createContext<WorkflowMailContextValue | undefined>(undefined);

function isSmtp(value: unknown): value is Partial<SmtpConfig> {
  return Boolean(value && typeof value === 'object' && 'host' in (value as object));
}

function normalizeSmtp(raw: Partial<SmtpConfig>): SmtpConfig {
  const merged = { ...DEFAULT_SMTP, ...raw };
  return {
    ...merged,
    enabled: Boolean(merged.enabled),
    secure: Boolean(merged.secure),
    glpiEnabled: merged.glpiEnabled !== false,
    notifyRequesterOnCreate: merged.notifyRequesterOnCreate !== false,
    notifyRequesterOnClose: merged.notifyRequesterOnClose !== false,
    notifyEndUserOnComplete: merged.notifyEndUserOnComplete !== false,
    // false precisa sobreviver: Boolean(false) === false
    testMode: Boolean(merged.testMode),
  };
}

export const WorkflowMailProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [smtp, setSmtp] = useState<SmtpConfig>(() => normalizeSmtp(loadSmtpConfig()));
  const [emailLog, setEmailLog] = useState<OutboundEmailLog[]>(() => loadEmailLog());
  const savingRef = useRef(false);
  const loadedOnce = useRef(false);

  const pushRemote = useCallback(
    async (cfg: SmtpConfig) => {
      if (!USE_API || !user?.isAuthenticated || user.role !== 'admin') return;
      savingRef.current = true;
      try {
        await api.putSetting('smtp', cfg as unknown as Record<string, unknown>);
      } catch (err) {
        console.warn('Falha ao gravar SMTP no banco:', err);
        throw err;
      } finally {
        // Pequeno atraso para ignorar GET stale logo após o PUT
        window.setTimeout(() => {
          savingRef.current = false;
        }, 800);
      }
    },
    [user?.isAuthenticated, user?.role]
  );

  const pullRemote = useCallback(async () => {
    if (!USE_API || !user?.isAuthenticated) return;
    if (savingRef.current) return;
    try {
      const remote = await api.getSetting('smtp');
      if (isSmtp(remote.value) && Object.keys(remote.value).length > 0) {
        // Banco é a fonte da verdade — não misturar localStorage por cima do remote
        const merged = normalizeSmtp(remote.value);
        setSmtp(merged);
        saveSmtpConfig(merged);
      } else if (!loadedOnce.current && user.role === 'admin') {
        const local = normalizeSmtp(loadSmtpConfig());
        await api.putSetting('smtp', local as unknown as Record<string, unknown>);
        setSmtp(local);
      }
      loadedOnce.current = true;
    } catch (err) {
      console.warn('Falha ao carregar SMTP do banco:', err);
    }
  }, [user?.isAuthenticated, user?.role]);

  // Só carrega uma vez no login — poll a cada 20s sobrescrevia o formulário (ex.: testMode)
  useEffect(() => {
    if (!user?.isAuthenticated) return;
    loadedOnce.current = false;
    void pullRemote();
  }, [user?.isAuthenticated, pullRemote]);

  const saveSmtp = useCallback(
    async (cfg: SmtpConfig) => {
      const normalized = normalizeSmtp(cfg);
      saveSmtpConfig(normalized);
      setSmtp(normalized);
      await pushRemote(normalized);
    },
    [pushRemote]
  );

  const sendMail = useCallback(
    (params: { to: string[]; subject: string; body: string; template: string; ticketId?: string }) => {
      const entry = queueWorkflowEmail({ smtp, ...params });
      setEmailLog(loadEmailLog());
      return entry;
    },
    [smtp]
  );

  const refreshLog = useCallback(() => setEmailLog(loadEmailLog()), []);

  const value = useMemo(
    () => ({ smtp, emailLog, saveSmtp, sendMail, refreshLog }),
    [smtp, emailLog, saveSmtp, sendMail, refreshLog]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useWorkflowMail() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useWorkflowMail dentro de WorkflowMailProvider');
  return ctx;
}
