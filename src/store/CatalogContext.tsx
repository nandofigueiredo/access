import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CatalogItem, CatalogKey, FormFieldConfig, SlaSettings, SystemCatalog } from '../types/catalog';
import { createDefaultCatalog } from '../data/defaultCatalog';
import { api, USE_API } from '../api/client';
import { useAuth } from '../auth/AuthContext';

const STORAGE_KEY = 'portal_ti_system_catalog_v1';
const POLL_MS = 15000;
export const CATALOG_UPDATED_EVENT = 'portal-catalog-updated';

function catalogTimestamp(c: SystemCatalog | null | undefined): number {
  const raw = c?.updatedAt;
  if (!raw) return 0;
  const n = Date.parse(raw);
  return Number.isFinite(n) ? n : 0;
}

function notifyCatalogUpdated() {
  try {
    window.dispatchEvent(new Event(CATALOG_UPDATED_EVENT));
  } catch {
    // ignore
  }
}

function loadLocalCatalog(): SystemCatalog {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SystemCatalog;
      if (parsed?.departments && parsed?.formFields) {
        const normalized = normalizeCatalog(parsed);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        return normalized;
      }
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

/** Garante arrays em todas as chaves de lista (evita "X is not iterable"). */
function normalizeCatalog(value: SystemCatalog): SystemCatalog {
  const base = createDefaultCatalog();
  const keys = Object.keys(base) as (keyof SystemCatalog)[];
  const out = { ...base, ...value };
  for (const key of keys) {
    if (key === 'sla' || key === 'updatedAt') continue;
    const v = out[key];
    if (!Array.isArray(v)) {
      (out as Record<string, unknown>)[key] = Array.isArray(base[key]) ? base[key] : [];
    }
  }
  if (!out.sla || typeof out.sla !== 'object') out.sla = base.sla;

  // Corrige cadastros legados: e-mail no campo Nome e meta.email vazio
  out.users = (out.users || []).map((u) => {
    const metaEmail = typeof u.meta?.email === 'string' ? u.meta.email.trim().toLowerCase() : '';
    const nameLooksEmail = u.name.includes('@');
    if (!metaEmail && nameLooksEmail) {
      const email = u.name.trim().toLowerCase();
      const displayName = email.split('@')[0].replace(/[._]/g, ' ');
      return {
        ...u,
        name: displayName.replace(/\b\w/g, (c) => c.toUpperCase()),
        meta: {
          ...(u.meta || {}),
          email,
          role: (typeof u.meta?.role === 'string' ? u.meta.role : 'viewer') as string,
        },
      };
    }
    if (metaEmail && !u.meta?.role) {
      return { ...u, meta: { ...(u.meta || {}), role: 'viewer' } };
    }
    return u;
  });

  // Garante admin Luis no catálogo
  const luisEmail = 'luis.figueiredo@diroma.com.br';
  const hasLuis = out.users.some(
    (u) => String(u.meta?.email || '').toLowerCase() === luisEmail || u.name.toLowerCase().includes('luis.figueiredo')
  );
  if (!hasLuis) {
    out.users.unshift({
      id: 'user-luis-admin',
      name: 'Luis Figueiredo',
      description: 'Admin N3',
      active: true,
      sortOrder: 0,
      meta: { email: luisEmail, role: 'admin' },
    });
  } else {
    out.users = out.users.map((u) => {
      const mail = String(u.meta?.email || '').toLowerCase();
      if (mail === luisEmail) {
        return {
          ...u,
          name: u.name.includes('@') ? 'Luis Figueiredo' : u.name,
          meta: { ...(u.meta || {}), email: luisEmail, role: 'admin' },
          active: true,
        };
      }
      return u;
    });
  }

  return out;
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
      notifyCatalogUpdated();
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
        const normalized = normalizeCatalog(remote.value as SystemCatalog);
        setCatalog((local) => {
          const localTs = catalogTimestamp(local);
          const remoteTs = catalogTimestamp(normalized);
          // Não sobrescrever cadastro local mais novo (evita sumir usuário acabado de salvar)
          if (localTs > remoteTs) {
            void pushRemote(local);
            return local;
          }
          localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
          notifyCatalogUpdated();
          return normalized;
        });
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
  }, [user?.isAuthenticated, pushRemote]);

  useEffect(() => {
    if (!user?.isAuthenticated) return;
    void pullRemote();
    const timer = window.setInterval(() => void pullRemote(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [user?.isAuthenticated, pullRemote]);

  const activeOptions = useCallback(
    (key: Exclude<CatalogKey, 'formFields'>) => {
      const list = Array.isArray(catalog[key]) ? catalog[key] : [];
      return [...list].filter((i) => i.active).sort((a, b) => a.sortOrder - b.sortOrder);
    },
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
