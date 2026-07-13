from app.database import Base
from sqlalchemy import Column, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.sql import func


class AppointmentServiceLocation(Base):
    """Many-to-many link: which locations ("establishments" in the desktop UI)
    a given AppointmentService is offered at. A service with ZERO linked rows
    here is treated as offered at ALL locations (wildcard, and the default
    state for every service that existed before this table did)."""

    __tablename__ = "appointment_service_locations"
    id = Column(Integer, primary_key=True, autoincrement=True)
    service_id = Column(Integer, ForeignKey("appointment_services.id"), nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("service_id", "location_id", name="uq_appointment_service_location"),
    )
