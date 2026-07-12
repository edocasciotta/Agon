from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class AppointmentServiceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    duration_minutes: int = Field(gt=0)
    buffer_minutes: int = Field(default=0, ge=0)


class AppointmentServiceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    duration_minutes: Optional[int] = Field(default=None, gt=0)
    buffer_minutes: Optional[int] = Field(default=None, ge=0)
    is_active: Optional[bool] = None


class AppointmentServiceResponse(BaseModel):
    id: int
    location_id: int
    name: str
    description: Optional[str] = None
    duration_minutes: int
    buffer_minutes: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
