import uuid
from sqlalchemy import String, Boolean, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from models.base import Base, TimestampMixin, UUIDPrimaryKey

VALID_ROLES = ("developer", "admin", "owner", "supervisor", "case_manager", "billing", "intake", "auditor", "staff")


class User(Base, UUIDPrimaryKey, TimestampMixin):
    __tablename__ = "users"

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False)  # see VALID_ROLES
    npi: Mapped[str | None] = mapped_column(String(20))
    supervisor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    adp_associate_id: Mapped[str | None] = mapped_column(String(100))
    adp_earnings_code_regular: Mapped[str | None] = mapped_column(String(50))
    adp_earnings_code_transport: Mapped[str | None] = mapped_column(String(50))
    phone: Mapped[str | None] = mapped_column(String(20))
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    mfa_secret: Mapped[str | None] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login_at: Mapped[str | None] = mapped_column(DateTime(timezone=True))
    profile_settings: Mapped[dict] = mapped_column(JSONB, default=dict)

    # relationships
    organization = relationship("Organization", back_populates="users")
    supervisor = relationship("User", remote_side="User.id", foreign_keys=[supervisor_id])
    devices = relationship("Device", back_populates="user", lazy="dynamic")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"


class Device(Base, UUIDPrimaryKey, TimestampMixin):
    __tablename__ = "devices"

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    device_name: Mapped[str | None] = mapped_column(String(255))
    device_type: Mapped[str | None] = mapped_column(String(50))  # ios, android, web
    push_token: Mapped[str | None] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_seen_at: Mapped[str | None] = mapped_column(DateTime(timezone=True))

    user = relationship("User", back_populates="devices")
