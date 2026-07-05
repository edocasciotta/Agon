from app.database import Base
from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.sql import func


class ScheduledClass(Base):
    __tablename__ = "scheduled_classes"
    id = Column(Integer, primary_key=True, autoincrement=True)
    location_id = Column(Integer, nullable=False, default=1)
    template_id = Column(Integer, ForeignKey("class_templates.id"), nullable=False)
    instructor_id = Column(Integer, ForeignKey("instructors.id"))
    starts_at = Column(DateTime, nullable=False)
    ends_at = Column(DateTime, nullable=False)
    capacity = Column(Integer, nullable=False)
    status = Column(String, nullable=False, default="scheduled")  # scheduled|cancelled|completed
    recurrence_group_id = Column(String)
    notes = Column(String)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
    __table_args__ = (
        Index("idx_class_starts_at_location_status", "starts_at", "location_id", "status"),
    )
