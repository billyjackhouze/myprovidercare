import uuid
from sqlalchemy import String, Boolean, ForeignKey, Integer, Date, Text
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
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    date_of_birth: Mapped[str | None] = mapped_column(Date)
    medicaid_id: Mapped[str | None] = mapped_column(String(50))
    ssn_last4: Mapped[str | None] = mapped_column(String(4))
    phone: Mapped[str | None] = mapped_column(String(20))
    email: Mapped[str | None] = mapped_column(String(255))
    address_line1: Mapped[str | None] = mapped_column(String(255))
    address_line2: Mapped[str | None] = mapped_column(String(255))
    city: Mapped[str | None] = mapped_column(String(100))
    state: Mapped[str | None] = mapped_column(String(2))
    zip_code: Mapped[str | None] = mapped_column(String(10))
    # PostGIS geofence
    geo_point = mapped_column(Geometry("POINT", srid=4326))
    geofence_radius_ft: Mapped[int] = mapped_column(Integer, default=300)
    status: Mapped[str] = mapped_column(String(50), default="active")
    diagnosis_codes: Mapped[list] = mapped_column(JSONB, default=list)
    emergency_contact: Mapped[dict] = mapped_column(JSONB, default=dict)
    payer_info: Mapped[dict] = mapped_column(JSONB, default=dict)
    fm_record_id: Mapped[str | None] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # relationships
    organization = relationship("Organization", back_populates="clients")
    assigned_cm = relationship("User", foreign_keys=[assigned_cm_id])
    authorizations = relationship("Authorization", back_populates="client", lazy="dynamic")
    contacts = relationship("ClientContact", back_populates="client", lazy="dynamic")
    scheduled_visits = relationship("ScheduledVisit", back_populates="client", lazy="dynamic")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"


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
