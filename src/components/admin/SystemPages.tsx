import React, { useEffect, useState } from 'react';
import { useCatalog } from '../../store/CatalogContext';
import { ToastMessage } from '../../types';
import { BarChart3, Download, Shield, RotateCcw, Mail, FileText } from 'lucide-react';
import { Ticket } from '../../types';
import { formatDateToBR } from '../../utils/formatters';
import { api, AuditLogEntry, USE_API } from '../../api/client';

interface PageProps {
  addToast: (t: Omit<ToastMessage, 'id'>) => void;
  tickets?: Ticket[];
  onOpenEntra?: () => void;
}

export const SlaConfigPage: React.FC<PageProps> = ({ addToast }) => {
  const { catalog, updateSla } = useCatalog();
  const [days, setDays] = useState(catalog.sla.onboardingMinBusinessDays);
  const [zeroDay, setZeroDay] = useState(catalog.sla.offboardingZeroDay);
  const [queue, setQueue] = useState(catalog.sla.defaultQueue);

  return (
    <div className="bg-white border border-[#f0f0f0] p-4 max-w-xl space-y-4">
      <div>
        <h2 className="text-base font-bold text-[#002d5b]">Parâmetros de SLA</h2>
        <p className="text-[12px] text-slate-500">Regras aplicadas automaticamente aos novos pedidos.</p>
      </div>
      <div>
        <label className="text-[11px] font-semibold text-slate-500">Antecedência mínima onboarding (dias úteis)</label>
        <input type="number" min={0} value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-full border border-slate-200 rounded-sm px-2 py-2 text-[13px] mt-1" />
      </div>
      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" checked={zeroDay} onChange={(e) => setZeroDay(e.target.checked)} className="accent-[#1890ff]" />
        Offboarding com bloqueio Zero-Day
      </label>
      <div>
        <label className="text-[11px] font-semibold text-slate-500">Fila padrão Service Desk</label>
        <select value={queue} onChange={(e) => setQueue(e.target.value)} className="w-full border border-slate-200 rounded-sm px-2 py-2 text-[13px] mt-1">
          {catalog.serviceQueues.filter((q) => q.active).map((q) => (
            <option key={q.id} value={q.name}>{q.name}</option>
          ))}
        </select>
      </div>
      <button
        type="button"
        onClick={() => {
          updateSla({ onboardingMinBusinessDays: days, offboardingZeroDay: zeroDay, defaultQueue: queue });
          addToast({ type: 'success', title: 'SLA atualizado', message: 'Parâmetros salvos.' });
        }}
        className="px-3 py-1.5 text-[12px] font-semibold text-white bg-[#1890ff]"
      >
        Salvar parâmetros
      </button>
    </div>
  );
};

export const ReportsPage: React.FC<PageProps> = ({ tickets = [] }) => {
  const pending = tickets.filter((t) => t.status === 'Pendente TI').length;
  const inProgress = tickets.filter((t) => t.status === 'Em Andamento').length;
  const waitingN3 = tickets.filter((t) => t.status === 'Aguardando N3').length;
  const readyClose = tickets.filter((t) => t.status === 'Pronta p/ Fechamento').length;
  const done = tickets.filter((t) => t.status === 'Concluído').length;
  const onb = tickets.filter((t) => t.type === 'onboarding').length;
  const off = tickets.filter((t) => t.type === 'offboarding').length;

  return (
    <div className="space-y-3">
      <div className="bg-white border border-[#f0f0f0] px-4 py-3 flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-[#1890ff]" />
        <div>
          <h2 className="text-base font-bold text-[#002d5b]">Relatórios & Estatísticas</h2>
          <p className="text-[12px] text-slate-500">
            Dados ao vivo do banco (polling a cada 8s no portal).
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        {[
          ['Total', tickets.length, '#fadb14', '#111'],
          ['Onboarding', onb, '#52c41a', '#fff'],
          ['Offboarding', off, '#1890ff', '#fff'],
          ['Pendente', pending, '#fa8c16', '#fff'],
          ['Em andamento', inProgress, '#13c2c2', '#fff'],
          ['N3', waitingN3, '#722ed1', '#fff'],
          ['Concluídos', done, '#8c8c8c', '#fff'],
        ].map(([label, value, bg, color]) => (
          <div key={String(label)} className="glpi-stat" style={{ background: String(bg), color: String(color) }}>
            <div className="text-xl font-bold">{value as number}</div>
            <div className="text-[11px] mt-1">{label as string}</div>
          </div>
        ))}
      </div>
      <div className="bg-white border border-[#f0f0f0] p-4 text-[12px] text-slate-600">
        Pronta p/ fechamento: <strong>{readyClose}</strong> · Fonte: PostgreSQL via API.
      </div>
    </div>
  );
};

export const ExportPage: React.FC<PageProps> = ({ tickets = [], addToast }) => {
  const exportCsv = () => {
    const headers = ['ID', 'Tipo', 'Status', 'Nome', 'Gestor', 'CriadoEm'];
    const rows = tickets.map((t) => [t.id, t.type, t.status, t.nomeCompleto, t.gestor, formatDateToBR(t.createdAt)]);
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `portal_ti_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    addToast({ type: 'success', title: 'Exportação', message: `${tickets.length} registros exportados.` });
  };

  return (
    <div className="bg-white border border-[#f0f0f0] p-4 space-y-3 max-w-lg">
      <div className="flex items-center gap-2">
        <Download className="w-4 h-4 text-[#1890ff]" />
        <h2 className="text-base font-bold text-[#002d5b]">Exportação</h2>
      </div>
      <p className="text-[12px] text-slate-500">Gera CSV para auditoria, RH e Service Desk.</p>
      <button type="button" onClick={exportCsv} className="px-3 py-2 text-[12px] font-semibold text-white bg-[#002d5b]">
        Exportar chamados (CSV)
      </button>
    </div>
  );
};

export const AuditPage: React.FC<PageProps> = ({ tickets = [] }) => {
  const [events, setEvents] = useState<
    { id: string; action: string; who: string; when: string; detail: string }[]
  >([]);
  const [source, setSource] = useState<'api' | 'fallback'>('fallback');

  useEffect(() => {
    let cancelled = false;

    const mapFallback = () =>
      [...tickets]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 50)
        .map((t) => ({
          id: t.id,
          action: t.status === 'Concluído' ? 'CONCLUÍDO' : 'ATUALIZAÇÃO',
          who: t.createdBy,
          when: t.updatedAt,
          detail: `${t.type} · ${t.nomeCompleto} · ${t.status}`,
        }));

    const load = async () => {
      if (!USE_API) {
        if (!cancelled) {
          setSource('fallback');
          setEvents(mapFallback());
        }
        return;
      }
      try {
        const rows: AuditLogEntry[] = await api.listAudit({ limit: 100 });
        if (cancelled) return;
        setSource('api');
        setEvents(
          rows.map((r) => ({
            id: r.targetRequestId || r.id,
            action: r.action,
            who: r.performedBy || '—',
            when: r.timestamp,
            detail: JSON.stringify(r.details || {}),
          }))
        );
      } catch {
        if (!cancelled) {
          setSource('fallback');
          setEvents(mapFallback());
        }
      }
    };

    void load();
    const timer = window.setInterval(() => void load(), 10000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [tickets]);

  return (
    <div className="space-y-3">
      <div className="bg-white border border-[#f0f0f0] px-4 py-3 flex items-center gap-2">
        <Shield className="w-4 h-4 text-[#1890ff]" />
        <div>
          <h2 className="text-base font-bold text-[#002d5b]">Logs de Auditoria</h2>
          <p className="text-[12px] text-slate-500">
            {source === 'api'
              ? 'Trilha imutável do banco (LGPD) — atualização a cada 10s.'
              : 'Fallback local — backend de auditoria indisponível.'}
          </p>
        </div>
      </div>
      <div className="bg-white border border-[#f0f0f0] overflow-x-auto">
        <table className="w-full text-[12px] glpi-table">
          <thead>
            <tr>
              <th className="py-2.5 px-3">Quando</th>
              <th className="py-2.5 px-3">Ação</th>
              <th className="py-2.5 px-3">Alvo</th>
              <th className="py-2.5 px-3">Autor</th>
              <th className="py-2.5 px-3">Detalhe</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e, idx) => (
              <tr key={`${e.id}-${e.when}-${idx}`}>
                <td className="py-2 px-3 whitespace-nowrap">{formatDateToBR(e.when)}</td>
                <td className="py-2 px-3 font-semibold">{e.action}</td>
                <td className="py-2 px-3 text-[#1890ff] font-semibold">{e.id}</td>
                <td className="py-2 px-3">{e.who}</td>
                <td className="py-2 px-3 text-slate-500 max-w-md truncate" title={e.detail}>
                  {e.detail}
                </td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 px-3 text-center text-slate-400">
                  Nenhum evento de auditoria ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const TemplatesPage: React.FC<PageProps & { kind: 'email' | 'term' }> = ({ kind, addToast }) => {
  const { catalog, upsertItem, removeItem } = useCatalog();
  const key = kind === 'email' ? 'emailTemplates' : 'termTemplates';
  const items = catalog[key];
  const Icon = kind === 'email' ? Mail : FileText;

  return (
    <div className="space-y-3">
      <div className="bg-white border border-[#f0f0f0] px-4 py-3 flex items-center gap-2">
        <Icon className="w-4 h-4 text-[#1890ff]" />
        <div>
          <h2 className="text-base font-bold text-[#002d5b]">
            {kind === 'email' ? 'Templates de Notificação' : 'Templates de Termos'}
          </h2>
          <p className="text-[12px] text-slate-500">
            {kind === 'email'
              ? 'Modelos usados em alertas ao RH, gestor e Service Desk.'
              : 'Termos LGPD e de responsabilidade impressos nos fluxos.'}
          </p>
        </div>
      </div>
      {/* reuse simple list via CatalogCrud would be better - inline minimal */}
      <div className="bg-white border border-[#f0f0f0] p-4 text-[12px] text-slate-600">
        Gerencie os itens abaixo pela área de Configuração correspondente ou edite aqui os nomes dos templates.
        <button
          type="button"
          className="ml-2 text-[#1890ff] font-semibold"
          onClick={() => {
            upsertItem(key, {
              id: `${key}-${Date.now()}`,
              name: kind === 'email' ? 'Novo template de e-mail' : 'Novo termo',
              active: true,
              sortOrder: items.length + 1,
            });
            addToast({ type: 'success', title: 'Template criado', message: 'Edite o nome na listagem de catálogo.' });
          }}
        >
          + Adicionar
        </button>
      </div>
      <ul className="bg-white border border-[#f0f0f0] divide-y divide-[#f0f0f0]">
        {items.map((t) => (
          <li key={t.id} className="px-4 py-3 flex items-center justify-between text-[13px]">
            <div>
              <div className="font-semibold">{t.name}</div>
              <div className="text-[11px] text-slate-400">{t.description || '—'}</div>
            </div>
            <button type="button" className="text-rose-600 text-[12px]" onClick={() => removeItem(key, t.id)}>Excluir</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const GeneralConfigPage: React.FC<PageProps> = ({ addToast }) => {
  const { catalog, resetDefaults } = useCatalog();
  return (
    <div className="bg-white border border-[#f0f0f0] p-4 space-y-4 max-w-xl">
      <h2 className="text-base font-bold text-[#002d5b]">Configuração Geral</h2>
      <p className="text-[12px] text-slate-500">
        Última atualização do catálogo: {new Date(catalog.updatedAt).toLocaleString('pt-BR')}
      </p>
      <button
        type="button"
        onClick={() => {
          if (confirm('Restaurar todos os cadastros para o padrão de fábrica?')) {
            resetDefaults();
            addToast({ type: 'warning', title: 'Catálogo restaurado', message: 'Valores padrão reaplicados.' });
          }
        }}
        className="inline-flex items-center gap-2 px-3 py-2 text-[12px] font-semibold border border-slate-200 hover:bg-slate-50"
      >
        <RotateCcw className="w-3.5 h-3.5" /> Restaurar padrões
      </button>
    </div>
  );
};

export const EntraConfigPage: React.FC<PageProps> = ({ onOpenEntra, addToast }) => (
  <div className="bg-white border border-[#f0f0f0] p-4 space-y-3 max-w-xl">
    <h2 className="text-base font-bold text-[#002d5b]">Integração Microsoft Entra ID</h2>
    <p className="text-[12px] text-slate-500">
      Configure Client ID, Tenant ID e Redirect URI do App Registration Azure para SSO.
    </p>
    <button
      type="button"
      onClick={() => {
        onOpenEntra?.();
        addToast({ type: 'info', title: 'Entra ID', message: 'Abrindo configurações MSAL.' });
      }}
      className="px-3 py-2 text-[12px] font-semibold text-white bg-[#002d5b]"
    >
      Abrir configuração MSAL
    </button>
  </div>
);
