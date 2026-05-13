import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, ForeignKey, Integer, Text, DateTime, Numeric
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from geoalchemy2 import Geometry
from models.base import Base, TimestampMixin, UUIDPrimaryKey


class ScheduledVisit(Base, UUIDPrimaryKey, TimestampMixin):
    __tablename__ = "scheduled_visits"

    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    cm_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    authorization_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("authorizations.id", ondelete="SET NULL"))
    scheduled_date: Mapped[str] = mapped_column(String(20), nullable=False)  # YYYY-MM-DD
    scheduled_start_time: Mapped[str | None] = mapped_column(String(10))     # HH:MM
    scheduled_end_time: Mapped[str | None] = mapped_column(String(10))
    service_code: Mapped[str | None] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(50), default="scheduled")
    recurrence_rule: Mapped[str | None] = mapped_column(String(255))
    notes: Mapped[str | None] = mapped_column(Text)

    client = relationship("Client", back_populates="scheduled_visits")
    cm = relationship("User", foreign_keys=[cm_id])
    visits = relationship("Visit", back_populates="scheduled_visit", lazy="dynamic")


class Visit(Base, UUIDPrimaryKey, TimestampMixin):
    """
    Core billing/compliance record.
    CLOCK START = hipaa_signed_at  (client signs HIPAA consent on CM's device)
    CLOCK STOP  = photo_taken_at   (CM takes live camera photo)
    face_to_face_minutes is a GENERATED column in Postgres — read-only here.
    """
    __tablename__ = "visits"

    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    scheduled_visit_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("scheduled_visits.id", ondelete="SET NULL"))
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    cm_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    device_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("devices.id", ondelete="SET NULL"))
    authorization_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("authorizations.id", ondelete="SET NULL"))
    service_code: Mapped[str | None] = mapped_column(String(50))

    # ── CLOCK START: HIPAA signature ─────────────────────────────────────────
    hipaa_signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    hipaa_gps = mapped_column(Geometry("POINT", srid=4326))
    hipaa_inside_geofence: Mapped[bool | None] = mapped_column(Boolean)
    hipaa_signature_s3_key: Mapped[str | None] = mapped_column(String(500))

    # ── CLOCK STOP: live camera photo ────────────────────────────────────────
    photo_taken_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    photo_gps = mapped_column(Geometry("POINT", srid=4326))
    photo_inside_geofence: Mapped[bool | None] = mapped_column(Boolean)
    photo_s3_key: Mapped[str | None] = mapped_column(String(500))
    photo_exif_metadata: Mapped[dict] = mapped_column(JSONB, default=dict)
    photo_tamper_flag: Mapped[bool] = mapped_column(Boolean, default=False)
    photo_outside_reason: Mapped[str | None] = mapped_column(Text)

    # ── Geofence arrival ─────────────────────────────────────────────────────
    arrived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    arrival_gps = mapped_column(Geometry("POINT", srid=4326))

    # ── Billing ───────────────────────────────────────────────────────────────
    # face_to_face_minutes is a GENERATED column in the DB — not settable here
    status: Mapped[str] = mapped_column(String(50), default="in_progress")
    is_flagged: Mapped[bool] = mapped_column(Boolean, default=False)
    flag_reasons: Mapped[list] = mapped_column(JSONB, default=list)
    supervisor_reviewed: Mapped[bool] = mapped_column(Boolean, default=False)
    supervisor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    supervisor_notes: Mapped[str | None] = mapped_column(Text)
    approved_for_billing: Mapped[bool] = mapped_column(Boolean, default=False)
    approved_for_payroll: Mapped[bool] = mapped_column(Boolean, default=False)
    mileage_total: Mapped[float | None] = mapped_column(Numeric(8, 2))
    fm_record_id: Mapped[str | None] = mapped_column(String(100))

    # relationships
    scheduled_visit = relationship("ScheduledVisit", back_populates="visits")
    client = relationship("Client")
    cm = relationship("User", foreign_keys=[cm_id])
    supervisor = relationship("User", foreign_keys=[supervisor_id])
    tasks = relationship("VisitTask", back_populates="visit", lazy="dynamic")
    progress_notes = relationship("ProgressNote", back_populates="visit", lazy="dynamic")


class VisitTask(Base, UUIDPrimaryKey, TimestampMixin):
    """Transport / errand tasks recorded when CM leaves geofence mid-visit."""
    __tablename__ = "visit_tasks"

    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    visit_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("visits.id", ondelete="CASCADE"), nullable=False)
    task_type: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    start_location = mapped_column(Geometry("POINT", srid=4326))
    end_location = mapped_column(Geometry("POINT", srid=4326))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    mileage: Mapped[float | None] = mapped_column(Numeric(8, 2))
    waypoints: Mapped[list] = mapped_column(JSONB, default=list)

    visit = relationship("Visit", back_populates="tasks")


class DevicePing(Base, UUIDPrimaryKey):
    """GPS heartbeat — table is RANGE-partitioned by pinged_at in Postgres."""
    __tablename__ = "device_pings"

    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    device_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("devices.id", ondelete="SET NULL"))
    visit_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("visits.id", ondelete="SET NULL"))
    location = mapped_column(Geometry("POINT", srid=4326), nullable=False)
    accuracy_m: Mapped[float | None] = mapped_column(Numeric(8, 2))
    battery_pct: Mapped[int | None] = mapped_column(Integer)
    pinged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class ProgressNote(Base, UUIDPrimaryKey, TimestampMixin):
    __tablename__ = "progress_notes"

    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    visit_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("visits.id", ondelete="CASCADE"), nullable=False)
    cm_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    note_text: Mapped[str | None] = mapped_column(Text)
    voice_transcript_raw: Mapped[str | None] = mapped_column(Text)
    ai_polished_text: Mapped[str | None] = mapped_column(Text)
    ai_gap_analysis: Mapped[dict] = mapped_column(JSONB, default=dict)
    prior_note_ids: Mapped[list] = mapped_column(JSONB, default=list)
    is_final: Mapped[bool] = mapped_column(Boolean, default=False)
    finalized_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    supervisor_approved: Mapped[bool] = mapped_column(Boolean, default=False)
    version: Mapped[int] = mapped_column(Integer, default=1)

    visit = relationship("Visit", back_populates="progress_notes")
    cm = relationship("User", foreign_keys=[cm_id])
