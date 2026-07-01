from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func

from app.database import Base


class ClassTemplate(Base):
    __tablename__ = "class_templates"
    id = Column(Integer, primary_key=True, autoincrement=True)
    location_id = Column(Integer, nullable=False, default=1)
    name = Column(String, nullable=False)
    description = Column(String)
    duration_minutes = Column(Integer, nullable=False, default=60)
    default_capacity = Column(Integer, nullable=False, default=20)
    default_instructor_id = Column(Integer, ForeignKey("instructors.id"))
    color = Column(String, nullable=False, default="#4F46E5")
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
