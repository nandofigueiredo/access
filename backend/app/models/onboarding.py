import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import ticket_status_enum


class OnboardingRequest(Base):
    __tablename__ = "onboarding_requests"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    status: Mapped[str] = mapped_column(ticket_status_enum, nullable=False, default="Pendente TI")
    employee_name: Mapped[str] = mapped_column(String(255), nullable=False)
    cpf: Mapped[str] = mapped_column(String(14), nullable=False)
    personal_email: Mapped[str] = mapped_column(String(320), nullable=False)
    position: Mapped[str] = mapped_column(String(255), nullable=False)
    department: Mapped[str] = mapped_column(String(128), nullable=False)
    manager: Mapped[str] = mapped_column(String(255), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    work_mode: Mapped[str] = mapped_column(String(32), nullable=False)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    hardware_profile: Mapped[str] = mapped_column(String(64), nullable=False)
    peripherals: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    systems_access: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    requires_badge: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    unit_location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    lgpd_accepted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    it_checklist: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    it_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    workflow: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    requester_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    assigned_queue: Mapped[str | None] = mapped_column(String(128), nullable=True)
    glpi_ticket_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    creator = relationship("User", back_populates="onboarding_requests", lazy="selectin")
