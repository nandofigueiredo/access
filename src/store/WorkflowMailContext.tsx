import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { OutboundEmailLog, SmtpConfig } from '../types/workflow';
import {
  loadEmailLog,
  loadSmtpConfig,
  queueWorkflowEmail,
  saveSmtpConfig,
} from '../services/workflowEngine';
import { api, USE_API } from '../api/client';
import { useAuth } from '../auth/AuthContext';

const POLL_MS = 20000;

interface WorkflowMailContextValue {
  smtp: SmtpConfig;
  emailLog: OutboundEmailLog[];
  saveSmtp: (cfg: SmtpConfig) => void;
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

function isSmtp(value: unknown): value is SmtpConfig {
  return Boolean(value && typeof value === 'object' && 'host' in (value as object));
}

export const WorkflowMailProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [smtp, setSmtp] = useState<SmtpConfig>(() => loadSmtpConfig());
  const [emailLog, setEmailLog] = useState<OutboundEmailLog[]>(() => loadEmailLog());
  const saveTimer = useRef<number | null>(null);

  const pushRemote = useCallback(
    async (cfg: SmtpConfig) => {
      if (!USE_API || !user?.isAuthenticated) return;
      try {
        await api.putSetting('smtp', cfg as unknown as Record<string, unknown>);
      } catch (err) {
        console.warn('Falha ao gravar SMTP no banco:', err);
      }
    },
    [user?.isAuthenticated]
  );

  const pullRemote = useCallback(async () => {
    if (!USE_API || !user?.isAuthenticated) return;
    try {
      const remote = await api.getSetting('smtp');
      if (isSmtp(remote.value) && Object.keys(remote.value).length > 0) {
        const merged = { ...loadSmtpConfig(), ...remote.value };
        setSmtp(merged);
        saveSmtpConfig(merged);
      } else {
        const local = loadSmtpConfig();
        await api.putSetting('smtp', local as unknown as Record<string, unknown>);
      }
    } catch (err) {
      console.warn('Falha ao carregar SMTP do banco:', err);
    }
  }, [user?.isAuthenticated]);

  useEffect(() => {
    if (!user?.isAuthenticated) return;
    void pullRemote();
    const timer = window.setInterval(() => void pullRemote(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [user?.isAuthenticated, pullRemote]);

  const saveSmtp = useCallback(
    (cfg: SmtpConfig) => {
      saveSmtpConfig(cfg);
      setSmtp(cfg);
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        void pushRemote(cfg);
      }, 400);
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
