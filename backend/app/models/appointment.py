from app.database import Base
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.sql import func


class Appointment(Base):
    __tablename__ = "appointments"
    id = Column(Integer, primary_key=True, autoincrement=True)
    location_id = Column(Integer, nullable=False, default=1)
    service_id = Column(Integer, ForeignKey("appointment_services.id"), nullable=False)
    instructor_id = Column(Integer, ForeignKey("instructors.id"), nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    starts_at = Column(DateTime, nullable=False)
    ends_at = Column(DateTime, nullable=False)
    status = Column(
        String, nullable=False, default="confirmed"
    )  # confirmed|cancelled|completed|no_show
    cancelled_at = Column(DateTime)
    cancellation_reason = Column(String)
    credit_deducted = Column(Boolean, nullable=False, default=False)
    notes = Column(String)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
    __table_args__ = (
        Index(
            "idx_appointment_instructor_starts_status",
            "instructor_id",
            "starts_at",
            "status",
        ),
        Index("idx_appointment_client_status", "client_id", "status"),
    )
