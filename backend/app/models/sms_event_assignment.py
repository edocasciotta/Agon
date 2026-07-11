from app.database import Base
from app.models.email_event_assignment import (  # noqa: F401 — re-exported for SMS routers
    EVENT_TYPES,
)
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func


class SmsEventAssignment(Base):
    __tablename__ = "sms_event_assignments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    event_type = Column(String, nullable=False, unique=True)
    template_id = Column(Integer, ForeignKey("sms_templates.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
