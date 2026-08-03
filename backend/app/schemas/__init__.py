from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

TicketStatus = Literal[
    "Pendente TI",
    "Em Andamento",
    "Aguardando N3",
    "Pronta p/ Fechamento",
    "Concluído",
]
WorkMode = Literal["Presencial", "Híbrido", "Remoto"]
HardwareProfile = Literal["Padrão Admin", "Padrão Avançado"]
PowerBiRole = Literal["Visualizador", "Criador", "Nenhum"]
ReturnMethod = Literal["Presencial", "Correios"]


class PeripheralsIn(BaseModel):
    monitor: bool = True
    tecladoMouse: bool = True
    headset: bool = True
    suporteErgonomico: bool = False


class TelephonyIn(BaseModel):
    simCard: bool = False
    smartphone: bool = False


class PlatformBaseIn(BaseModel):
    office365: bool = True
    teamsSlack: bool = True
    gerenciadorSenhas: bool = True


class SpecificSystemsIn(BaseModel):
    erp: bool = False
    erpDetalhe: str | None = None
    crm: bool = False
    crmDetalhe: str | None = None
    powerBi: PowerBiRole = "Visualizador"
    pastasCompartilhadas: bool = True
    pastasDetalhe: str | None = None
    vpn: bool = False
    assinaturaDigital: bool = False


class OnboardingChecklistIn(BaseModel):
    hardwareProvisionado: bool = False
    contaEntraIdCriada: bool = False
    sistemasLiberados: bool = False
    crachaSolicitado: bool = False
    termoEnviado: bool = False


class OnboardingCreate(BaseModel):
    """Payload alinhado ao OnboardingData do frontend (sem id/status gerados)."""

    nomeCompleto: str = Field(..., min_length=2, max_length=255)
    cpf: str
    emailPessoal: EmailStr
    cargo: str = Field(..., min_length=2, max_length=255)
    departamento: str = Field(..., min_length=1, max_length=128)
    gestor: str = Field(..., min_length=2, max_length=255)
    dataInicio: date
    modalidade: WorkMode
    enderecoEntrega: str | None = None
    perfilHardware: HardwareProfile
    justificativaHardware: str | None = None
    perifericos: PeripheralsIn
    telefonia: TelephonyIn = Field(default_factory=TelephonyIn)
    copiarAcessosDe: str | None = None
    plataformaBase: PlatformBaseIn = Field(default_factory=PlatformBaseIn)
    sistemasEspecificos: SpecificSystemsIn = Field(default_factory=SpecificSystemsIn)
    unidade: str = "Sede Principal"
    necessitaCracha: bool = False
    lgpdAceito: bool = False
    workflow: dict[str, Any] | None = None
    requesterEmail: EmailStr | None = None
    assignedQueue: str | None = None

    @field_validator("lgpdAceito")
    @classmethod
    def require_lgpd(cls, v: bool) -> bool:
        if not v:
            raise ValueError("É obrigatório aceitar os termos da LGPD.")
        return v


class OnboardingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    type: Literal["onboarding"] = "onboarding"
    status: TicketStatus
    createdAt: datetime
    updatedAt: datetime
    createdBy: str
    nomeCompleto: str
    cpf: str
    emailPessoal: str
    cargo: str
    departamento: str
    gestor: str
    dataInicio: date
    modalidade: str
    enderecoEntrega: str | None = None
    perfilHardware: str
    justificativaHardware: str | None = None
    perifericos: dict[str, Any]
    telefonia: dict[str, Any]
    copiarAcessosDe: str | None = None
    plataformaBase: dict[str, Any]
    sistemasEspecificos: dict[str, Any]
    unidade: str | None = None
    necessitaCracha: bool
    lgpdAceito: bool
    itChecklist: dict[str, Any] | None = None
    itNotes: str | None = None
    workflow: dict[str, Any] | None = None
    requesterEmail: str | None = None
    assignedQueue: str | None = None


class OffboardingAssetsIn(BaseModel):
    notebook: bool = False
    codigoPatrimonioNotebook: str | None = None
    perifericos: bool = False
    smartphone: bool = False
    cracha: bool = False


class OffboardingChecklistIn(BaseModel):
    bloqueioIdP: bool = False
    encerramentoSessoes: bool = False
    desvinculacaoLicencas: bool = False
    remocaoGruposEmail: bool = False
    limpezaWipeMDM: bool = False
    registroLogsAuditoria: bool = False


class OffboardingCreate(BaseModel):
    nomeCompleto: str = Field(..., min_length=2, max_length=255)
    emailCorporativo: EmailStr
    gestor: str = Field(..., min_length=2, max_length=255)
    dataHoraDesligamento: datetime
    redirecionamentoEmail: bool = False
    emailDestinoRedirecionamento: EmailStr | None = None
    transferenciaArquivos: bool = False
    emailDestinoArquivos: EmailStr | None = None
    respostaAutomaticaAusencia: bool = False
    orientadoNaoManterArquivosPessoais: bool = False
    ativos: OffboardingAssetsIn
    modalidadeDevolucao: ReturnMethod
    prazoLimiteDevolucao: date
    workflow: dict[str, Any] | None = None
    requesterEmail: EmailStr | None = None
    assignedQueue: str | None = None


class OffboardingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    type: Literal["offboarding"] = "offboarding"
    status: TicketStatus
    createdAt: datetime
    updatedAt: datetime
    createdBy: str
    nomeCompleto: str
    emailCorporativo: str
    gestor: str
    dataHoraDesligamento: datetime
    redirecionamentoEmail: bool
    emailDestinoRedirecionamento: str | None = None
    transferenciaArquivos: bool
    emailDestinoArquivos: str | None = None
    respostaAutomaticaAusencia: bool
    orientadoNaoManterArquivosPessoais: bool
    ativos: dict[str, Any]
    modalidadeDevolucao: str
    prazoLimiteDevolucao: date | None = None
    itChecklist: dict[str, Any]
    itNotes: str | None = None
    workflow: dict[str, Any] | None = None
    requesterEmail: str | None = None
    assignedQueue: str | None = None


class StatusUpdate(BaseModel):
    status: TicketStatus
    itNotes: str | None = None
    itChecklist: dict[str, Any] | None = None
    workflow: dict[str, Any] | None = None
    requesterEmail: str | None = None
    assignedQueue: str | None = None


class StatusUpdateOut(BaseModel):
    id: str
    type: Literal["onboarding", "offboarding"]
    status: TicketStatus
    updatedAt: datetime
    itNotes: str | None = None
    itChecklist: dict[str, Any] | None = None
    workflow: dict[str, Any] | None = None
    requesterEmail: str | None = None
    assignedQueue: str | None = None


class UserMeOut(BaseModel):
    id: UUID
    name: str
    email: str
    role: str
    jobTitle: str | None = None
    department: str | None = None
    isAuthenticated: bool = True
    isDemo: bool = False
    tenantId: str | None = None


class AuditLogOut(BaseModel):
    id: UUID
    action: str
    targetRequestId: str | None = None
    performedBy: str | None = None
    timestamp: datetime
    details: dict[str, Any] = Field(default_factory=dict)


class SettingsOut(BaseModel):
    key: str
    value: dict[str, Any]
    updatedAt: datetime | None = None


class SettingsUpdate(BaseModel):
    value: dict[str, Any]


class MessageOut(BaseModel):
    detail: str
