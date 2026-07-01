from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class ScheduledClassCreate(BaseModel):
    template_id: int
    instructor_id: Optional[int] = None
    location_id: Optional[int] = 1
    starts_at: datetime
    ends_at: datetime
    capacity: int
    notes: Optional[str] = None


class RecurringClassCreate(BaseModel):
    template_id: int
    instructor_id: Optional[int] = None
    location_id: Optional[int] = 1
    starts_at: datetime  # first occurrence datetime
    ends_at: datetime  # first occurrence end datetime
    capacity: int
    notes: Optional[str] = None
    days_of_week: List[int]  # 0=Monday ... 6=Sunday
    recurrence_end_date: Optional[datetime] = None  # None = 1 year from start
    max_occurrences: Optional[int] = None


class ScheduledClassUpdate(BaseModel):
    instructor_id: Optional[int] = None
    location_id: Optional[int] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    capacity: Optional[int] = None
    notes: Optional[str] = None


class ScheduledClassResponse(BaseModel):
    id: int
    template_id: int
    instructor_id: Optional[int] = None
    location_id: int = 1
    starts_at: datetime
    ends_at: datetime
    capacity: int
    status: str
    recurrence_group_id: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class RecurringClassResponse(BaseModel):
    created_count: int
    recurrence_group_id: str
