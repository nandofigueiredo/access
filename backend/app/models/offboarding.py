import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import ticket_status_enum


class OffboardingRequest(Base):
    __tablename__ = "offboarding_requests"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    status: Mapped[str] = mapped_column(ticket_status_enum, nullable=False, default="Pendente TI")
    employee_name: Mapped[str] = mapped_column(String(255), nullable=False)
    corp_email: Mapped[str] = mapped_column(String(320), nullable=False)
    manager: Mapped[str] = mapped_column(String(255), nullable=False)
    termination_datetime: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    email_forward_to: Mapped[str | None] = mapped_column(String(320), nullable=True)
    cloud_transfer_to: Mapped[str | None] = mapped_column(String(320), nullable=True)
    auto_reply: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    redirect_email: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    transfer_files: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    guided_no_personal_files: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    hardware_assets: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    return_method: Mapped[str] = mapped_column(String(32), nullable=False)
    return_deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    it_checklist: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    it_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    workflow: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    requester_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    assigned_queue: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    creator = relationship("User", back_populates="offboarding_requests")
