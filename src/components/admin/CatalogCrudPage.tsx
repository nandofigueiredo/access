import React, { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Search, ToggleLeft, ToggleRight } from 'lucide-react';
import { CatalogItem } from '../../types/catalog';
import { ToastMessage } from '../../types';
import { ACCESS_PROFILES, AccessRole, getProfile, roleLabel } from '../../auth/roles';

interface CatalogCrudPageProps {
  title: string;
  subtitle: string;
  items: CatalogItem[];
  onSave: (item: CatalogItem) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  showDescription?: boolean;
  /** Cadastro de operadores com seleção de perfil de acesso */
  enableAccessRole?: boolean;
}

function newId() {
  return `cat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function roleFromMeta(item: CatalogItem): AccessRole {
  const raw = item.meta?.role;
  if (typeof raw === 'string' && ACCESS_PROFILES.some((p) => p.role === raw)) {
    return raw as AccessRole;
  }
  return 'viewer';
}

function emailFromMeta(item: CatalogItem): string {
  const raw = item.meta?.email;
  return typeof raw === 'string' ? raw : '';
}

export const CatalogCrudPage: React.FC<CatalogCrudPageProps> = ({
  title,
  subtitle,
  items,
  onSave,
  onDelete,
  addToast,
  showDescription = true,
  enableAccessRole = false,
}) => {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AccessRole>('ti');
  const [active, setActive] = useState(true);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return [...items]
      .filter((i) => {
        if (!q) return true;
        const mail = emailFromMeta(i).toLowerCase();
        const perfil = roleLabel(roleFromMeta(i)).toLowerCase();
        return (
          i.name.toLowerCase().includes(q) ||
          (i.description || '').toLowerCase().includes(q) ||
          mail.includes(q) ||
          perfil.includes(q)
        );
      })
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }, [items, search]);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setEmail('');
    setRole('ti');
    setActive(true);
  };

  const openEdit = (item: CatalogItem) => {
    setEditing(item);
    setName(item.name.includes('@') ? item.name.split('@')[0].replace(/[._]/g, ' ') : item.name);
    setDescription(item.description || '');
    const mail = emailFromMeta(item) || (item.name.includes('@') ? item.name.trim().toLowerCase() : '');
    setEmail(mail);
    setRole(roleFromMeta(item));
    setActive(item.active);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast({ type: 'error', title: 'Nome obrigatório', message: 'Informe o nome do item.' });
      return;
    }
    if (enableAccessRole) {
      let normalizedEmail = email.trim().toLowerCase();
      // Se colaram o e-mail no Nome, recupera
      if ((!normalizedEmail || !normalizedEmail.includes('@')) && name.trim().includes('@')) {
        normalizedEmail = name.trim().toLowerCase();
        setEmail(normalizedEmail);
      }
      if (!normalizedEmail || !normalizedEmail.includes('@')) {
        addToast({
          type: 'error',
          title: 'E-mail obrigatório',
          message: 'Informe o e-mail corporativo do operador (campo E-mail).',
        });
        return;
      }
      const displayName =
        name.trim().includes('@')
          ? name
              .trim()
              .split('@')[0]
              .replace(/[._]/g, ' ')
              .replace(/\b\w/g, (c) => c.toUpperCase())
          : name.trim();

      const duplicate = items.find(
        (i) =>
          i.id !== editing?.id &&
          emailFromMeta(i).toLowerCase() === normalizedEmail
      );
      if (duplicate) {
        addToast({
          type: 'error',
          title: 'E-mail já cadastrado',
          message: `"${normalizedEmail}" já está vinculado a ${duplicate.name}.`,
        });
        return;
      }

      const payload: CatalogItem = {
        id: editing?.id ?? newId(),
        name: displayName || normalizedEmail,
        description: roleLabel(role),
        active,
        sortOrder: editing?.sortOrder ?? items.length + 1,
        meta: {
          ...(editing?.meta || {}),
          email: normalizedEmail,
          role,
        },
      };
      try {
        await onSave(payload);
        addToast({
          type: 'success',
          title: editing ? 'Usuário atualizado' : 'Usuário cadastrado',
          message: `"${payload.name}" · ${normalizedEmail} · perfil ${roleLabel(role)} gravado no banco.`,
        });
        openCreate();
      } catch (err) {
        addToast({
          type: 'error',
          title: 'Falha ao salvar',
          message: err instanceof Error ? err.message : 'Não foi possível gravar no banco.',
        });
      }
      return;
    }

    const payload: CatalogItem = {
      id: editing?.id ?? newId(),
      name: name.trim(),
      description: description.trim() || undefined,
      active,
      sortOrder: editing?.sortOrder ?? items.length + 1,
      meta: editing?.meta,
    };
    try {
      await onSave(payload);
      addToast({
        type: 'success',
        title: editing ? 'Item atualizado' : 'Item cadastrado',
        message: `"${payload.name}" salvo com sucesso.`,
      });
      openCreate();
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Falha ao salvar',
        message: err instanceof Error ? err.message : 'Não foi possível gravar.',
      });
    }
  };

  const toggleActive = async (item: CatalogItem) => {
    try {
      await onSave({ ...item, active: !item.active });
      addToast({
        type: 'success',
        title: item.active ? 'Desativado' : 'Ativado',
        message: `"${item.name}" atualizado no banco.`,
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Falha ao atualizar',
        message: err instanceof Error ? err.message : 'Não foi possível gravar.',
      });
    }
  };

  const selectedProfile = getProfile(role);

  return (
    <div className="space-y-3">
      <div className="bg-white border border-[#f0f0f0] px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-[#002d5b]">{title}</h2>
          <p className="text-[12px] text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-white bg-[#002d5b] hover:bg-[#001529]"
        >
          <Plus className="w-3.5 h-3.5" /> Novo
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <form onSubmit={handleSubmit} className="bg-white border border-[#f0f0f0] p-4 space-y-3 xl:col-span-1">
          <h3 className="text-[13px] font-bold text-slate-800">
            {editing ? 'Editar item' : 'Novo cadastro'}
          </h3>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nome *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-slate-200 rounded-sm px-2.5 py-2 text-[13px] focus:outline-none focus:border-[#1890ff]"
              placeholder={enableAccessRole ? 'Ex.: Carlos Tremea' : 'Ex.: Financeiro'}
            />
          </div>

          {enableAccessRole && (
            <>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  E-mail corporativo *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-slate-200 rounded-sm px-2.5 py-2 text-[13px] focus:outline-none focus:border-[#1890ff]"
                  placeholder="nome.sobrenome@diroma.com.br"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Perfil de acesso *
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as AccessRole)}
                  className="w-full border border-slate-200 rounded-sm px-2.5 py-2 text-[13px] focus:outline-none focus:border-[#1890ff] bg-white"
                >
                  {ACCESS_PROFILES.map((p) => (
                    <option key={p.role} value={p.role}>
                      {p.title} — {p.badge}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-[11px] text-slate-500 leading-snug">
                  {selectedProfile.description}
                </p>
                <ul className="mt-1.5 space-y-0.5">
                  {selectedProfile.accessSummary.map((line) => (
                    <li key={line} className="text-[11px] text-slate-600 flex gap-1.5">
                      <span
                        className="mt-1.5 w-1 h-1 rounded-full shrink-0"
                        style={{ background: selectedProfile.color }}
                      />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {showDescription && !enableAccessRole && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Descrição</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full border border-slate-200 rounded-sm px-2.5 py-2 text-[13px] focus:outline-none focus:border-[#1890ff]"
              />
            </div>
          )}
          <label className="flex items-center gap-2 text-[12px] text-slate-700">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-[#1890ff]" />
            Ativo {enableAccessRole ? '(pode acessar o portal)' : '(visível nos formulários)'}
          </label>
          <div className="flex gap-2 pt-1">
            <button type="submit" className="px-3 py-1.5 text-[12px] font-semibold text-white bg-[#1890ff] hover:bg-[#096dd9]">
              Salvar
            </button>
            {editing && (
              <button type="button" onClick={openCreate} className="px-3 py-1.5 text-[12px] text-slate-600 bg-slate-100">
                Cancelar
              </button>
            )}
          </div>
        </form>

        <div className="bg-white border border-[#f0f0f0] xl:col-span-2 overflow-hidden">
          <div className="px-3 py-2 border-b border-[#f0f0f0] flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={enableAccessRole ? 'Buscar por nome, e-mail ou perfil...' : 'Buscar...'}
              className="flex-1 text-[12px] outline-none"
            />
            <span className="text-[11px] text-slate-400">{filtered.length} itens</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] glpi-table">
              <thead>
                <tr>
                  <th className="py-2.5 px-3">Nome</th>
                  {enableAccessRole ? (
                    <>
                      <th className="py-2.5 px-3">E-mail</th>
                      <th className="py-2.5 px-3">Perfil</th>
                    </>
                  ) : (
                    <th className="py-2.5 px-3">Descrição</th>
                  )}
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={enableAccessRole ? 5 : 4} className="py-10 text-center text-slate-400">
                      Nenhum registro.
                    </td>
                  </tr>
                ) : (
                  filtered.map((item) => {
                    const itemRole = roleFromMeta(item);
                    const profile = getProfile(itemRole);
                    return (
                      <tr key={item.id}>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">{item.name}</td>
                        {enableAccessRole ? (
                          <>
                            <td className="py-2.5 px-3 text-slate-600">{emailFromMeta(item) || '—'}</td>
                            <td className="py-2.5 px-3">
                              <span
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold text-white"
                                style={{ background: profile.color }}
                              >
                                {profile.title}
                              </span>
                            </td>
                          </>
                        ) : (
                          <td className="py-2.5 px-3 text-slate-500">{item.description || '—'}</td>
                        )}
                        <td className="py-2.5 px-3">
                          <button type="button" onClick={() => toggleActive(item)} className="inline-flex items-center gap-1 text-[11px]">
                            {item.active ? (
                              <><ToggleRight className="w-4 h-4 text-emerald-600" /> Ativo</>
                            ) : (
                              <><ToggleLeft className="w-4 h-4 text-slate-400" /> Inativo</>
                            )}
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button type="button" onClick={() => openEdit(item)} className="p-1.5 text-slate-500 hover:text-[#1890ff]" title="Editar">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void (async () => {
                                if (!confirm(`Excluir "${item.name}"?`)) return;
                                try {
                                  await onDelete(item.id);
                                  addToast({ type: 'warning', title: 'Excluído', message: item.name });
                                } catch (err) {
                                  addToast({
                                    type: 'error',
                                    title: 'Falha ao excluir',
                                    message: err instanceof Error ? err.message : 'Não foi possível gravar.',
                                  });
                                }
                              })();
                            }}
                            className="p-1.5 text-slate-500 hover:text-rose-600"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
