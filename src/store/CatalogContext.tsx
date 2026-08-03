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

function userIdentityKey(u: CatalogItem): string {
  const mail = typeof u.meta?.email === 'string' ? u.meta.email.trim().toLowerCase() : '';
  if (mail.includes('@')) return `mail:${mail}`;
  const name = (u.name || '').trim().toLowerCase();
  if (name.includes('@')) return `mail:${name}`;
  return `id:${u.id}`;
}

function richerUser(existing: CatalogItem, incoming: CatalogItem): CatalogItem {
  /** Incoming vence em role/e-mail; completa buracos com o existente. */
  const aMeta = (existing.meta || {}) as Record<string, string | boolean | number | null>;
  const bMeta = (incoming.meta || {}) as Record<string, string | boolean | number | null>;

  const mailOf = (meta: Record<string, string | boolean | number | null>, row: CatalogItem) => {
    const m = typeof meta.email === 'string' ? meta.email.trim().toLowerCase() : '';
    if (m.includes('@')) return m;
    const n = (row.name || '').trim().toLowerCase();
    return n.includes('@') ? n : '';
  };

  const email = mailOf(bMeta, incoming) || mailOf(aMeta, existing);
  const role =
    (typeof bMeta.role === 'string' && bMeta.role) ||
    (typeof aMeta.role === 'string' && aMeta.role) ||
    undefined;

  const nameIn = incoming.name || '';
  const nameEx = existing.name || '';
  const name =
    nameIn.includes('@') && nameEx && !nameEx.includes('@')
      ? nameEx
      : nameIn || nameEx;

  return {
    ...existing,
    ...incoming,
    id: incoming.id || existing.id,
    name,
    active: incoming.active !== false,
    description: incoming.description || existing.description,
    sortOrder: incoming.sortOrder ?? existing.sortOrder,
    meta: {
      ...aMeta,
      ...bMeta,
      ...(email ? { email } : {}),
      ...(role ? { role } : {}),
    },
  };
}

/** União de usuários por e-mail/id — nunca descarta cadastro de um dos lados. */
function mergeCatalogUsers(local: CatalogItem[], remote: CatalogItem[]): CatalogItem[] {
  const map = new Map<string, CatalogItem>();
  for (const u of remote) {
    map.set(userIdentityKey(u), u);
  }
  for (const u of local) {
    const key = userIdentityKey(u);
    const existing = map.get(key);
    map.set(key, existing ? richerUser(existing, u) : u);
  }
  return Array.from(map.values());
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
        description: u.description || 'Visualizador',
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
      if (mail === luisEmail || u.name.toLowerCase().includes('luis.figueiredo')) {
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
  upsertItem: (key: Exclude<CatalogKey, 'formFields'>, item: CatalogItem) => void | Promise<void>;
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
    if (!USE_API || !user?.isAuthenticated) return false;
    try {
      const deleteIds = (next as SystemCatalog & { userDeleteIds?: string[] }).userDeleteIds;
      // Antes de gravar, une com o que já está no banco para não apagar usuários
      let toSave: SystemCatalog & { userDeleteIds?: string[] } = next;
      try {
        const remote = await api.getSetting('catalog');
        if (isValidCatalog(remote.value) && Array.isArray((remote.value as SystemCatalog).users)) {
          const remoteCat = remote.value as SystemCatalog;
          const mergedUsers = mergeCatalogUsers(next.users || [], remoteCat.users || []);
          toSave = normalizeCatalog({
            ...remoteCat,
            ...next,
            users: mergedUsers,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch {
        // segue com next
      }
      if (deleteIds?.length) {
        toSave = { ...toSave, userDeleteIds: deleteIds };
      }
      const saved = await api.putSetting(
        'catalog',
        toSave as unknown as Record<string, unknown>
      );
      const stored = normalizeCatalog((saved.value || toSave) as SystemCatalog);
      setCatalog(stored);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      notifyCatalogUpdated();
      return true;
    } catch (err) {
      console.warn('Falha ao gravar catálogo no banco:', err);
      return false;
    }
  }, [user?.isAuthenticated]);

  const persist = useCallback(
    (next: SystemCatalog, opts?: { remote?: boolean; immediate?: boolean }) => {
      const withTs = normalizeCatalog({ ...next, updatedAt: new Date().toISOString() });
      setCatalog(withTs);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(withTs));
      notifyCatalogUpdated();
      if (opts?.remote === false) return;
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      if (opts?.immediate) {
        void pushRemote(withTs);
        return;
      }
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
          const mergedUsers = mergeCatalogUsers(local.users || [], normalized.users || []);
          const merged = normalizeCatalog({
            ...normalized,
            users: mergedUsers,
            updatedAt:
              catalogTimestamp(local) > catalogTimestamp(normalized)
                ? local.updatedAt || normalized.updatedAt
                : normalized.updatedAt || local.updatedAt,
          });

          const remoteCount = (normalized.users || []).length;
          const mergedCount = mergedUsers.length;
          const needsMetaRepair = mergedUsers.some((u) => {
            const mail = String(u.meta?.email || '');
            const role = String(u.meta?.role || '');
            return Boolean(mail.includes('@') && role);
          }) && (normalized.users || []).some((u) => {
            const mail = String(u.meta?.email || '');
            const nameIsMail = (u.name || '').includes('@');
            return nameIsMail && !mail.includes('@');
          });

          // Se o local tinha usuários extras OU remoto precisa reparo de meta, regrava
          if (mergedCount > remoteCount || needsMetaRepair) {
            const toPush = { ...merged, updatedAt: new Date().toISOString() };
            void pushRemote(toPush);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(toPush));
            notifyCatalogUpdated();
            return toPush;
          }

          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          notifyCatalogUpdated();
          return merged;
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
    async (key: Exclude<CatalogKey, 'formFields'>, item: CatalogItem) => {
      const list = [...catalog[key]];
      const idx = list.findIndex((i) => i.id === item.id);
      if (idx >= 0) list[idx] = item;
      else list.push(item);
      const next = { ...catalog, [key]: list };
      const withTs = normalizeCatalog({ ...next, updatedAt: new Date().toISOString() });
      setCatalog(withTs);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(withTs));
      notifyCatalogUpdated();
      if (key === 'users') {
        const ok = await pushRemote(withTs);
        if (!ok) {
          throw new Error('Não foi possível gravar no banco. Tente novamente.');
        }
        return;
      }
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        void pushRemote(withTs);
      }, 400);
    },
    [catalog, pushRemote]
  );

  const removeItem = useCallback(
    (key: Exclude<CatalogKey, 'formFields'>, id: string) => {
      const next = {
        ...catalog,
        [key]: catalog[key].filter((i) => i.id !== id),
        ...(key === 'users' ? { userDeleteIds: [id] } : {}),
      } as SystemCatalog & { userDeleteIds?: string[] };
      persist(next, { immediate: key === 'users' });
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
