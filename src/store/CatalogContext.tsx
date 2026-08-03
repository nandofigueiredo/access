import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CatalogItem, CatalogKey, FormFieldConfig, SlaSettings, SystemCatalog } from '../types/catalog';
import { createDefaultCatalog } from '../data/defaultCatalog';
import { api, USE_API } from '../api/client';
import { useAuth } from '../auth/AuthContext';

const STORAGE_KEY = 'portal_ti_system_catalog_v1';
const POLL_MS = 15000;

function loadLocalCatalog(): SystemCatalog {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SystemCatalog;
      if (parsed?.departments && parsed?.formFields) return parsed;
    }
  } catch {
    // ignore
  }
  const fresh = createDefaultCatalog();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  return fresh;
}

function isValidCatalog(value: unknown): value is SystemCatalog {
  if (!value || typeof value !== 'object') return false;
  const c = value as SystemCatalog;
  return Array.isArray(c.departments) && Array.isArray(c.formFields);
}

interface CatalogContextValue {
  catalog: SystemCatalog;
  syncing: boolean;
  activeOptions: (key: Exclude<CatalogKey, 'formFields'>) => CatalogItem[];
  visibleFields: (form: 'onboarding' | 'offboarding') => FormFieldConfig[];
  upsertItem: (key: Exclude<CatalogKey, 'formFields'>, item: CatalogItem) => void;
  removeItem: (key: Exclude<CatalogKey, 'formFields'>, id: string) => void;
  upsertFormField: (field: FormFieldConfig) => void;
  removeFormField: (id: string) => void;
  updateSla: (sla: SlaSettings) => void;
  resetDefaults: () => void;
}

const CatalogContext = createContext<CatalogContextValue | undefined>(undefined);

export const CatalogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [catalog, setCatalog] = useState<SystemCatalog>(() => loadLocalCatalog());
  const [syncing, setSyncing] = useState(false);
  const saveTimer = useRef<number | null>(null);

  const pushRemote = useCallback(async (next: SystemCatalog) => {
    if (!USE_API || !user?.isAuthenticated) return;
    try {
      await api.putSetting('catalog', next as unknown as Record<string, unknown>);
    } catch (err) {
      console.warn('Falha ao gravar catálogo no banco:', err);
    }
  }, [user?.isAuthenticated]);

  const persist = useCallback(
    (next: SystemCatalog, opts?: { remote?: boolean }) => {
      const withTs = { ...next, updatedAt: new Date().toISOString() };
      setCatalog(withTs);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(withTs));
      if (opts?.remote === false) return;
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        void pushRemote(withTs);
      }, 400);
    },
    [pushRemote]
  );

  const pullRemote = useCallback(async () => {
    if (!USE_API || !user?.isAuthenticated) return;
    setSyncing(true);
    try {
      const remote = await api.getSetting('catalog');
      if (isValidCatalog(remote.value) && Object.keys(remote.value).length > 0) {
        setCatalog(remote.value);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(remote.value));
      } else {
        // Seed banco com catálogo local na primeira vez
        const local = loadLocalCatalog();
        await api.putSetting('catalog', local as unknown as Record<string, unknown>);
      }
    } catch (err) {
      console.warn('Falha ao carregar catálogo do banco:', err);
    } finally {
      setSyncing(false);
    }
  }, [user?.isAuthenticated]);

  useEffect(() => {
    if (!user?.isAuthenticated) return;
    void pullRemote();
    const timer = window.setInterval(() => void pullRemote(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [user?.isAuthenticated, pullRemote]);

  const activeOptions = useCallback(
    (key: Exclude<CatalogKey, 'formFields'>) =>
      [...catalog[key]].filter((i) => i.active).sort((a, b) => a.sortOrder - b.sortOrder),
    [catalog]
  );

  const visibleFields = useCallback(
    (form: 'onboarding' | 'offboarding') =>
      catalog.formFields
        .filter((f) => f.active && f.visible && (f.form === form || f.form === 'both'))
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [catalog.formFields]
  );

  const upsertItem = useCallback(
    (key: Exclude<CatalogKey, 'formFields'>, item: CatalogItem) => {
      const list = [...catalog[key]];
      const idx = list.findIndex((i) => i.id === item.id);
      if (idx >= 0) list[idx] = item;
      else list.push(item);
      persist({ ...catalog, [key]: list });
    },
    [catalog, persist]
  );

  const removeItem = useCallback(
    (key: Exclude<CatalogKey, 'formFields'>, id: string) => {
      persist({ ...catalog, [key]: catalog[key].filter((i) => i.id !== id) });
    },
    [catalog, persist]
  );

  const upsertFormField = useCallback(
    (field: FormFieldConfig) => {
      const list = [...catalog.formFields];
      const idx = list.findIndex((i) => i.id === field.id);
      if (idx >= 0) list[idx] = field;
      else list.push(field);
      persist({ ...catalog, formFields: list });
    },
    [catalog, persist]
  );

  const removeFormField = useCallback(
    (id: string) => {
      persist({ ...catalog, formFields: catalog.formFields.filter((f) => f.id !== id) });
    },
    [catalog, persist]
  );

  const updateSla = useCallback(
    (sla: SlaSettings) => persist({ ...catalog, sla }),
    [catalog, persist]
  );

  const resetDefaults = useCallback(() => {
    const fresh = createDefaultCatalog();
    persist(fresh);
  }, [persist]);

  const value = useMemo(
    () => ({
      catalog,
      syncing,
      activeOptions,
      visibleFields,
      upsertItem,
      removeItem,
      upsertFormField,
      removeFormField,
      updateSla,
      resetDefaults,
    }),
    [
      catalog,
      syncing,
      activeOptions,
      visibleFields,
      upsertItem,
      removeItem,
      upsertFormField,
      removeFormField,
      updateSla,
      resetDefaults,
    ]
  );

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
};

export function useCatalog() {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog deve ser usado dentro de CatalogProvider');
  return ctx;
}
