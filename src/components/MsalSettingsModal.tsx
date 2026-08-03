import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { MsalConfigState, ToastMessage } from '../types';
import { X, ShieldCheck, Key, Save, RefreshCw, CheckCircle2 } from 'lucide-react';

interface MsalSettingsModalProps {
  onClose: () => void;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
}

export const MsalSettingsModal: React.FC<MsalSettingsModalProps> = ({ onClose, addToast }) => {
  const { msalSettings, updateMsalSettings, loginDemo } = useAuth();

  const [clientId, setClientId] = useState(msalSettings.clientId);
  const [tenantId, setTenantId] = useState(msalSettings.tenantId);
  const [redirectUri, setRedirectUri] = useState(
    msalSettings.redirectUri || (typeof window !== 'undefined' ? window.location.origin : '')
  );

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    const isRealConfig =
      clientId.trim().length > 10 &&
      clientId !== '00000000-0000-0000-0000-000000000000';

    const updated: MsalConfigState = {
      clientId: clientId.trim(),
      tenantId: tenantId.trim() || 'common',
      redirectUri: redirectUri.trim(),
      configured: isRealConfig,
    };

    updateMsalSettings(updated);

    addToast({
      type: 'success',
      title: 'Configurações do MSAL Atualizadas!',
      message: isRealConfig
        ? 'Client ID e Tenant ID do Microsoft Entra ID salvos com sucesso.'
        : 'Modo Demonstrativo mantido com credenciais simuladas.',
    });

    onClose();
  };

  const setDemoDefaults = () => {
    setClientId('00000000-0000-0000-0000-000000000000');
    setTenantId('common');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl overflow-hidden my-auto space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Configuração Microsoft Entra ID</h3>
              <p className="text-xs text-slate-400">Autenticação MSAL React / Single Sign-On</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-300 mb-1">
              Application (Client) ID <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="Ex: e8d1a123-4567-89ab-cdef-0123456789ab"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 font-mono focus:border-blue-500 focus:outline-none"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">
              Registrado no portal do Azure em Azure Active Directory &gt; App registrations.
            </span>
          </div>

          <div>
            <label className="block font-medium text-slate-300 mb-1">
              Directory (Tenant) ID
            </label>
            <input
              type="text"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              placeholder="common ou ID do seu Tenant Azure"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 font-mono focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-300 mb-1">
              Redirect URI (Origem da Aplicação)
            </label>
            <input
              type="text"
              value={redirectUri}
              readOnly
              className="w-full bg-slate-950/60 border border-slate-800/60 rounded-xl px-3.5 py-2.5 text-xs text-slate-400 font-mono"
            />
          </div>

          <div className="p-3.5 rounded-xl bg-blue-950/40 border border-blue-500/30 text-blue-200 text-[11px] leading-relaxed flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <span>
              Caso nenhum Client ID seja configurado, o aplicativo utiliza automaticamente a autenticação simulada de demonstração corporativa para navegação e testes instantâneos.
            </span>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={setDemoDefaults}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-400 hover:text-white bg-slate-950 border border-slate-800 hover:border-slate-700 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Usar Demo</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl font-semibold text-slate-400 hover:text-white bg-slate-950 transition"
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-md transition"
              >
                <Save className="w-4 h-4" />
                <span>Salvar Configuração</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
