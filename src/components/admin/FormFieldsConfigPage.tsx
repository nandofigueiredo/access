import React, { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import { useCatalog } from '../../store/CatalogContext';
import { FormFieldConfig } from '../../types/catalog';
import { ToastMessage } from '../../types';

interface Props {
  addToast: (t: Omit<ToastMessage, 'id'>) => void;
}

const SECTIONS = ['Colaborador', 'Equipamento', 'Acessos', 'Acesso físico', 'LGPD', 'Dados & LGPD', 'Devolução', 'Outros'];
const FIELD_TYPES: FormFieldConfig['fieldType'][] = [
  'text', 'email', 'date', 'datetime', 'select', 'multiselect', 'checkbox', 'textarea', 'boolean_group',
];

function newId() {
  return `fld-${Date.now().toString(36)}`;
}

export const FormFieldsConfigPage: React.FC<Props> = ({ addToast }) => {
  const { catalog, upsertFormField, removeFormField } = useCatalog();
  const [formFilter, setFormFilter] = useState<'all' | 'onboarding' | 'offboarding'>('all');
  const [editing, setEditing] = useState<FormFieldConfig | null>(null);

  const [form, setForm] = useState<FormFieldConfig['form']>('onboarding');
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [section, setSection] = useState('Colaborador');
  const [fieldType, setFieldType] = useState<FormFieldConfig['fieldType']>('text');
  const [required, setRequired] = useState(false);
  const [visible, setVisible] = useState(true);
  const [helpText, setHelpText] = useState('');
  const [sortOrder, setSortOrder] = useState(1);

  const list = useMemo(() => {
    return catalog.formFields
      .filter((f) => formFilter === 'all' || f.form === formFilter || f.form === 'both')
      .sort((a, b) => a.form.localeCompare(b.form) || a.sortOrder - b.sortOrder);
  }, [catalog.formFields, formFilter]);

  const reset = () => {
    setEditing(null);
    setForm('onboarding');
    setKey('');
    setLabel('');
    setSection('Colaborador');
    setFieldType('text');
    setRequired(false);
    setVisible(true);
    setHelpText('');
    setSortOrder(list.length + 1);
  };

  const openEdit = (f: FormFieldConfig) => {
    setEditing(f);
    setForm(f.form);
    setKey(f.key);
    setLabel(f.label);
    setSection(f.section);
    setFieldType(f.fieldType);
    setRequired(f.required);
    setVisible(f.visible);
    setHelpText(f.helpText || '');
    setSortOrder(f.sortOrder);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim() || !label.trim()) {
      addToast({ type: 'error', title: 'Campos obrigatórios', message: 'Informe chave e rótulo.' });
      return;
    }
    const payload: FormFieldConfig = {
      id: editing?.id ?? newId(),
      form,
      key: key.trim(),
      label: label.trim(),
      section,
      fieldType,
      required,
      visible,
      helpText: helpText.trim() || undefined,
      catalogSource: editing?.catalogSource,
      placeholder: editing?.placeholder,
      sortOrder,
      active: true,
    };
    upsertFormField(payload);
    addToast({ type: 'success', title: 'Campo salvo', message: payload.label });
    reset();
  };

  return (
    <div className="space-y-3">
      <div className="bg-white border border-[#f0f0f0] px-4 py-3">
        <h2 className="text-base font-bold text-[#002d5b]">Campos Automatizados</h2>
        <p className="text-[12px] text-slate-500 mt-0.5">
          Defina quais campos aparecem nos formulários de Onboarding e Offboarding preenchidos pelo RH.
          Itens inativos ou ocultos não são exibidos ao usuário.
        </p>
      </div>

      <div className="flex gap-2">
        {(['all', 'onboarding', 'offboarding'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFormFilter(f)}
            className={`px-3 py-1.5 text-[12px] font-semibold border ${
              formFilter === f ? 'bg-[#1890ff] text-white border-[#1890ff]' : 'bg-white text-slate-600 border-slate-200'
            }`}
          >
            {f === 'all' ? 'Todos' : f === 'onboarding' ? 'Onboarding' : 'Offboarding'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <form onSubmit={handleSave} className="bg-white border border-[#f0f0f0] p-4 space-y-3">
          <h3 className="text-[13px] font-bold">{editing ? 'Editar campo' : 'Novo campo'}</h3>
          <div>
            <label className="text-[11px] font-semibold text-slate-500">Formulário</label>
            <select value={form} onChange={(e) => setForm(e.target.value as FormFieldConfig['form'])} className="w-full border border-slate-200 rounded-sm px-2 py-2 text-[13px] mt-1">
              <option value="onboarding">Onboarding</option>
              <option value="offboarding">Offboarding</option>
              <option value="both">Ambos</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-500">Chave técnica</label>
            <input value={key} onChange={(e) => setKey(e.target.value)} className="w-full border border-slate-200 rounded-sm px-2 py-2 text-[13px] mt-1 font-mono" placeholder="ex: dataInicio" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-500">Rótulo (visível)</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)} className="w-full border border-slate-200 rounded-sm px-2 py-2 text-[13px] mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-semibold text-slate-500">Seção</label>
              <select value={section} onChange={(e) => setSection(e.target.value)} className="w-full border border-slate-200 rounded-sm px-2 py-2 text-[13px] mt-1">
                {SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-500">Tipo</label>
              <select value={fieldType} onChange={(e) => setFieldType(e.target.value as FormFieldConfig['fieldType'])} className="w-full border border-slate-200 rounded-sm px-2 py-2 text-[13px] mt-1">
                {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-500">Ordem</label>
            <input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} className="w-full border border-slate-200 rounded-sm px-2 py-2 text-[13px] mt-1" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-500">Ajuda</label>
            <input value={helpText} onChange={(e) => setHelpText(e.target.value)} className="w-full border border-slate-200 rounded-sm px-2 py-2 text-[13px] mt-1" />
          </div>
          <label className="flex items-center gap-2 text-[12px]"><input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} className="accent-[#1890ff]" /> Obrigatório</label>
          <label className="flex items-center gap-2 text-[12px]"><input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="accent-[#1890ff]" /> Visível no formulário</label>
          <div className="flex gap-2">
            <button type="submit" className="px-3 py-1.5 text-[12px] font-semibold text-white bg-[#1890ff]">Salvar</button>
            {editing && <button type="button" onClick={reset} className="px-3 py-1.5 text-[12px] bg-slate-100">Cancelar</button>}
          </div>
        </form>

        <div className="bg-white border border-[#f0f0f0] xl:col-span-2 overflow-x-auto">
          <table className="w-full text-[12px] glpi-table">
            <thead>
              <tr>
                <th className="py-2.5 px-3">Form</th>
                <th className="py-2.5 px-3">Ordem</th>
                <th className="py-2.5 px-3">Seção</th>
                <th className="py-2.5 px-3">Rótulo</th>
                <th className="py-2.5 px-3">Chave</th>
                <th className="py-2.5 px-3">Tipo</th>
                <th className="py-2.5 px-3">Flags</th>
                <th className="py-2.5 px-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {list.map((f) => (
                <tr key={f.id}>
                  <td className="py-2 px-3 capitalize">{f.form}</td>
                  <td className="py-2 px-3">{f.sortOrder}</td>
                  <td className="py-2 px-3">{f.section}</td>
                  <td className="py-2 px-3 font-semibold">{f.label}</td>
                  <td className="py-2 px-3 font-mono text-[11px] text-slate-500">{f.key}</td>
                  <td className="py-2 px-3">{f.fieldType}</td>
                  <td className="py-2 px-3">
                    <span className="inline-flex gap-1">
                      {f.required && <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold">OBR</span>}
                      {f.visible ? (
                        <span className="inline-flex items-center gap-0.5 text-emerald-600 text-[10px]"><Eye className="w-3 h-3" /> VIS</span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-slate-400 text-[10px]"><EyeOff className="w-3 h-3" /> OFF</span>
                      )}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <button type="button" onClick={() => openEdit(f)} className="p-1.5 text-slate-500 hover:text-[#1890ff]"><Pencil className="w-3.5 h-3.5" /></button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Excluir campo "${f.label}"?`)) {
                          removeFormField(f.id);
                          addToast({ type: 'warning', title: 'Campo removido', message: f.label });
                        }
                      }}
                      className="p-1.5 text-slate-500 hover:text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
