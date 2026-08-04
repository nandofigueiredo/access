import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CatalogItem, CatalogKey, FormFieldConfig, SlaSettings, SystemCatalog } from '../types/catalog';
import { createDefaultCatalog } from '../data/defaultCatalog';
import { api, USE_API } from '../api/client';
import { useAuth } from '../auth/AuthContext';

const STORAGE_KEY = 'portal_ti_system_catalog_v1';
/** Poll só para detectar mudanças de outro admin — não sobrescreve se o local for mais novo. */
const POLL_MS = 60000;
export const CATALOG_UPDATED_EVENT = 'portal-catalog-updated';

const LIST_KEYS: Exclude<CatalogKey, never>[] = [
  'departments',
  'positions',
  'workModes',
  'hardwareProfiles',
  'peripherals',
  'basePlatforms',
  'specificSystems',
  'units',
  'managers',
  'ticketStatuses',
  'returnMethods',
  'assetTypes',
  'onboardingChecklist',
  'offboardingChecklist',
  'users',
  'serviceQueues',
  'emailTemplates',
  'termTemplates',
  'allowedDomains',
  'formFields',
];

type CatalogWithDeletes = SystemCatalog & {
  userDeleteIds?: string[];
  itemDeleteIds?: Partial<Record<CatalogKey, string[]>>;
};

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

function mergeCatalogUsers(local: CatalogItem[], remote: CatalogItem[]): CatalogItem[] {
  const map = new Map<string, CatalogItem>();
  for (const u of remote) map.set(userIdentityKey(u), u);
  for (const u of local) {
    const key = userIdentityKey(u);
    const existing = map.get(key);
    map.set(key, existing ? richerUser(existing, u) : u);
  }
  return Array.from(map.values());
}

/** União por id — incoming vence no conflito; deleteIds removem. */
function mergeItemsById<T extends { id: string }>(
  remote: T[],
  incoming: T[],
  deleteIds?: Set<string>
): T[] {
  const map = new Map<string, T>();
  for (const item of remote) {
    if (!item?.id) continue;
    if (deleteIds?.has(item.id)) continue;
    map.set(item.id, item);
  }
  for (const item of incoming) {
    if (!item?.id) continue;
    if (deleteIds?.has(item.id)) {
      map.delete(item.id);
      continue;
    }
    const existing = map.get(item.id);
    map.set(item.id, existing ? { ...existing, ...item } : item);
  }
  if (deleteIds) {
    for (const id of deleteIds) map.delete(id);
  }
  return Array.from(map.values());
}

/** Une catálogos: listas por id; users por e-mail; sla do mais novo. */
function mergeCatalogs(
  remote: SystemCatalog,
  incoming: SystemCatalog,
  opts?: { userDeleteIds?: string[]; itemDeleteIds?: Partial<Record<CatalogKey, string[]>> }
): SystemCatalog {
  const out = normalizeCatalog({ ...remote, ...incoming });
  for (const key of LIST_KEYS) {
    if (key === 'users') {
      out.users = mergeCatalogUsers(incoming.users || [], remote.users || []);
      if (opts?.userDeleteIds?.length) {
        const del = new Set(opts.userDeleteIds);
        out.users = out.users.filter((u) => !del.has(u.id));
      }
      continue;
    }
    if (key === 'formFields') {
      const del = new Set(opts?.itemDeleteIds?.formFields || []);
      out.formFields = mergeItemsById(
        remote.formFields || [],
        incoming.formFields || [],
        del
      );
      continue;
    }
    const del = new Set(opts?.itemDeleteIds?.[key] || []);
    const remoteList = (Array.isArray(remote[key]) ? remote[key] : []) as CatalogItem[];
    const incomingList = (Array.isArray(incoming[key]) ? incoming[key] : []) as CatalogItem[];
    (out as unknown as Record<string, unknown>)[key] = mergeItemsById(remoteList, incomingList, del);
  }
  const preferIncomingSla = catalogTimestamp(incoming) >= catalogTimestamp(remote);
  out.sla = preferIncomingSla ? incoming.sla || remote.sla : remote.sla || incoming.sla;
  out.updatedAt = new Date().toISOString();
  return normalizeCatalog(out);
}

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
  upsertItem: (key: Exclude<CatalogKey, 'formFields'>, item: CatalogItem) => Promise<void>;
  removeItem: (key: Exclude<CatalogKey, 'formFields'>, id: string) => Promise<void>;
  upsertFormField: (field: FormFieldConfig) => Promise<void>;
  removeFormField: (id: string) => Promise<void>;
  updateSla: (sla: SlaSettings) => Promise<void>;
  resetDefaults: () => Promise<void>;
}

const CatalogContext = createContext<CatalogContextValue | undefined>(undefined);

export const CatalogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [catalog, setCatalog] = useState<SystemCatalog>(() => loadLocalCatalog());
  const [syncing, setSyncing] = useState(false);
  const catalogRef = useRef(catalog);
  const savingRef = useRef(false);
  const loadedOnce = useRef(false);

  useEffect(() => {
    catalogRef.current = catalog;
  }, [catalog]);

  const pushRemote = useCallback(async (next: CatalogWithDeletes) => {
    if (!USE_API || !user?.isAuthenticated) return !USE_API;
    savingRef.current = true;
    try {
      const userDeleteIds = next.userDeleteIds;
      const itemDeleteIds = next.itemDeleteIds;
      let toSave: CatalogWithDeletes = next;
      try {
        const remote = await api.getSetting('catalog');
        if (isValidCatalog(remote.value)) {
          toSave = mergeCatalogs(remote.value as SystemCatalog, next, {
            userDeleteIds,
            itemDeleteIds,
          });
        }
      } catch {
        // segue com next
      }
      if (userDeleteIds?.length) toSave = { ...toSave, userDeleteIds };
      if (itemDeleteIds) toSave = { ...toSave, itemDeleteIds };

      const saved = await api.putSetting('catalog', toSave as unknown as Record<string, unknown>);
      const stored = normalizeCatalog((saved.value || toSave) as SystemCatalog);
      setCatalog(stored);
      catalogRef.current = stored;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      notifyCatalogUpdated();
      return true;
    } catch (err) {
      console.warn('Falha ao gravar catálogo no banco:', err);
      return false;
    } finally {
      window.setTimeout(() => {
        savingRef.current = false;
      }, 1000);
    }
  }, [user?.isAuthenticated]);

  const commit = useCallback(
    async (build: (prev: SystemCatalog) => CatalogWithDeletes) => {
      const prev = catalogRef.current;
      const nextRaw = build(prev);
      const { userDeleteIds, itemDeleteIds, ...rest } = nextRaw;
      const withTs = normalizeCatalog({
        ...(rest as SystemCatalog),
        updatedAt: new Date().toISOString(),
      });
      const payload: CatalogWithDeletes = {
        ...withTs,
        ...(userDeleteIds?.length ? { userDeleteIds } : {}),
        ...(itemDeleteIds ? { itemDeleteIds } : {}),
      };
      setCatalog(withTs);
      catalogRef.current = withTs;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(withTs));
      notifyCatalogUpdated();

      const ok = await pushRemote(payload);
      if (!ok) {
        throw new Error('Não foi possível gravar no banco. Tente novamente.');
      }
    },
    [pushRemote]
  );

  const pullRemote = useCallback(async () => {
    if (!USE_API || !user?.isAuthenticated) return;
    if (savingRef.current) return;
    setSyncing(true);
    try {
      const remote = await api.getSetting('catalog');
      if (isValidCatalog(remote.value) && Object.keys(remote.value).length > 0) {
        const normalized = normalizeCatalog(remote.value as SystemCatalog);
        const local = catalogRef.current;

        // Local mais novo = save recente; não sobrescrever gestores/unidades/etc.
        if (loadedOnce.current && catalogTimestamp(local) > catalogTimestamp(normalized)) {
          return;
        }

        const merged = mergeCatalogs(normalized, local);
        // Se remote é mais novo, preferir listas do remote (já mergeadas com local extras)
        const preferRemote = catalogTimestamp(normalized) >= catalogTimestamp(local);
        const applied = preferRemote
          ? mergeCatalogs(local, normalized)
          : merged;

        setCatalog(applied);
        catalogRef.current = applied;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(applied));
        notifyCatalogUpdated();
      } else if (!loadedOnce.current) {
        const local = loadLocalCatalog();
        await api.putSetting('catalog', local as unknown as Record<string, unknown>);
      }
      loadedOnce.current = true;
    } catch (err) {
      console.warn('Falha ao carregar catálogo do banco:', err);
    } finally {
      setSyncing(false);
    }
  }, [user?.isAuthenticated]);

  useEffect(() => {
    if (!user?.isAuthenticated) return;
    loadedOnce.current = false;
    void pullRemote();
    const timer = window.setInterval(() => void pullRemote(), POLL_MS);
    const onFocus = () => {
      if (!savingRef.current) void pullRemote();
    };
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
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
      await commit((prev) => {
        const list = [...(Array.isArray(prev[key]) ? prev[key] : [])];
        const idx = list.findIndex((i) => i.id === item.id);
        if (idx >= 0) list[idx] = item;
        else list.push(item);
        return { ...prev, [key]: list };
      });
    },
    [commit]
  );

  const removeItem = useCallback(
    async (key: Exclude<CatalogKey, 'formFields'>, id: string) => {
      await commit((prev) => {
        const base: CatalogWithDeletes = {
          ...prev,
          [key]: (Array.isArray(prev[key]) ? prev[key] : []).filter((i) => i.id !== id),
        };
        if (key === 'users') {
          base.userDeleteIds = [id];
        } else {
          base.itemDeleteIds = { [key]: [id] };
        }
        return base;
      });
    },
    [commit]
  );

  const upsertFormField = useCallback(
    async (field: FormFieldConfig) => {
      await commit((prev) => {
        const list = [...prev.formFields];
        const idx = list.findIndex((i) => i.id === field.id);
        if (idx >= 0) list[idx] = field;
        else list.push(field);
        return { ...prev, formFields: list };
      });
    },
    [commit]
  );

  const removeFormField = useCallback(
    async (id: string) => {
      await commit((prev) => ({
        ...prev,
        formFields: prev.formFields.filter((f) => f.id !== id),
        itemDeleteIds: { formFields: [id] },
      }));
    },
    [commit]
  );

  const updateSla = useCallback(
    async (sla: SlaSettings) => {
      await commit((prev) => ({ ...prev, sla }));
    },
    [commit]
  );

  const resetDefaults = useCallback(async () => {
    await commit(() => createDefaultCatalog());
  }, [commit]);

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
