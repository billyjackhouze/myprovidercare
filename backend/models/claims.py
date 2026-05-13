import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, ForeignKey, Integer, Text, DateTime, Numeric
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from models.base import Base, TimestampMixin, UUIDPrimaryKey


class Claim(Base, UUIDPrimaryKey, TimestampMixin):
    """837P billing claim, submitted via Office Ally EDI clearinghouse."""
    __tablename__ = "claims"

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    visit_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("visits.id", ondelete="SET NULL")
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False
    )
    authorization_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("authorizations.id", ondelete="SET NULL")
    )
    billing_cm_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    service_date: Mapped[str | None] = mapped_column(String(10))
    service_code: Mapped[str | None] = mapped_column(String(50))
    modifiers: Mapped[list] = mapped_column(JSONB, default=list)
    units: Mapped[int | None] = mapped_column(Integer)
    charge_amount: Mapped[float | None] = mapped_column(Numeric(10, 2))
    rendering_npi: Mapped[str | None] = mapped_column(String(20))
    place_of_service: Mapped[str] = mapped_column(String(10), default="12")
    diagnosis_pointers: Mapped[list] = mapped_column(JSONB, default=list)
    # Office Ally tracking
    oa_claim_id: Mapped[str | None] = mapped_column(String(100))
    oa_submission_batch: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(50), default="pending")
    denial_code: Mapped[str | None] = mapped_column(String(100))
    denial_reason: Mapped[str | None] = mapped_column(Text)
    paid_amount: Mapped[float | None] = mapped_column(Numeric(10, 2))
    paid_date: Mapped[str | None] = mapped_column(String(10))
    era_835_data: Mapped[dict] = mapped_column(JSONB, default=dict)
    raw_edi: Mapped[str | None] = mapped_column(Text)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    client = relationship("Client")
