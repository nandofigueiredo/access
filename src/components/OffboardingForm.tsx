import React, { useState } from 'react';
import { OffboardingData, ReturnLogisticsMode, ToastMessage } from '../types';
import { generateTicketId } from '../utils/formatters';
import { UserMinus, AlertOctagon, ShieldAlert, Package, CheckSquare, Clock, FileWarning, HelpCircle } from 'lucide-react';
import { useCatalog } from '../store/CatalogContext';

interface OffboardingFormProps {
  onSubmitTicket: (ticket: OffboardingData) => void | Promise<void>;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  onCancel: () => void;
}

export const OffboardingForm: React.FC<OffboardingFormProps> = ({ onSubmitTicket, addToast, onCancel }) => {
  const { activeOptions } = useCatalog();
  const managers = activeOptions('managers');
  const returnMethods = activeOptions('returnMethods');

  // 1. Dados da Revogação
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [emailCorporativo, setEmailCorporativo] = useState('');
  const [gestor, setGestor] = useState('');
  const [dataDesligamento, setDataDesligamento] = useState('');
  const [horaDesligamento, setHoraDesligamento] = useState('18:00');

  // 2. Tratamento LGPD & Arquivos
  const [redirecionamentoEmail, setRedirecionamentoEmail] = useState(true);
  const [emailDestinoRedirecionamento, setEmailDestinoRedirecionamento] = useState('');
  const [transferenciaArquivos, setTransferenciaArquivos] = useState(true);
  const [emailDestinoArquivos, setEmailDestinoArquivos] = useState('');
  const [respostaAutomaticaAusencia, setRespostaAutomaticaAusencia] = useState(true);
  const [orientadoNaoManterArquivosPessoais, setOrientadoNaoManterArquivosPessoais] = useState(true);

  // 3. Devolução de Ativos
  const [notebook, setNotebook] = useState(true);
  const [codigoPatrimonioNotebook, setCodigoPatrimonioNotebook] = useState('');
  const [perifericos, setPerifericos] = useState(true);
  const [smartphone, setSmartphone] = useState(false);
  const [cracha, setCracha] = useState(true);

  const [modalidadeDevolucao, setModalidadeDevolucao] = useState<ReturnLogisticsMode>(
    (returnMethods[0]?.name as ReturnLogisticsMode) || 'Presencial'
  );
  const [prazoLimiteDevolucao, setPrazoLimiteDevolucao] = useState('');

  // 4. Checklist TI
  const [bloqueioIdP, setBloqueioIdP] = useState(true);
  const [encerramentoSessoes, setEncerramentoSessoes] = useState(true);
  const [desvinculacaoLicencas, setDesvinculacaoLicencas] = useState(true);
  const [remocaoGruposEmail, setRemocaoGruposEmail] = useState(true);
  const [limpezaWipeMDM, setLimpezaWipeMDM] = useState(false);
  const [registroLogsAuditoria, setRegistroLogsAuditoria] = useState(true);

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!nomeCompleto.trim()) newErrors.nomeCompleto = 'Nome do colaborador é obrigatório.';
    if (!emailCorporativo.trim()) {
      newErrors.emailCorporativo = 'E-mail corporativo é obrigatório.';
    } else if (!/\S+@\S+\.\S+/.test(emailCorporativo)) {
      newErrors.emailCorporativo = 'Insira um e-mail válido.';
    }
    if (!gestor.trim()) newErrors.gestor = 'Gestor responsável é obrigatório.';
    if (!dataDesligamento) newErrors.dataDesligamento = 'Data do desligamento é obrigatória.';
    if (!horaDesligamento) newErrors.horaDesligamento = 'Hora exata do desligamento é obrigatória.';

    if (redirecionamentoEmail && !emailDestinoRedirecionamento.trim()) {
      newErrors.emailDestinoRedirecionamento = 'Informe o e-mail de destino do redirecionamento (Ex: Gestor).';
    }

    if (transferenciaArquivos && !emailDestinoArquivos.trim()) {
      newErrors.emailDestinoArquivos = 'Informe o e-mail de destino para transferência do Drive/OneDrive.';
    }

    if (!orientadoNaoManterArquivosPessoais) {
      newErrors.orientadoNaoManterArquivosPessoais = 'É necessário confirmar a orientação sobre ausência de arquivos pessoais.';
    }

    if (!modalidadeDevolucao?.trim()) {
      newErrors.modalidadeDevolucao = 'Selecione a modalidade de devolução.';
    }
    if (!prazoLimiteDevolucao) {
      newErrors.prazoLimiteDevolucao = 'Informe o prazo limite de devolução dos ativos.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      addToast({
        type: 'error',
        title: 'Formulário Incompleto',
        message: 'Preencha todos os campos obrigatórios de desligamento e revogação.',
      });
      return;
    }

    const ticketId = generateTicketId('OFF');
    const nowISO = new Date().toISOString();
    const dataHoraISO = `${dataDesligamento}T${horaDesligamento}:00.000Z`;

    const newTicket: OffboardingData = {
      id: ticketId,
      type: 'offboarding',
      status: 'Pendente TI',
      createdAt: nowISO,
      updatedAt: nowISO,
      createdBy: 'RH / Gestor (Via Portal)',
      nomeCompleto,
      emailCorporativo,
      gestor,
      dataHoraDesligamento: dataHoraISO,
      redirecionamentoEmail,
      emailDestinoRedirecionamento: redirecionamentoEmail
        ? emailDestinoRedirecionamento.trim() || undefined
        : undefined,
      transferenciaArquivos,
      emailDestinoArquivos: transferenciaArquivos
        ? emailDestinoArquivos.trim() || undefined
        : undefined,
      respostaAutomaticaAusencia,
      orientadoNaoManterArquivosPessoais,
      ativos: {
        notebook,
        codigoPatrimonioNotebook: codigoPatrimonioNotebook.trim() || undefined,
        perifericos,
        smartphone,
        cracha,
      },
      modalidadeDevolucao,
      prazoLimiteDevolucao,
      itChecklist: {
        bloqueioIdP,
        encerramentoSessoes,
        desvinculacaoLicencas,
        remocaoGruposEmail,
        limpezaWipeMDM,
        registroLogsAuditoria,
      },
    };

    try {
      await onSubmitTicket(newTicket);
      addToast({
        type: 'warning',
        title: 'Offboarding de TI Registrado!',
        message: `Ticket em fila para bloqueio Zero-Day em ${dataDesligamento} às ${horaDesligamento}.`,
      });
    } catch {
      // Erro já notificado pelo App / API client
    }
  };

  return (
    <div className="form-surface-dark max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
            <UserMinus className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">Formulário de Offboarding de TI</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold">
                Bloqueio Zero-Day
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Revogação imediata de credenciais no Entra ID, transferência LGPD de arquivos e recolhimento de patrimônio.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 text-slate-100">
        {/* SECTION 1: Dados da Revogação */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-slate-200 font-semibold text-sm">
            <Clock className="w-4 h-4 text-rose-400" />
            <span>1. Dados da Revogação de Acessos</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Nome Completo */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Nome Completo do Colaborador <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={nomeCompleto}
                onChange={(e) => setNomeCompleto(e.target.value)}
                placeholder="Ex: Carlos Eduardo Santos"
                className={`w-full bg-slate-950 border ${
                  errors.nomeCompleto ? 'border-rose-500 ring-1 ring-rose-500/50' : 'border-slate-800 focus:border-rose-500'
                } rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition`}
              />
              {errors.nomeCompleto && <p className="text-xs text-rose-400 mt-1">{errors.nomeCompleto}</p>}
            </div>

            {/* E-mail Corporativo */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                E-mail Corporativo a Bloquear <span className="text-rose-400">*</span>
              </label>
              <input
                type="email"
                value={emailCorporativo}
                onChange={(e) => setEmailCorporativo(e.target.value)}
                placeholder="colaborador@empresa.com.br"
                className={`w-full bg-slate-950 border ${
                  errors.emailCorporativo ? 'border-rose-500 ring-1 ring-rose-500/50' : 'border-slate-800 focus:border-rose-500'
                } rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition`}
              />
              {errors.emailCorporativo && <p className="text-xs text-rose-400 mt-1">{errors.emailCorporativo}</p>}
            </div>

            {/* Gestor Direto */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Gestor Direto Responsável <span className="text-rose-400">*</span>
              </label>
              <select
                value={gestor}
                onChange={(e) => {
                  const name = e.target.value;
                  setGestor(name);
                  const mgr = managers.find((m) => m.name === name);
                  const email = typeof mgr?.meta?.email === 'string' ? mgr.meta.email : '';
                  if (email) {
                    if (!emailDestinoRedirecionamento) setEmailDestinoRedirecionamento(email);
                    if (!emailDestinoArquivos) setEmailDestinoArquivos(email);
                  }
                }}
                className={`w-full bg-slate-950 border ${
                  errors.gestor ? 'border-rose-500 ring-1 ring-rose-500/50' : 'border-slate-800 focus:border-rose-500'
                } rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none transition`}
              >
                <option value="">Selecione...</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.name}>{m.name}</option>
                ))}
              </select>
              {errors.gestor && <p className="text-xs text-rose-400 mt-1">{errors.gestor}</p>}
            </div>

            {/* Data e Hora Exata do Desligamento */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Data Desligamento <span className="text-rose-400">*</span>
                </label>
                <input
                  type="date"
                  value={dataDesligamento}
                  onChange={(e) => setDataDesligamento(e.target.value)}
                  className={`w-full bg-slate-950 border ${
                    errors.dataDesligamento ? 'border-rose-500 ring-1 ring-rose-500/50' : 'border-slate-800 focus:border-rose-500'
                  } rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none transition`}
                />
                {errors.dataDesligamento && <p className="text-xs text-rose-400 mt-1">{errors.dataDesligamento}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Hora Exata Bloqueio <span className="text-rose-400">*</span>
                </label>
                <input
                  type="time"
                  value={horaDesligamento}
                  onChange={(e) => setHoraDesligamento(e.target.value)}
                  className={`w-full bg-slate-950 border ${
                    errors.horaDesligamento ? 'border-rose-500 ring-1 ring-rose-500/50' : 'border-slate-800 focus:border-rose-500'
                  } rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none transition`}
                />
                {errors.horaDesligamento && <p className="text-xs text-rose-400 mt-1">{errors.horaDesligamento}</p>}
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-3">
            <AlertOctagon className="w-4 h-4 shrink-0 text-rose-400" />
            <span>
              <strong>Zero Day Lock:</strong> No momento exato especificado, o Entra ID revogará todos os tokens ativos, encerrará sessões M365/Teams e desativará a conta do colaborador.
            </span>
          </div>
        </section>

        {/* SECTION 2: Tratamento de Arquivos e E-mails (Políticas LGPD) */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-slate-200 font-semibold text-sm">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span>2. Tratamento de Arquivos e E-mails (Conformidade LGPD)</span>
          </div>

          <div className="space-y-4 text-xs">
            {/* Redirecionamento de E-mail */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <label className="flex items-center gap-2 font-semibold text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={redirecionamentoEmail}
                  onChange={(e) => setRedirecionamentoEmail(e.target.checked)}
                  className="rounded border-slate-700 text-rose-600 focus:ring-rose-500"
                />
                <span>Redirecionamento de novos e-mails (Prazo máx. padrão: 60 dias)</span>
              </label>

              {redirecionamentoEmail && (
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    E-mail de Destino para Cópia/Redirecionamento <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="email"
                    value={emailDestinoRedirecionamento}
                    onChange={(e) => setEmailDestinoRedirecionamento(e.target.value)}
                    placeholder="gestor.setor@empresa.com.br"
                    className={`w-full bg-slate-900 border ${
                      errors.emailDestinoRedirecionamento ? 'border-rose-500' : 'border-slate-800'
                    } rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none`}
                  />
                  {errors.emailDestinoRedirecionamento && (
                    <p className="text-xs text-rose-400 mt-1">{errors.emailDestinoRedirecionamento}</p>
                  )}
                </div>
              )}
            </div>

            {/* Transferência de Arquivos */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <label className="flex items-center gap-2 font-semibold text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={transferenciaArquivos}
                  onChange={(e) => setTransferenciaArquivos(e.target.checked)}
                  className="rounded border-slate-700 text-rose-600 focus:ring-rose-500"
                />
                <span>Transferência de Custódia de Arquivos Cloud (OneDrive / Drive)</span>
              </label>

              {transferenciaArquivos && (
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    E-mail de Destino para Transferência de Arquivos <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="email"
                    value={emailDestinoArquivos}
                    onChange={(e) => setEmailDestinoArquivos(e.target.value)}
                    placeholder="gestor.setor@empresa.com.br"
                    className={`w-full bg-slate-900 border ${
                      errors.emailDestinoArquivos ? 'border-rose-500' : 'border-slate-800'
                    } rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none`}
                  />
                  {errors.emailDestinoArquivos && (
                    <p className="text-xs text-rose-400 mt-1">{errors.emailDestinoArquivos}</p>
                  )}
                </div>
              )}
            </div>

            {/* Resposta Automática Out of Office */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="font-semibold text-slate-200 block">
                Resposta Automática de Desligamento (Out of Office)
              </span>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="radio"
                    name="respostaAusencia"
                    checked={respostaAutomaticaAusencia === true}
                    onChange={() => setRespostaAutomaticaAusencia(true)}
                    className="text-rose-500 focus:ring-rose-500"
                  />
                  <span>Sim – Ativar mensagem automática informando o desligamento</span>
                </label>
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="radio"
                    name="respostaAusencia"
                    checked={respostaAutomaticaAusencia === false}
                    onChange={() => setRespostaAutomaticaAusencia(false)}
                    className="text-rose-500 focus:ring-rose-500"
                  />
                  <span>Não</span>
                </label>
              </div>
            </div>

            {/* Checkbox de Orientação LGPD */}
            <div className="pt-2">
              <label className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={orientadoNaoManterArquivosPessoais}
                  onChange={(e) => {
                    setOrientadoNaoManterArquivosPessoais(e.target.checked);
                    if (errors.orientadoNaoManterArquivosPessoais) {
                      setErrors((prev) => ({ ...prev, orientadoNaoManterArquivosPessoais: '' }));
                    }
                  }}
                  className="mt-0.5 rounded border-slate-700 text-rose-600 focus:ring-rose-500 shrink-0"
                />
                <span className="text-xs text-slate-200 leading-relaxed font-medium">
                  [x] O colaborador foi formalmente orientado a não sincronizar ou armazenar arquivos pessoais nos computadores e drives corporativos da empresa. <span className="text-rose-400">*</span>
                </span>
              </label>
              {errors.orientadoNaoManterArquivosPessoais && (
                <p className="text-xs text-rose-400 mt-1">{errors.orientadoNaoManterArquivosPessoais}</p>
              )}
            </div>
          </div>
        </section>

        {/* SECTION 3: Devolução de Ativos / Logística Reversa */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-slate-200 font-semibold text-sm">
            <Package className="w-4 h-4 text-blue-400" />
            <span>3. Devolução de Ativos & Logística Reversa</span>
          </div>

          {/* Checklist de Ativos */}
          <div className="space-y-3">
            <label className="block text-xs font-medium text-slate-300">Lista de Ativos a Recolher</label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {/* Notebook */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <label className="flex items-center gap-2 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notebook}
                    onChange={(e) => setNotebook(e.target.checked)}
                    className="rounded border-slate-700 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Notebook Corporativo</span>
                </label>
                {notebook && (
                  <input
                    type="text"
                    value={codigoPatrimonioNotebook}
                    onChange={(e) => setCodigoPatrimonioNotebook(e.target.value)}
                    placeholder="Código de Patrimônio (Ex: PAT-9921)"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:outline-none"
                  />
                )}
              </div>

              {/* Periféricos */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center">
                <label className="flex items-center gap-2 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={perifericos}
                    onChange={(e) => setPerifericos(e.target.checked)}
                    className="rounded border-slate-700 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Periféricos (Monitor, Teclado, Mouse, Headset)</span>
                </label>
              </div>

              {/* Smartphone */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center">
                <label className="flex items-center gap-2 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={smartphone}
                    onChange={(e) => setSmartphone(e.target.checked)}
                    className="rounded border-slate-700 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Smartphone / SIM Card Corporativo</span>
                </label>
              </div>

              {/* Crachá */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center">
                <label className="flex items-center gap-2 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cracha}
                    onChange={(e) => setCracha(e.target.checked)}
                    className="rounded border-slate-700 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Crachá de Acesso Físico / Chaves</span>
                </label>
              </div>
            </div>
          </div>

          {/* Modalidade de devolução */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800/80">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Logística de Recolhimento <span className="text-rose-400">*</span>
              </label>
              <select
                value={modalidadeDevolucao}
                onChange={(e) => setModalidadeDevolucao(e.target.value as ReturnLogisticsMode)}
                className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:border-blue-500 focus:outline-none transition ${
                  errors.modalidadeDevolucao ? 'border-rose-500' : 'border-slate-800'
                }`}
              >
                {returnMethods.length === 0 && <option value="Presencial">Presencial</option>}
                {returnMethods.map((m) => (
                  <option key={m.id} value={m.name}>{m.name}</option>
                ))}
              </select>
              {errors.modalidadeDevolucao && (
                <p className="mt-1 text-[11px] text-rose-400">{errors.modalidadeDevolucao}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Prazo Limite para Devolução <span className="text-rose-400">*</span>
              </label>
              <input
                type="date"
                value={prazoLimiteDevolucao}
                onChange={(e) => setPrazoLimiteDevolucao(e.target.value)}
                className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:border-blue-500 focus:outline-none transition ${
                  errors.prazoLimiteDevolucao ? 'border-rose-500' : 'border-slate-800'
                }`}
              />
              {errors.prazoLimiteDevolucao && (
                <p className="mt-1 text-[11px] text-rose-400">{errors.prazoLimiteDevolucao}</p>
              )}
            </div>
          </div>
        </section>

        {/* SECTION 4: Checklist de Encerramento (Exclusivo da TI) */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-slate-200 font-semibold text-sm">
            <CheckSquare className="w-4 h-4 text-emerald-400" />
            <span>4. Checklist de Encerramento Técnico (Exclusivo da TI)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={bloqueioIdP}
                onChange={(e) => setBloqueioIdP(e.target.checked)}
                className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
              />
              <span>Bloqueio de Login no IdP (Entra ID / Workspace)</span>
            </label>

            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={encerramentoSessoes}
                onChange={(e) => setEncerramentoSessoes(e.target.checked)}
                className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
              />
              <span>Encerramento de sessões ativas em dispositivos</span>
            </label>

            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={desvinculacaoLicencas}
                onChange={(e) => setDesvinculacaoLicencas(e.target.checked)}
                className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
              />
              <span>Desvinculação de licenças pagas atreladas</span>
            </label>

            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={remocaoGruposEmail}
                onChange={(e) => setRemocaoGruposEmail(e.target.checked)}
                className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
              />
              <span>Remoção de listas de transmissão e grupos</span>
            </label>

            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={limpezaWipeMDM}
                onChange={(e) => setLimpezaWipeMDM(e.target.checked)}
                className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
              />
              <span>Limpeza/Formatação remota executada (Wipe MDM)</span>
            </label>

            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={registroLogsAuditoria}
                onChange={(e) => setRegistroLogsAuditoria(e.target.checked)}
                className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
              />
              <span>Registro de Logs de revogação salvo para auditoria</span>
            </label>
          </div>
        </section>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition"
          >
            Cancelar
          </button>
          <button
            id="btn-submit-offboarding"
            type="submit"
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-600/25 transition active:scale-[0.99]"
          >
            <UserMinus className="w-4 h-4" />
            <span>Registrar Desligamento & Revogação</span>
          </button>
        </div>
      </form>
    </div>
  );
};
