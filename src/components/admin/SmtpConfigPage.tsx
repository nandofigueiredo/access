import React, { useState } from 'react';
import { Mail, Server, ShieldCheck, Send, Eye } from 'lucide-react';
import { useWorkflowMail } from '../../store/WorkflowMailContext';
import { SmtpConfig } from '../../types/workflow';
import { ToastMessage } from '../../types';
import { formatDateTimeToBR } from '../../utils/formatters';
import { api, USE_API } from '../../api/client';

interface Props {
  addToast: (t: Omit<ToastMessage, 'id'>) => void;
}

export const SmtpConfigPage: React.FC<Props> = ({ addToast }) => {
  const { smtp, saveSmtp, sendMail, emailLog } = useWorkflowMail();
  const [form, setForm] = useState<SmtpConfig>(smtp);
  const [showPass, setShowPass] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  React.useEffect(() => {
    if (dirty) return;
    setForm({
      ...smtp,
      glpiInbox: smtp.glpiInbox || 'glpi@diroma.com.br',
      glpiEnabled: smtp.glpiEnabled !== false,
    });
  }, [smtp, dirty]);

  const set = <K extends keyof SmtpConfig>(key: K, value: SmtpConfig[K]) => {
    setDirty(true);
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSmtp(form);
      setDirty(false);
      addToast({ type: 'success', title: 'SMTP salvo', message: 'Configuração do workflow de e-mail atualizada.' });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Falha ao salvar SMTP',
        message: err instanceof Error ? err.message : 'Não foi possível gravar no servidor.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      await saveSmtp(form);
      setDirty(false);
      if (USE_API) {
        const result = await api.testSmtp();
        sendMail({
          to: result.to?.length ? result.to : [form.serviceDeskInbox || form.fromEmail],
          subject: result.subject || '[Teste] Portal TI — SMTP Workflow',
          body: result.detail,
          template: 'smtp_test',
        });
        addToast({
          type: result.ok ? (result.status === 'sent_simulated' ? 'info' : 'success') : 'error',
          title: result.ok ? 'E-mail de teste' : 'Falha no teste SMTP',
          message: result.detail,
        });
        return;
      }
      const entry = sendMail({
        to: [form.serviceDeskInbox || form.fromEmail],
        subject: '[Teste] Portal TI — SMTP Workflow',
        body: `Teste local (sem API) em ${new Date().toLocaleString('pt-BR')}.`,
        template: 'smtp_test',
      });
      addToast({
        type: 'info',
        title: 'E-mail de teste',
        message: `Simulado para ${entry.to.join(', ')} (API offline).`,
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Falha no teste SMTP',
        message: err instanceof Error ? err.message : 'Não foi possível testar o SMTP.',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-[#001529] to-[#003a70] text-white rounded-xl px-5 py-4 shadow-sm">
        <div className="flex items-start gap-3">
          <Server className="w-6 h-6 text-sky-300 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-lg font-bold">SMTP & Notificações do Workflow</h2>
            <p className="text-sm text-white/75 mt-1 leading-relaxed">
              Canal de e-mail usado em cada etapa: criação (RH → Service Desk), handoffs N3,
              e fechamento exclusivo do Service Desk com pacote completo para o usuário final.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-white border border-[#f0f0f0] rounded-xl p-5 space-y-4 shadow-sm">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <input type="checkbox" checked={form.enabled} onChange={(e) => set('enabled', e.target.checked)} className="accent-[#1890ff]" />
            Habilitar envio SMTP
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.testMode} onChange={(e) => set('testMode', e.target.checked)} className="accent-[#1890ff]" />
            Modo teste (simula envio e grava no log — recomendado em DEV)
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-[11px] font-semibold text-slate-500">Host SMTP</label>
              <input value={form.host} onChange={(e) => set('host', e.target.value)} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="smtp.office365.com" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-500">Porta</label>
              <input type="number" value={form.port} onChange={(e) => set('port', Number(e.target.value))} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.secure} onChange={(e) => set('secure', e.target.checked)} className="accent-[#1890ff]" />
            TLS/SSL (secure)
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-500">Usuário</label>
              <input value={form.username} onChange={(e) => set('username', e.target.value)} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-500">Senha / App Password</label>
              <div className="relative mt-1">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm pr-10"
                />
                <button type="button" onClick={() => setShowPass((v) => !v)} className="absolute right-2 top-2 text-slate-400">
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-500">Nome do remetente</label>
              <input value={form.fromName} onChange={(e) => set('fromName', e.target.value)} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-500">E-mail remetente</label>
              <input value={form.fromEmail} onChange={(e) => set('fromEmail', e.target.value)} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <h3 className="text-sm font-bold text-[#002d5b] mb-3 flex items-center gap-2">
              <Mail className="w-4 h-4" /> Caixas do workflow
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-500">Service Desk</label>
                <input value={form.serviceDeskInbox} onChange={(e) => set('serviceDeskInbox', e.target.value)} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500">N3 Infra / Segurança</label>
                <input value={form.n3InfraInbox} onChange={(e) => set('n3InfraInbox', e.target.value)} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500">N3 Redes</label>
                <input value={form.n3NetworksInbox} onChange={(e) => set('n3NetworksInbox', e.target.value)} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-500">Caixa GLPI</label>
                <input
                  value={form.glpiInbox}
                  onChange={(e) => set('glpiInbox', e.target.value)}
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="glpi@diroma.com.br"
                />
              </div>
              <label className="flex items-end gap-2 text-sm text-slate-700 pb-2">
                <input
                  type="checkbox"
                  checked={form.glpiEnabled !== false}
                  onChange={(e) => set('glpiEnabled', e.target.checked)}
                  className="accent-[#1890ff]"
                />
                Enviar e-mail ao GLPI na criação de ONB/OFF
              </label>
            </div>
          </div>

          <div className="space-y-2 border-t border-slate-100 pt-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.notifyRequesterOnCreate} onChange={(e) => set('notifyRequesterOnCreate', e.target.checked)} className="accent-[#1890ff]" /> Notificar solicitante na criação</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.notifyRequesterOnClose} onChange={(e) => set('notifyRequesterOnClose', e.target.checked)} className="accent-[#1890ff]" /> Notificar solicitante no fechamento SD</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.notifyEndUserOnComplete} onChange={(e) => set('notifyEndUserOnComplete', e.target.checked)} className="accent-[#1890ff]" /> Notificar usuário final com pacote completo</label>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || testing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#002d5b] hover:bg-[#001529] disabled:opacity-60"
            >
              <ShieldCheck className="w-4 h-4" /> {saving ? 'Salvando…' : 'Salvar SMTP'}
            </button>
            <button
              type="button"
              onClick={() => void handleTest()}
              disabled={testing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-[#002d5b] bg-sky-50 border border-sky-200 hover:bg-sky-100 disabled:opacity-60"
            >
              <Send className="w-4 h-4" /> {testing ? 'Testando…' : 'Enviar teste'}
            </button>
          </div>
        </div>

        <div className="bg-white border border-[#f0f0f0] rounded-xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-[#f0f0f0] bg-slate-50">
            <h3 className="text-sm font-bold text-slate-800">Log de e-mails do workflow</h3>
            <p className="text-[11px] text-slate-500">Últimos disparos (simulados ou reais)</p>
          </div>
          <div className="max-h-[520px] overflow-y-auto divide-y divide-slate-100">
            {emailLog.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-400">Nenhum e-mail ainda.</p>
            ) : (
              emailLog.slice(0, 30).map((m) => (
                <div key={m.id} className="px-4 py-3 text-[12px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-800 truncate">{m.subject}</span>
                    <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${m.status === 'failed' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                      {m.status}
                    </span>
                  </div>
                  <div className="text-slate-500 mt-1">Para: {m.to.join(', ')}</div>
                  <div className="text-slate-400 mt-0.5">{formatDateTimeToBR(m.at)} · {m.template}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
