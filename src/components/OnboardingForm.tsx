import React, { useState } from 'react';
import { Department, WorkMode, HardwareProfile, PowerBiRole, OnboardingData, ToastMessage } from '../types';
import { formatCPF, isValidCPF, evaluateOnboardingSLA, generateTicketId } from '../utils/formatters';
import { UserPlus, AlertCircle, CheckCircle, Laptop, ShieldCheck, FileCheck, Building2, Server, HelpCircle } from 'lucide-react';
import { useCatalog } from '../store/CatalogContext';

interface OnboardingFormProps {
  onSubmitTicket: (ticket: OnboardingData) => void | Promise<void>;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  onCancel: () => void;
}

export const OnboardingForm: React.FC<OnboardingFormProps> = ({ onSubmitTicket, addToast, onCancel }) => {
  const { activeOptions, catalog } = useCatalog();
  const departments = activeOptions('departments');
  const positions = activeOptions('positions');
  const workModes = activeOptions('workModes');
  const hardwareProfiles = activeOptions('hardwareProfiles');
  const managers = activeOptions('managers');
  const units = activeOptions('units');
  const slaDays = catalog.sla.onboardingMinBusinessDays;

  // 1. Dados do Colaborador
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [cpf, setCpf] = useState('');
  const [emailPessoal, setEmailPessoal] = useState('');
  const [cargo, setCargo] = useState('');
  const [departamento, setDepartamento] = useState<Department>((departments[0]?.name as Department) || 'TI');
  const [gestor, setGestor] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [modalidade, setModalidade] = useState<WorkMode>((workModes.find((w) => w.name === 'Híbrido')?.name as WorkMode) || 'Híbrido');
  const [enderecoEntrega, setEnderecoEntrega] = useState('');

  // 2. Hardware
  const [perfilHardware, setPerfilHardware] = useState<HardwareProfile>(
    (hardwareProfiles[0]?.name as HardwareProfile) || 'Padrão Admin'
  );
  const [justificativaHardware, setJustificativaHardware] = useState('');
  const [monitor, setMonitor] = useState(true);
  const [tecladoMouse, setTecladoMouse] = useState(true);
  const [headset, setHeadset] = useState(true);
  const [suporteErgonomico, setSuporteErgonomico] = useState(false);
  const [simCard, setSimCard] = useState(false);
  const [smartphone, setSmartphone] = useState(false);

  // 3. Sistemas & Acessos
  const [copiarAcessosDe, setCopiarAcessosDe] = useState('');
  const [office365, setOffice365] = useState(true);
  const [teamsSlack, setTeamsSlack] = useState(true);
  const [gerenciadorSenhas, setGerenciadorSenhas] = useState(true);

  const [erp, setErp] = useState(false);
  const [erpDetalhe, setErpDetalhe] = useState('');
  const [crm, setCrm] = useState(false);
  const [crmDetalhe, setCrmDetalhe] = useState('');
  const [powerBi, setPowerBi] = useState<PowerBiRole>('Visualizador');
  const [pastasCompartilhadas, setPastasCompartilhadas] = useState(true);
  const [pastasDetalhe, setPastasDetalhe] = useState('');
  const [vpn, setVpn] = useState(false);
  const [assinaturaDigital, setAssinaturaDigital] = useState(false);

  // 4. Acesso Físico
  const [unidade, setUnidade] = useState(units[0]?.name || 'Sede Principal — São Paulo');
  const [necessitaCracha, setNecessitaCracha] = useState(true);

  // LGPD Aceite
  const [lgpdAceito, setLgpdAceito] = useState(false);

  // Validation State
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Live SLA calculation
  const slaInfo = dataInicio ? evaluateOnboardingSLA(dataInicio) : null;

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPF(e.target.value);
    setCpf(formatted);
    if (errors.cpf) {
      setErrors((prev) => ({ ...prev, cpf: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!nomeCompleto.trim()) newErrors.nomeCompleto = 'Nome completo é obrigatório.';
    if (!cpf.trim()) {
      newErrors.cpf = 'CPF é obrigatório.';
    } else if (!isValidCPF(cpf)) {
      newErrors.cpf = 'CPF informado é inválido.';
    }
    if (!emailPessoal.trim()) {
      newErrors.emailPessoal = 'E-mail pessoal é obrigatório.';
    } else if (!/\S+@\S+\.\S+/.test(emailPessoal)) {
      newErrors.emailPessoal = 'Insira um e-mail válido.';
    }
    if (!cargo.trim()) newErrors.cargo = 'Cargo/Função é obrigatório.';
    if (!gestor.trim()) newErrors.gestor = 'Gestor responsável é obrigatório.';
    if (!dataInicio) newErrors.dataInicio = 'Data de início é obrigatória.';

    if ((modalidade === 'Remoto' || modalidade === 'Híbrido') && !enderecoEntrega.trim()) {
      newErrors.enderecoEntrega = 'Endereço de entrega é obrigatório para trabalho Híbrido ou Remoto.';
    }

    if (perfilHardware === 'Padrão Avançado' && !justificativaHardware.trim()) {
      newErrors.justificativaHardware = 'Justificativa é obrigatória para Perfil Avançado (i7/32GB).';
    }

    if (!lgpdAceito) {
      newErrors.lgpdAceito = 'É necessário aceitar os termos da LGPD para continuar.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      addToast({
        type: 'error',
        title: 'Verifique os campos do formulário',
        message: 'Preencha todos os campos obrigatórios e corrija os erros sinalizados.',
      });
      return;
    }

    const ticketId = generateTicketId('ONB');
    const nowISO = new Date().toISOString();

    const newTicket: OnboardingData = {
      id: ticketId,
      type: 'onboarding',
      status: 'Pendente TI',
      createdAt: nowISO,
      updatedAt: nowISO,
      createdBy: 'Gestor/RH (Via Portal)',
      nomeCompleto,
      cpf,
      emailPessoal,
      cargo,
      departamento,
      gestor,
      dataInicio,
      modalidade,
      enderecoEntrega,
      perfilHardware,
      justificativaHardware,
      perifericos: {
        monitor,
        tecladoMouse,
        headset,
        suporteErgonomico,
      },
      telefonia: {
        simCard,
        smartphone,
      },
      copiarAcessosDe,
      plataformaBase: {
        office365,
        teamsSlack,
        gerenciadorSenhas,
      },
      sistemasEspecificos: {
        erp,
        erpDetalhe,
        crm,
        crmDetalhe,
        powerBi,
        pastasCompartilhadas,
        pastasDetalhe,
        vpn,
        assinaturaDigital,
      },
      unidade,
      necessitaCracha,
      lgpdAceito,
      itChecklist: {
        hardwareProvisionado: false,
        contaEntraIdCriada: false,
        sistemasLiberados: false,
        crachaSolicitado: necessitaCracha,
        termoEnviado: false,
      },
    };

    try {
      await onSubmitTicket(newTicket);
      addToast({
        type: 'success',
        title: 'Solicitação de Onboarding Enviada!',
        message: `Ticket registrado com sucesso para a TI.`,
      });
    } catch {
      // Erro já notificado pelo App / API client
    }
  };

  return (
    <div className="form-surface-dark max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <UserPlus className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">Formulário de Onboarding de TI</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                SLA: 5 Dias Úteis
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Cadastre as especificações técnicas, perfil de hardware e licenças de acessos para o novo colaborador.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 text-slate-100">
        {/* SECTION 1: Dados do Colaborador */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-slate-200 font-semibold text-sm">
            <FileCheck className="w-4 h-4 text-emerald-400" />
            <span>1. Dados do Colaborador (Identificação e Contato)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Nome Completo */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Nome Completo <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={nomeCompleto}
                onChange={(e) => setNomeCompleto(e.target.value)}
                placeholder="Ex: Gabriel Vasconcelos"
                className={`w-full bg-slate-950 border ${
                  errors.nomeCompleto ? 'border-rose-500 ring-1 ring-rose-500/50' : 'border-slate-800 focus:border-emerald-500'
                } rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition`}
              />
              {errors.nomeCompleto && <p className="text-xs text-rose-400 mt-1">{errors.nomeCompleto}</p>}
            </div>

            {/* CPF */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                CPF <span className="text-rose-400">*</span>{' '}
                <span className="text-[10px] text-slate-500">(Termo de responsabilidade de patrimônio)</span>
              </label>
              <input
                type="text"
                value={cpf}
                onChange={handleCpfChange}
                placeholder="000.000.000-00"
                maxLength={14}
                className={`w-full bg-slate-950 border ${
                  errors.cpf ? 'border-rose-500 ring-1 ring-rose-500/50' : 'border-slate-800 focus:border-emerald-500'
                } rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition font-mono`}
              />
              {errors.cpf && <p className="text-xs text-rose-400 mt-1">{errors.cpf}</p>}
            </div>

            {/* E-mail Pessoal */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                E-mail Pessoal <span className="text-rose-400">*</span>{' '}
                <span className="text-[10px] text-slate-500">(Envio de credenciais provisórias)</span>
              </label>
              <input
                type="email"
                value={emailPessoal}
                onChange={(e) => setEmailPessoal(e.target.value)}
                placeholder="colaborador@email.com"
                className={`w-full bg-slate-950 border ${
                  errors.emailPessoal ? 'border-rose-500 ring-1 ring-rose-500/50' : 'border-slate-800 focus:border-emerald-500'
                } rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition`}
              />
              {errors.emailPessoal && <p className="text-xs text-rose-400 mt-1">{errors.emailPessoal}</p>}
            </div>

            {/* Cargo */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Cargo / Função <span className="text-rose-400">*</span>
              </label>
              <select
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                className={`w-full bg-slate-950 border ${
                  errors.cargo ? 'border-rose-500 ring-1 ring-rose-500/50' : 'border-slate-800 focus:border-emerald-500'
                } rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none transition`}
              >
                <option value="">Selecione...</option>
                {positions.map((p) => (
                  <option key={p.id} value={p.name}>{p.name}</option>
                ))}
              </select>
              {errors.cargo && <p className="text-xs text-rose-400 mt-1">{errors.cargo}</p>}
            </div>

            {/* Departamento */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Departamento <span className="text-rose-400">*</span>
              </label>
              <select
                value={departamento}
                onChange={(e) => setDepartamento(e.target.value as Department)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none transition"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* Gestor Responsável */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Gestor Responsável <span className="text-rose-400">*</span>
              </label>
              <select
                value={gestor}
                onChange={(e) => setGestor(e.target.value)}
                className={`w-full bg-slate-950 border ${
                  errors.gestor ? 'border-rose-500 ring-1 ring-rose-500/50' : 'border-slate-800 focus:border-emerald-500'
                } rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none transition`}
              >
                <option value="">Selecione...</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.name}>{m.name}</option>
                ))}
              </select>
              {errors.gestor && <p className="text-xs text-rose-400 mt-1">{errors.gestor}</p>}
            </div>

            {/* Data de Início */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Data de Início (Start Date) <span className="text-rose-400">*</span>
              </label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className={`w-full bg-slate-950 border ${
                  errors.dataInicio ? 'border-rose-500 ring-1 ring-rose-500/50' : 'border-slate-800 focus:border-emerald-500'
                } rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none transition`}
              />
              {errors.dataInicio && <p className="text-xs text-rose-400 mt-1">{errors.dataInicio}</p>}
              <p className="text-[10px] text-slate-500 mt-1">SLA configurado: {slaDays} dias úteis de antecedência.</p>
            </div>

            {/* Modalidade */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Modalidade de Trabalho <span className="text-rose-400">*</span>
              </label>
              <select
                value={modalidade}
                onChange={(e) => setModalidade(e.target.value as WorkMode)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none transition"
              >
                {workModes.map((w) => (
                  <option key={w.id} value={w.name}>{w.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* SLA Alert Box */}
          {slaInfo && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-center gap-3 transition ${
                slaInfo.status === 'warning' || slaInfo.status === 'expired'
                  ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                  : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
              }`}
            >
              <AlertCircle
                className={`w-4 h-4 shrink-0 ${
                  slaInfo.status === 'warning' || slaInfo.status === 'expired' ? 'text-amber-400' : 'text-emerald-400'
                }`}
              />
              <div>
                <span className="font-semibold block">{slaInfo.message}</span>
                {slaInfo.status === 'warning' && (
                  <span className="text-[11px] opacity-80">
                    SLA da TI é de 5 dias úteis. A TI fará o possível para atender em caráter de urgência.
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Endereço de Entrega (conditional) */}
          {(modalidade === 'Remoto' || modalidade === 'Híbrido') && (
            <div className="pt-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Endereço Comercial de Entrega de Equipamentos <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={enderecoEntrega}
                onChange={(e) => setEnderecoEntrega(e.target.value)}
                placeholder="Rua, Número, Bairro, Cidade - UF, CEP"
                className={`w-full bg-slate-950 border ${
                  errors.enderecoEntrega ? 'border-rose-500 ring-1 ring-rose-500/50' : 'border-slate-800 focus:border-emerald-500'
                } rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition`}
              />
              {errors.enderecoEntrega && <p className="text-xs text-rose-400 mt-1">{errors.enderecoEntrega}</p>}
            </div>
          )}
        </section>

        {/* SECTION 2: Especificação do Equipamento (Hardware) */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-slate-200 font-semibold text-sm">
            <Laptop className="w-4 h-4 text-blue-400" />
            <span>2. Especificação do Equipamento (Hardware)</span>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-medium text-slate-300">Perfil de Hardware Padrão</label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Option Admin */}
              <label
                className={`p-4 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                  perfilHardware === 'Padrão Admin'
                    ? 'bg-blue-600/10 border-blue-500/80 ring-1 ring-blue-500/50'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="perfilHardware"
                  checked={perfilHardware === 'Padrão Admin'}
                  onChange={() => setPerfilHardware('Padrão Admin')}
                  className="mt-1 text-blue-500 focus:ring-blue-500"
                />
                <div>
                  <div className="text-sm font-semibold text-slate-100">Padrão Admin / Corporativo</div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Notebook Intel i5 / Ryzen 5, 16GB RAM, SSD 512GB (Ideal para administrativa, comercial e gestão)
                  </p>
                </div>
              </label>

              {/* Option Advanced */}
              <label
                className={`p-4 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                  perfilHardware === 'Padrão Avançado'
                    ? 'bg-indigo-600/10 border-indigo-500/80 ring-1 ring-indigo-500/50'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="perfilHardware"
                  checked={perfilHardware === 'Padrão Avançado'}
                  onChange={() => setPerfilHardware('Padrão Avançado')}
                  className="mt-1 text-indigo-500 focus:ring-indigo-500"
                />
                <div>
                  <div className="text-sm font-semibold text-slate-100">Padrão Avançado / Heavy User</div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Notebook Intel i7 / Ryzen 7, 32GB RAM, SSD 1TB (Desenvolvimento, BI, Engenharia)
                  </p>
                </div>
              </label>
            </div>

            {/* Justificativa for Advanced */}
            {perfilHardware === 'Padrão Avançado' && (
              <div className="pt-2">
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Justificativa Técnica para Perfil Avançado <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={2}
                  value={justificativaHardware}
                  onChange={(e) => setJustificativaHardware(e.target.value)}
                  placeholder="Especifique o motivo técnico (ex: desenvolvimento com Docker, compilações pesadas, renderização)"
                  className={`w-full bg-slate-950 border ${
                    errors.justificativaHardware ? 'border-rose-500 ring-1 ring-rose-500/50' : 'border-slate-800 focus:border-indigo-500'
                  } rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition`}
                />
                {errors.justificativaHardware && (
                  <p className="text-xs text-rose-400 mt-1">{errors.justificativaHardware}</p>
                )}
              </div>
            )}
          </div>

          {/* Periféricos */}
          <div className="pt-2 border-t border-slate-800/80 space-y-2">
            <label className="block text-xs font-medium text-slate-300">Periféricos Adicionais Solicitados</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={monitor}
                  onChange={(e) => setMonitor(e.target.checked)}
                  className="rounded border-slate-700 text-blue-600 focus:ring-blue-500"
                />
                <span>Monitor Adicional</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tecladoMouse}
                  onChange={(e) => setTecladoMouse(e.target.checked)}
                  className="rounded border-slate-700 text-blue-600 focus:ring-blue-500"
                />
                <span>Kit Teclado + Mouse</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={headset}
                  onChange={(e) => setHeadset(e.target.checked)}
                  className="rounded border-slate-700 text-blue-600 focus:ring-blue-500"
                />
                <span>Headset USB / P3</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={suporteErgonomico}
                  onChange={(e) => setSuporteErgonomico(e.target.checked)}
                  className="rounded border-slate-700 text-blue-600 focus:ring-blue-500"
                />
                <span>Suporte Notebook</span>
              </label>
            </div>
          </div>

          {/* Telefonia */}
          <div className="pt-2 border-t border-slate-800/80 space-y-2">
            <label className="block text-xs font-medium text-slate-300">Linha & Telefonia Móvel Corporativa</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={simCard}
                  onChange={(e) => setSimCard(e.target.checked)}
                  className="rounded border-slate-700 text-blue-600 focus:ring-blue-500"
                />
                <span>SIM Card / eSIM Corporativo</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={smartphone}
                  onChange={(e) => setSmartphone(e.target.checked)}
                  className="rounded border-slate-700 text-blue-600 focus:ring-blue-500"
                />
                <span>Smartphone Corporativo</span>
              </label>
            </div>
          </div>
        </section>

        {/* SECTION 3: Acessos e Sistemas Administrativos */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-slate-200 font-semibold text-sm">
            <Server className="w-4 h-4 text-purple-400" />
            <span>3. Acessos e Sistemas Administrativos (Software & Cloud)</span>
          </div>

          {/* Copiar Acessos De */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Perfil de Acesso de Referência (Copiar acessos de colaborador modelo)
            </label>
            <input
              type="text"
              value={copiarAcessosDe}
              onChange={(e) => setCopiarAcessosDe(e.target.value)}
              placeholder="Ex: Renato Oliveira (Analista Senior)"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-purple-500 focus:outline-none transition"
            />
          </div>

          {/* Plataforma Base */}
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <label className="block text-xs font-medium text-slate-300">Plataforma de Produtividade Base (M365 / Workspace)</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={office365}
                  onChange={(e) => setOffice365(e.target.checked)}
                  className="rounded border-slate-700 text-purple-600 focus:ring-purple-500"
                />
                <span>E-mail & M365/Office</span>
              </label>
              <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={teamsSlack}
                  onChange={(e) => setTeamsSlack(e.target.checked)}
                  className="rounded border-slate-700 text-purple-600 focus:ring-purple-500"
                />
                <span>Microsoft Teams / Slack</span>
              </label>
              <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={gerenciadorSenhas}
                  onChange={(e) => setGerenciadorSenhas(e.target.checked)}
                  className="rounded border-slate-700 text-purple-600 focus:ring-purple-500"
                />
                <span>Gerenciador de Senhas</span>
              </label>
            </div>
          </div>

          {/* Sistemas Específicos */}
          <div className="space-y-3 pt-2 border-t border-slate-800/80">
            <label className="block text-xs font-medium text-slate-300">Sistemas Específicos do Departamento</label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {/* ERP */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <label className="flex items-center gap-2 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={erp}
                    onChange={(e) => setErp(e.target.checked)}
                    className="rounded border-slate-700 text-purple-600 focus:ring-purple-500"
                  />
                  <span>ERP / Financeiro</span>
                </label>
                {erp && (
                  <input
                    type="text"
                    value={erpDetalhe}
                    onChange={(e) => setErpDetalhe(e.target.value)}
                    placeholder="Especifique módulo / perfil (ex: Contas a Pagar)"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none"
                  />
                )}
              </div>

              {/* CRM */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <label className="flex items-center gap-2 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={crm}
                    onChange={(e) => setCrm(e.target.checked)}
                    className="rounded border-slate-700 text-purple-600 focus:ring-purple-500"
                  />
                  <span>CRM / Vendas</span>
                </label>
                {crm && (
                  <input
                    type="text"
                    value={crmDetalhe}
                    onChange={(e) => setCrmDetalhe(e.target.value)}
                    placeholder="Especifique licença (ex: Salesforce Enterprise)"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none"
                  />
                )}
              </div>

              {/* Power BI */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <label className="font-medium block text-slate-300">Power BI / Looker</label>
                <select
                  value={powerBi}
                  onChange={(e) => setPowerBi(e.target.value as PowerBiRole)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none"
                >
                  <option value="Nenhum">Nenhum Acesso</option>
                  <option value="Visualizador">Visualizador (Viewer)</option>
                  <option value="Criador">Criador / Pro License</option>
                </select>
              </div>

              {/* Pastas Drive */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <label className="flex items-center gap-2 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pastasCompartilhadas}
                    onChange={(e) => setPastasCompartilhadas(e.target.checked)}
                    className="rounded border-slate-700 text-purple-600 focus:ring-purple-500"
                  />
                  <span>Pastas Compartilhadas (Drive/SharePoint)</span>
                </label>
                {pastasCompartilhadas && (
                  <input
                    type="text"
                    value={pastasDetalhe}
                    onChange={(e) => setPastasDetalhe(e.target.value)}
                    placeholder="Ex: SharePoint/Financeiro, Drive/Engenharia"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none"
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
              <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={vpn}
                  onChange={(e) => setVpn(e.target.checked)}
                  className="rounded border-slate-700 text-purple-600 focus:ring-purple-500"
                />
                <span>Acesso VPN Corporativa</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={assinaturaDigital}
                  onChange={(e) => setAssinaturaDigital(e.target.checked)}
                  className="rounded border-slate-700 text-purple-600 focus:ring-purple-500"
                />
                <span>Assinatura Digital de Documentos</span>
              </label>
            </div>
          </div>
        </section>

        {/* SECTION 4: Acesso Físico */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-slate-200 font-semibold text-sm">
            <Building2 className="w-4 h-4 text-amber-400" />
            <span>4. Acesso Físico e Crachá Corporativo</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Unidade / Sede de Alocação</label>
              <select
                value={unidade}
                onChange={(e) => setUnidade(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:border-amber-500 focus:outline-none transition"
              >
                {units.map((u) => (
                  <option key={u.id} value={u.name}>{u.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Necessita Crachá Físico / Liberação de Catraca?
              </label>
              <div className="flex items-center gap-4 mt-2">
                <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="radio"
                    name="necessitaCracha"
                    checked={necessitaCracha === true}
                    onChange={() => setNecessitaCracha(true)}
                    className="text-amber-500 focus:ring-amber-500"
                  />
                  <span>Sim (Solicitar Crachá)</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="radio"
                    name="necessitaCracha"
                    checked={necessitaCracha === false}
                    onChange={() => setNecessitaCracha(false)}
                    className="text-amber-500 focus:ring-amber-500"
                  />
                  <span>Não</span>
                </label>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 5: Aviso de Privacidade LGPD */}
        <section className="bg-slate-950 border border-slate-800/80 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-slate-300 font-semibold text-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Aviso de Privacidade & Tratamento de Dados (LGPD)</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 leading-relaxed font-mono">
            "Os dados cadastrais informados acima serão tratados pela equipe de Tecnologia da Informação com a finalidade exclusiva de provisionamento de credenciais corporativas, acessos a sistemas e logística de entrega de patrimônio de trabalho, fundamentado no Art. 7º, incisos II e V da Lei nº 13.709/2018 (LGPD). Os registros de concessão de acessos serão mantidos em log de auditoria para conformidade e segurança da informação."
          </div>

          <label className="flex items-start gap-3 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={lgpdAceito}
              onChange={(e) => {
                setLgpdAceito(e.target.checked);
                if (errors.lgpdAceito) {
                  setErrors((prev) => ({ ...prev, lgpdAceito: '' }));
                }
              }}
              className="mt-0.5 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 shrink-0"
            />
            <span className="text-xs text-slate-300 font-medium leading-normal">
              Concordo e confirmo a exatidão das informações fornecidas para fins de provisionamento de TI nos termos da LGPD. <span className="text-rose-400">*</span>
            </span>
          </label>
          {errors.lgpdAceito && <p className="text-xs text-rose-400">{errors.lgpdAceito}</p>}
        </section>

        {/* Form Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition"
          >
            Cancelar
          </button>
          <button
            id="btn-submit-onboarding"
            type="submit"
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/25 transition active:scale-[0.99]"
          >
            <UserPlus className="w-4 h-4" />
            <span>Enviar Solicitação de Onboarding</span>
          </button>
        </div>
      </form>
    </div>
  );
};
