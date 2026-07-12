from datetime import datetime, time

from pydantic import BaseModel, ConfigDict, Field, model_validator


class InstructorAvailabilityCreate(BaseModel):
    instructor_id: int
    day_of_week: int = Field(ge=0, le=6)
    start_time: time
    end_time: time

    @model_validator(mode="after")
    def end_after_start(self) -> "InstructorAvailabilityCreate":
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class InstructorAvailabilityResponse(BaseModel):
    id: int
    location_id: int
    instructor_id: int
    day_of_week: int
    start_time: time
    end_time: time
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
