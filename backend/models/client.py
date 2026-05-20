import uuid
from sqlalchemy import String, Boolean, ForeignKey, Integer, Date, Text, Numeric, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from geoalchemy2 import Geometry
from models.base import Base, TimestampMixin, UUIDPrimaryKey


class Client(Base, UUIDPrimaryKey, TimestampMixin):
    __tablename__ = "clients"

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    assigned_cm_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )

    # ── Name ────────────────────────────────────────────────────────────────
    salutation: Mapped[str | None] = mapped_column(String(20))
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    middle_name: Mapped[str | None] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    suffix: Mapped[str | None] = mapped_column(String(20))

    # ── Demographics ────────────────────────────────────────────────────────
    date_of_birth: Mapped[str | None] = mapped_column(Date)
    birth_year: Mapped[int | None] = mapped_column(Integer)
    ssn: Mapped[str | None] = mapped_column(String(255))          # store encrypted
    ssn_last4: Mapped[str | None] = mapped_column(String(4))
    gender: Mapped[str | None] = mapped_column(String(50))
    gender_expression: Mapped[str | None] = mapped_column(String(50))
    gender_identifier: Mapped[str | None] = mapped_column(String(50))
    gender_orientation: Mapped[str | None] = mapped_column(String(50))
    marital_status: Mapped[str | None] = mapped_column(String(50))
    race: Mapped[str | None] = mapped_column(String(100))
    ethnicity: Mapped[str | None] = mapped_column(String(100))
    birthday_65th: Mapped[str | None] = mapped_column(Date)

    # ── Contact ─────────────────────────────────────────────────────────────
    phone: Mapped[str | None] = mapped_column(String(20))
    email: Mapped[str | None] = mapped_column(String(255))
    address_line1: Mapped[str | None] = mapped_column(String(255))
    address_line2: Mapped[str | None] = mapped_column(String(255))
    city: Mapped[str | None] = mapped_column(String(100))
    state: Mapped[str | None] = mapped_column(String(2))
    zip_code: Mapped[str | None] = mapped_column(String(10))
    county: Mapped[str | None] = mapped_column(String(100))
    sda: Mapped[str | None] = mapped_column(String(100))
    emergency_contact: Mapped[dict] = mapped_column(JSONB, default=dict)
    legal_guardian: Mapped[str | None] = mapped_column(String(255))

    # ── PostGIS geofence ─────────────────────────────────────────────────────
    geo_point = mapped_column(Geometry("POINT", srid=4326))
    geofence_radius_ft: Mapped[int] = mapped_column(Integer, default=300)

    # ── Insurance ───────────────────────────────────────────────────────────
    medicaid_id: Mapped[str | None] = mapped_column(String(50))
    medicare_id: Mapped[str | None] = mapped_column(String(100))
    subscriber_id: Mapped[str | None] = mapped_column(String(100))
    ins_vendor: Mapped[str | None] = mapped_column(String(255))
    psych_name: Mapped[str | None] = mapped_column(String(255))
    pcp_name: Mapped[str | None] = mapped_column(String(255))
    primary_care_physician: Mapped[str | None] = mapped_column(String(255))
    psychiatric_provider: Mapped[str | None] = mapped_column(String(255))
    payer_info: Mapped[dict] = mapped_column(JSONB, default=dict)

    # ── LAI ─────────────────────────────────────────────────────────────────
    on_a_lai: Mapped[bool] = mapped_column(Boolean, default=False)
    lai_medication: Mapped[str | None] = mapped_column(String(255))
    injection_dates: Mapped[str | None] = mapped_column(Text)

    # ── Clinical ────────────────────────────────────────────────────────────
    diagnosis_codes: Mapped[list] = mapped_column(JSONB, default=list)
    risk_flags: Mapped[list] = mapped_column(JSONB, default=list)
    mc_note2: Mapped[str | None] = mapped_column(Text)

    # ── Assignment / admin ───────────────────────────────────────────────────
    loc: Mapped[str | None] = mapped_column(String(100))          # Level of Care
    chart_id: Mapped[str | None] = mapped_column(String(100))
    hit_list: Mapped[bool] = mapped_column(Boolean, default=False)
    pt_status: Mapped[str] = mapped_column(String(50), default="active")
    status: Mapped[str] = mapped_column(String(50), default="active")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    intake_date: Mapped[str | None] = mapped_column(Date)
    discharge_date: Mapped[str | None] = mapped_column(Date)
    last_visit_date: Mapped[str | None] = mapped_column(Date)

    # ── Pre-Auth cross-reference ─────────────────────────────────────────────
    pre_auth_status: Mapped[str | None] = mapped_column(String(100))
    pre_auth_cm1: Mapped[str | None] = mapped_column(String(100))
    pre_auth_cm2: Mapped[str | None] = mapped_column(String(100))
    pre_auth_ansa: Mapped[str | None] = mapped_column(String(100))

    # ── ANSA / BIO / TP / Auth tracking dates ────────────────────────────────
    last_ansa_date: Mapped[str | None] = mapped_column(Date)
    exp_ansa_date: Mapped[str | None] = mapped_column(Date)
    last_bios_date: Mapped[str | None] = mapped_column(Date)
    exp_bios_date: Mapped[str | None] = mapped_column(Date)
    last_tp_date: Mapped[str | None] = mapped_column(Date)
    exp_tp_date: Mapped[str | None] = mapped_column(Date)
    last_pn_date: Mapped[str | None] = mapped_column(Date)
    last_auth_start_date: Mapped[str | None] = mapped_column(Date)
    last_auth_end_date: Mapped[str | None] = mapped_column(Date)
    auth_hrs_units: Mapped[float | None] = mapped_column(Numeric(10, 2))
    avail_hrs_units: Mapped[float | None] = mapped_column(Numeric(10, 2))

    # ── Photo ────────────────────────────────────────────────────────────────
    photo_s3_key: Mapped[str | None] = mapped_column(String(500))

    # ── Notes ────────────────────────────────────────────────────────────────
    notes: Mapped[str | None] = mapped_column(Text)

    # ── Relationships ────────────────────────────────────────────────────────
    organization = relationship("Organization", back_populates="clients")
    assigned_cm = relationship("User", foreign_keys=[assigned_cm_id])
    authorizations = relationship("Authorization", back_populates="client", lazy="dynamic")
    contacts = relationship("ClientContact", back_populates="client", lazy="dynamic")
    scheduled_visits = relationship("ScheduledVisit", back_populates="client", lazy="dynamic")
    medications = relationship("ClientMedication", back_populates="client",
                               order_by="ClientMedication.name", lazy="selectin")
    treatment_plans = relationship("ClientTreatmentPlan", back_populates="client",
                                   order_by="ClientTreatmentPlan.plan_number", lazy="selectin")

    @property
    def full_name(self) -> str:
        parts = [p for p in [self.first_name, self.middle_name, self.last_name] if p]
        return " ".join(parts)

    @property
    def display_name(self) -> str:
        """Last, First format for lists."""
        return f"{self.last_name}, {self.first_name}"


class ClientMedication(Base, UUIDPrimaryKey, TimestampMixin):
    """Living medication list — updates propagate across all views for this client."""
    __tablename__ = "client_medications"

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    route: Mapped[str | None] = mapped_column(String(100))
    dosage: Mapped[str | None] = mapped_column(String(100))
    frequency: Mapped[str | None] = mapped_column(String(100))
    indication: Mapped[str | None] = mapped_column(String(255))
    prescribing_md: Mapped[str | None] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    start_date: Mapped[str | None] = mapped_column(Date)
    end_date: Mapped[str | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )

    client = relationship("Client", back_populates="medications")


class ClientTreatmentPlan(Base, UUIDPrimaryKey, TimestampMixin):
    """Treatment plans 1–4. Hidden tab on client form; pulled into Progress Notes."""
    __tablename__ = "client_treatment_plans"

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False
    )
    plan_number: Mapped[int] = mapped_column(Integer, nullable=False)
    problem: Mapped[str | None] = mapped_column(Text)
    goals: Mapped[str | None] = mapped_column(Text)
    objective: Mapped[str | None] = mapped_column(Text)
    interventions: Mapped[str | None] = mapped_column(Text)
    target_date: Mapped[str | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(50), default="active")
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )

    client = relationship("Client", back_populates="treatment_plans")


class ClientContact(Base, UUIDPrimaryKey, TimestampMixin):
    __tablename__ = "client_contacts"

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    relationship_type: Mapped[str | None] = mapped_column(String(100))
    phone: Mapped[str | None] = mapped_column(String(20))
    email: Mapped[str | None] = mapped_column(String(255))
    is_emergency: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str | None] = mapped_column(Text)

    client = relationship("Client", back_populates="contacts")


class Authorization(Base, UUIDPrimaryKey, TimestampMixin):
    __tablename__ = "authorizations"

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False
    )
    auth_number: Mapped[str | None] = mapped_column(String(100))
    payer_name: Mapped[str | None] = mapped_column(String(255))
    service_code: Mapped[str | None] = mapped_column(String(50))
    service_description: Mapped[str | None] = mapped_column(String(255))
    units_authorized: Mapped[int | None] = mapped_column(Integer)
    units_used: Mapped[int] = mapped_column(Integer, default=0)
    start_date: Mapped[str | None] = mapped_column(Date)
    end_date: Mapped[str | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(50), default="active")
    preauth_pro_id: Mapped[str | None] = mapped_column(String(100))
    notes: Mapped[str | None] = mapped_column(Text)

    client = relationship("Client", back_populates="authorizations")

    @property
    def units_remaining(self) -> int | None:
        if self.units_authorized is None:
            return None
        return self.units_authorized - self.units_used


class ServiceCity(Base, UUIDPrimaryKey):
    """Admin-managed list of service area cities used for insurance email routing."""
    __tablename__ = "service_cities"

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True))


class InsuranceEmailRecipient(Base, UUIDPrimaryKey):
    """
    Email addresses approved to receive insurance notifications.
    subscribed_city_ids is a JSON array of ServiceCity UUIDs (as strings).
    An empty array means the recipient receives emails for ALL cities.
    """
    __tablename__ = "insurance_email_recipients"

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    label: Mapped[str | None] = mapped_column(String(255))        # friendly name / company
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    subscribed_city_ids: Mapped[list] = mapped_column(JSONB, default=list)
    created_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True))
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )


class DropdownOption(Base, UUIDPrimaryKey):
    """Admin-managed dropdown options per page/field."""
    __tablename__ = "dropdown_options"

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    page_key: Mapped[str] = mapped_column(String(100), nullable=False)
    field_key: Mapped[str] = mapped_column(String(100), nullable=False)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    value: Mapped[str] = mapped_column(String(255), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True))
