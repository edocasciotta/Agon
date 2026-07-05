from app.database import Base
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func

EVENT_TYPES = [
    "client_invite",
    "password_reset",
    "booking_confirmed",
    "booking_cancelled",
    "class_reminder",
    "membership_expiring",
    "waitlist_promoted",
]


class EmailEventAssignment(Base):
    __tablename__ = "email_event_assignments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    event_type = Column(String, nullable=False, unique=True)
    template_id = Column(Integer, ForeignKey("email_templates.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
