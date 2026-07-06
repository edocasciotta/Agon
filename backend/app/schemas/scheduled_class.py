from datetime import datetime, timezone
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


class ScheduledClassCreate(BaseModel):
    template_id: int
    instructor_id: Optional[int] = None
    location_id: Optional[int] = 1
    starts_at: datetime
    ends_at: datetime
    capacity: int = Field(gt=0)
    notes: Optional[str] = None

    @field_validator("starts_at")
    @classmethod
    def starts_at_must_be_future(cls, v: datetime) -> datetime:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        if v.replace(tzinfo=None) <= now:
            raise ValueError("starts_at must be in the future")
        return v

    @model_validator(mode="after")
    def ends_at_after_starts_at(self) -> "ScheduledClassCreate":
        if self.ends_at.replace(tzinfo=None) <= self.starts_at.replace(tzinfo=None):
            raise ValueError("ends_at must be after starts_at")
        return self


class RecurringClassCreate(BaseModel):
    template_id: int
    instructor_id: Optional[int] = None
    location_id: Optional[int] = 1
    starts_at: datetime  # first occurrence datetime
    ends_at: datetime  # first occurrence end datetime
    capacity: int = Field(gt=0)
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
    template_name: Optional[str] = None
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
