from app.database import Base
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, Time
from sqlalchemy.sql import func


class InstructorAvailability(Base):
    __tablename__ = "instructor_availability"
    id = Column(Integer, primary_key=True, autoincrement=True)
    location_id = Column(Integer, nullable=False, default=1)
    instructor_id = Column(Integer, ForeignKey("instructors.id"), nullable=False)
    day_of_week = Column(Integer, nullable=False)  # 0=Monday ... 6=Sunday
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
    __table_args__ = (
        Index(
            "idx_availability_instructor_day_active",
            "instructor_id",
            "day_of_week",
            "is_active",
        ),
    )
