import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import user_role_enum


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)
    role: Mapped[str] = mapped_column(user_role_enum, nullable=False, default="viewer")
    entra_oid: Mapped[str | None] = mapped_column(String(64), nullable=True)
    job_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    department: Mapped[str | None] = mapped_column(String(128), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # viewonly + raise: async-safe (sem backref sync / sem lazy IO implícito)
    onboarding_requests = relationship(
        "OnboardingRequest",
        foreign_keys="OnboardingRequest.created_by",
        lazy="raise",
        viewonly=True,
    )
    offboarding_requests = relationship(
        "OffboardingRequest",
        foreign_keys="OffboardingRequest.created_by",
        lazy="raise",
        viewonly=True,
    )
    audit_logs = relationship(
        "AuditLog",
        foreign_keys="AuditLog.performed_by_user_id",
        lazy="raise",
        viewonly=True,
    )
