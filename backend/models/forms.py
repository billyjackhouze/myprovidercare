"""
Forms Engine Models
-------------------
Supports AI-powered ingestion of paper forms (screenshots / PDFs).
Each org can define its own forms (multi-tenant SaaS).
Workflow: Form → Sections → Fields → Submissions
"""
import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, ForeignKey, Integer, Text, DateTime, Numeric
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from geoalchemy2 import Geometry
from models.base import Base, TimestampMixin, UUIDPrimaryKey

FIELD_TYPES = (
    "text", "textarea", "number", "email", "phone", "date", "time", "datetime",
    "dropdown", "radio", "checkbox", "multi_select", "boolean",
    "signature", "photo", "gps_capture", "file_upload",
    "client_name", "cm_name", "visit_date", "visit_time",
    "visit_duration", "auth_number", "service_code",
    "calculated", "hidden",
)

TRIGGER_EVENTS = (
    "visit_arrival", "visit_start", "visit_end", "manual", "scheduled",
    "supervisor_action", "client_portal", "intake", "discharge",
)


class Form(Base, UUIDPrimaryKey, TimestampMixin):
    """
    A form template. Can be created manually or by AI ingestion of a
    scanned paper form image/PDF.
    """
    __tablename__ = "forms"

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    form_type: Mapped[str | None] = mapped_column(String(100))
    version: Mapped[int] = mapped_column(Integer, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)  # built-in form

    # AI ingestion metadata
    ai_extracted: Mapped[bool] = mapped_column(Boolean, default=False)
    ai_extraction_model: Mapped[str | None] = mapped_column(String(100))
    ai_extraction_raw: Mapped[dict | None] = mapped_column(JSONB)  # full Claude response for audit
    source_file_s3_key: Mapped[str | None] = mapped_column(String(500))  # original scan
    print_template_s3_key: Mapped[str | None] = mapped_column(String(500))  # PDF template for printing

    # List-view configuration
    has_list_view: Mapped[bool] = mapped_column(Boolean, default=False)

    # Print / PDF export
    has_pdf_export: Mapped[bool] = mapped_column(Boolean, default=False)

    # Workflow configuration
    workflow_config: Mapped[dict] = mapped_column(JSONB, default=dict)

    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )

    organization = relationship("Organization", back_populates="forms")
    sections = relationship("FormSection", back_populates="form", order_by="FormSection.order_index", cascade="all, delete-orphan")
    workflows = relationship("FormWorkflow", back_populates="form", lazy="dynamic")
    submissions = relationship("FormSubmission", back_populates="form", lazy="dynamic")


class FormSection(Base, UUIDPrimaryKey, TimestampMixin):
    """Logical grouping of fields within a form (e.g. 'Client Info', 'Goals')."""
    __tablename__ = "form_sections"

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    form_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("forms.id", ondelete="CASCADE"), nullable=False
    )
    section_key: Mapped[str] = mapped_column(String(100), nullable=False)
    title: Mapped[str | None] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    is_repeating: Mapped[bool] = mapped_column(Boolean, default=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0)

    form = relationship("Form", back_populates="sections")
    fields = relationship("FormField", back_populates="section", order_by="FormField.order_index", cascade="all, delete-orphan")


class FormField(Base, UUIDPrimaryKey, TimestampMixin):
    """
    A single field extracted from a form (manually or by Claude Vision).
    print_x/y/width/height store the field's position on the original scan
    so submissions can be rendered back onto a print PDF.
    """
    __tablename__ = "form_fields"

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    form_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("forms.id", ondelete="CASCADE"), nullable=False
    )
    section_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("form_sections.id", ondelete="SET NULL")
    )
    field_key: Mapped[str] = mapped_column(String(255), nullable=False)
    label: Mapped[str] = mapped_column(String(500), nullable=False)
    field_type: Mapped[str] = mapped_column(String(50), nullable=False)  # see FIELD_TYPES
    placeholder: Mapped[str | None] = mapped_column(String(500))
    default_value: Mapped[str | None] = mapped_column(Text)
    is_required: Mapped[bool] = mapped_column(Boolean, default=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    options: Mapped[list] = mapped_column(JSONB, default=list)        # [{label, value}]
    validation: Mapped[dict] = mapped_column(JSONB, default=dict)     # {min, max, pattern, ...}
    conditional: Mapped[dict | None] = mapped_column(JSONB)           # {showIf: {field_key, op, value}}
    system_field: Mapped[str | None] = mapped_column(String(100))     # maps to visit/client column

    # AI extraction positioning on the original paper form image
    print_x: Mapped[float | None] = mapped_column(Numeric(6, 2))
    print_y: Mapped[float | None] = mapped_column(Numeric(6, 2))
    print_width: Mapped[float | None] = mapped_column(Numeric(6, 2))
    print_height: Mapped[float | None] = mapped_column(Numeric(6, 2))
    ai_confidence: Mapped[float | None] = mapped_column(Numeric(4, 2))

    section = relationship("FormSection", back_populates="fields")


class FormWorkflow(Base, UUIDPrimaryKey, TimestampMixin):
    """Links a form to the event that triggers it and defines routing."""
    __tablename__ = "form_workflows"

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    form_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("forms.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    trigger_event: Mapped[str] = mapped_column(String(100), nullable=False)  # see TRIGGER_EVENTS
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    requires_signature: Mapped[bool] = mapped_column(Boolean, default=False)
    requires_supervisor_review: Mapped[bool] = mapped_column(Boolean, default=False)
    auto_generate_pdf: Mapped[bool] = mapped_column(Boolean, default=False)
    routing_config: Mapped[dict] = mapped_column(JSONB, default=dict)
    notification_config: Mapped[dict] = mapped_column(JSONB, default=dict)

    form = relationship("Form", back_populates="workflows")


class FormSubmission(Base, UUIDPrimaryKey, TimestampMixin):
    """A completed instance of a form, linked to a visit or standalone."""
    __tablename__ = "form_submissions"

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    form_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("forms.id", ondelete="CASCADE"), nullable=False
    )
    visit_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("visits.id", ondelete="SET NULL")
    )
    client_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="SET NULL")
    )
    submitted_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    data: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    signatures: Mapped[list] = mapped_column(JSONB, default=list)
    submission_gps = mapped_column(Geometry("POINT", srid=4326))
    submission_inside_geofence: Mapped[bool | None] = mapped_column(Boolean)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(50), default="draft")
    supervisor_reviewed: Mapped[bool] = mapped_column(Boolean, default=False)
    print_pdf_s3_key: Mapped[str | None] = mapped_column(String(500))

    form = relationship("Form", back_populates="submissions")
