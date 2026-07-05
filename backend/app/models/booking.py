from app.database import Base
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.sql import func


class Booking(Base):
    __tablename__ = "bookings"
    id = Column(Integer, primary_key=True, autoincrement=True)
    location_id = Column(Integer, nullable=False, default=1)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    scheduled_class_id = Column(Integer, ForeignKey("scheduled_classes.id"), nullable=False)
    status = Column(String, nullable=False, default="confirmed")  # confirmed|cancelled|no_show
    cancelled_at = Column(DateTime)
    cancellation_reason = Column(String)
    credit_deducted = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
    __table_args__ = (
        UniqueConstraint("client_id", "scheduled_class_id"),
        Index("idx_booking_class_status", "scheduled_class_id", "status"),
        Index("idx_booking_client_status", "client_id", "status"),
    )
