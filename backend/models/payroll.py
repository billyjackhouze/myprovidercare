import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, ForeignKey, Integer, Text, DateTime, Numeric
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from models.base import Base, TimestampMixin, UUIDPrimaryKey


class PayrollPeriod(Base, UUIDPrimaryKey, TimestampMixin):
    """ADP pay period batch — collects approved visit hours for submission."""
    __tablename__ = "payroll_periods"

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    period_start: Mapped[str] = mapped_column(String(10), nullable=False)  # YYYY-MM-DD
    period_end: Mapped[str] = mapped_column(String(10), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="open")
    adp_batch_id: Mapped[str | None] = mapped_column(String(100))
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    submitted_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    adp_response: Mapped[dict] = mapped_column(JSONB, default=dict)
    notes: Mapped[str | None] = mapped_column(Text)

    line_items = relationship("PayrollLineItem", back_populates="period", lazy="dynamic")


class PayrollLineItem(Base, UUIDPrimaryKey, TimestampMixin):
    """One line per CM per earnings code in a payroll period."""
    __tablename__ = "payroll_line_items"

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    period_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("payroll_periods.id", ondelete="CASCADE"), nullable=False
    )
    cm_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    adp_associate_id: Mapped[str | None] = mapped_column(String(100))
    earnings_code: Mapped[str] = mapped_column(String(50), nullable=False)
    hours: Mapped[float | None] = mapped_column(Numeric(8, 2))
    mileage: Mapped[float | None] = mapped_column(Numeric(8, 2))
    source_visit_ids: Mapped[list] = mapped_column(JSONB, default=list)
    is_approved: Mapped[bool] = mapped_column(Boolean, default=False)
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )

    period = relationship("PayrollPeriod", back_populates="line_items")
    cm = relationship("User", foreign_keys=[cm_id])
