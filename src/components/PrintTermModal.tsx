import React from 'react';
import { Ticket } from '../types';
import { formatDateToBR, formatDateTimeToBR } from '../utils/formatters';
import { X, Printer, ShieldCheck, Cpu } from 'lucide-react';

interface PrintTermModalProps {
  ticket: Ticket;
  onClose: () => void;
}

export const PrintTermModal: React.FC<PrintTermModalProps> = ({ ticket, onClose }) => {
  const isOnboarding = ticket.type === 'onboarding';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white text-slate-900 rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto border border-slate-300">
        {/* Printable Toolbar (Hidden on print) */}
        <div className="p-4 bg-slate-100 border-b border-slate-300 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2 font-semibold text-xs text-slate-700">
            <Printer className="w-4 h-4 text-blue-600" />
            <span>Visualização de Impressão de Termo LGPD / Patrimônio</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / Salvar PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-8 sm:p-12 overflow-y-auto space-y-6 text-xs text-slate-800 leading-relaxed font-sans print:p-0 print:overflow-visible">
          {/* Document Header */}
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold">
                <Cpu className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-base font-bold uppercase tracking-wider text-slate-900">
                  DEPARTAMENTO DE TECNOLOGIA DA INFORMAÇÃO
                </h1>
                <p className="text-[11px] text-slate-600 font-medium">
                  {isOnboarding ? 'Termo de Responsabilidade, Patrimônio & Acessos' : 'Termo de Revogação de Acessos & Devolução de Ativos'}
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="block font-mono font-bold text-sm text-blue-900">{ticket.id}</span>
              <span className="block text-[10px] text-slate-500">
                Emissão: {formatDateToBR(new Date().toISOString())}
              </span>
            </div>
          </div>

          {/* Identification Box */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <h2 className="font-bold text-xs uppercase text-slate-900 tracking-wide border-b border-slate-200 pb-1">
              1. Identificação do Colaborador
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <span className="text-[10px] font-semibold text-slate-500 block">NOME COMPLETO:</span>
                <span className="font-bold text-slate-900 text-sm">{ticket.nomeCompleto}</span>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-500 block">
                  {isOnboarding ? 'CPF:' : 'E-MAIL CORPORATIVO:'}
                </span>
                <span className="font-mono text-slate-900">
                  {isOnboarding ? (ticket as any).cpf : (ticket as any).emailCorporativo}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-500 block">GESTOR RESPONSÁVEL:</span>
                <span className="text-slate-900">{ticket.gestor}</span>
              </div>
              {isOnboarding && (
                <>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 block">CARGO / SETOR:</span>
                    <span className="text-slate-900">
                      {(ticket as any).cargo} ({(ticket as any).departamento})
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 block">DATA DE INÍCIO:</span>
                    <span className="font-semibold text-slate-900">
                      {formatDateToBR((ticket as any).dataInicio)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 block">MODALIDADE:</span>
                    <span className="text-slate-900">{(ticket as any).modalidade}</span>
                  </div>
                </>
              )}
              {!isOnboarding && (
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 block">DATA/HORA DESLIGAMENTO:</span>
                  <span className="font-semibold text-slate-900">
                    {formatDateTimeToBR((ticket as any).dataHoraDesligamento)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Details Section */}
          <div className="space-y-3">
            <h2 className="font-bold text-xs uppercase text-slate-900 tracking-wide border-b border-slate-200 pb-1">
              2. Especificação de Equipamentos & Sistemas
            </h2>

            {isOnboarding ? (
              <div className="space-y-2 text-xs">
                <p>
                  <strong>Hardware Alocado:</strong> {(ticket as any).perfilHardware}
                </p>
                {(ticket as any).justificativaHardware && (
                  <p className="text-[11px] text-slate-600">
                    <em>Justificativa:</em> {(ticket as any).justificativaHardware}
                  </p>
                )}
                <p>
                  <strong>Acessos e Licenças Solicitadas:</strong> Microsoft 365, Teams, Gerenciador de Senhas, Power BI ({(ticket as any).sistemasEspecificos?.powerBi || 'Nenhum'}).
                </p>
              </div>
            ) : (
              <div className="space-y-2 text-xs">
                <p>
                  <strong>Ativos Pertencentes à Empresa a Devolver:</strong> Notebook (
                  {(ticket as any).ativos?.codigoPatrimonioNotebook || 'PAT-ID'}), Periféricos, Crachá Físico.
                </p>
                <p>
                  <strong>Destino das Informações:</strong> E-mails redirecionados para {(ticket as any).emailDestinoRedirecionamento || ticket.gestor}. Arquivos transferidos para a custódia do gestor direto.
                </p>
              </div>
            )}
          </div>

          {/* Official Terms Clause */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-[11px] text-slate-700 leading-relaxed">
            <h2 className="font-bold text-xs uppercase text-slate-900 tracking-wide border-b border-slate-200 pb-1 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              3. Cláusula de Responsabilidade e Termo de Privacidade LGPD
            </h2>
            <p>
              O presente termo formaliza que as informações cadastrais e registros operacionais coletados acima são tratados com a finalidade exclusiva de provisionamento e revogação de acessos corporativos, guarda de equipamentos de TI e logística patrimonial, em estrita conformidade com o <strong>Art. 7º, incisos II e V da Lei nº 13.709/2018 (Lei Geral de Proteção de Dados - LGPD)</strong>.
            </p>
            <p>
              O colaborador compromete-se a zelar pelo uso exclusivo corporativo dos equipamentos fornecidos, manter sigilo de suas credenciais de acesso atribuídas no Microsoft Entra ID e não armazenar arquivos de cunho estritamente pessoal no patrimônio da empresa.
            </p>
          </div>

          {/* Signature Block */}
          <div className="pt-12 grid grid-cols-2 gap-8 text-center text-xs">
            <div className="space-y-1">
              <div className="border-b border-slate-400 w-full mb-1"></div>
              <span className="font-bold block text-slate-900">{ticket.nomeCompleto}</span>
              <span className="text-[10px] text-slate-500 block">Assinatura do Colaborador</span>
            </div>

            <div className="space-y-1">
              <div className="border-b border-slate-400 w-full mb-1"></div>
              <span className="font-bold block text-slate-900">{ticket.gestor} / TI Responsável</span>
              <span className="text-[10px] text-slate-500 block">Gestão de Tecnologia & Segurança</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
