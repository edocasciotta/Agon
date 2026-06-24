from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class Checkin(Base):
    __tablename__ = "checkins"
    id = Column(Integer, primary_key=True, autoincrement=True)
    location_id = Column(Integer, nullable=False, default=1)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=False, unique=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    scheduled_class_id = Column(Integer, ForeignKey("scheduled_classes.id"), nullable=False)
    method = Column(String, nullable=False)  # app|qr|manual
    checked_in_at = Column(DateTime, server_default=func.now(), nullable=False)
    checked_in_by = Column(Integer, ForeignKey("users.id"))
