import React, { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Search, ToggleLeft, ToggleRight } from 'lucide-react';
import { CatalogItem } from '../../types/catalog';
import { ToastMessage } from '../../types';

interface CatalogCrudPageProps {
  title: string;
  subtitle: string;
  items: CatalogItem[];
  onSave: (item: CatalogItem) => void;
  onDelete: (id: string) => void;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  /** Campos extras opcionais no formulário (description) */
  showDescription?: boolean;
}

function newId() {
  return `cat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export const CatalogCrudPage: React.FC<CatalogCrudPageProps> = ({
  title,
  subtitle,
  items,
  onSave,
  onDelete,
  addToast,
  showDescription = true,
}) => {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return [...items]
      .filter((i) => !q || i.name.toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }, [items, search]);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setActive(true);
  };

  const openEdit = (item: CatalogItem) => {
    setEditing(item);
    setName(item.name);
    setDescription(item.description || '');
    setActive(item.active);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast({ type: 'error', title: 'Nome obrigatório', message: 'Informe o nome do item.' });
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
    onSave(payload);
    addToast({
      type: 'success',
      title: editing ? 'Item atualizado' : 'Item cadastrado',
      message: `"${payload.name}" salvo com sucesso.`,
    });
    openCreate();
  };

  const toggleActive = (item: CatalogItem) => {
    onSave({ ...item, active: !item.active });
  };

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
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Nome *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-slate-200 rounded-sm px-2.5 py-2 text-[13px] focus:outline-none focus:border-[#1890ff]"
              placeholder="Ex.: Financeiro"
            />
          </div>
          {showDescription && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Descrição</label>
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
            Ativo (visível nos formulários)
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
              placeholder="Buscar..."
              className="flex-1 text-[12px] outline-none"
            />
            <span className="text-[11px] text-slate-400">{filtered.length} itens</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] glpi-table">
              <thead>
                <tr>
                  <th className="py-2.5 px-3">Nome</th>
                  <th className="py-2.5 px-3">Descrição</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-slate-400">Nenhum registro.</td>
                  </tr>
                ) : (
                  filtered.map((item) => (
                    <tr key={item.id}>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{item.name}</td>
                      <td className="py-2.5 px-3 text-slate-500">{item.description || '—'}</td>
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
                            if (confirm(`Excluir "${item.name}"?`)) {
                              onDelete(item.id);
                              addToast({ type: 'warning', title: 'Excluído', message: item.name });
                            }
                          }}
                          className="p-1.5 text-slate-500 hover:text-rose-600"
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
