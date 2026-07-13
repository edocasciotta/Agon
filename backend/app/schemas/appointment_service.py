from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class AppointmentServiceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    duration_minutes: int = Field(gt=0)
    buffer_minutes: int = Field(default=0, ge=0)
    # Locations ("establishments" in the desktop UI) this service is offered
    # at. Omitted/empty = offered at ALL locations (wildcard).
    establishment_ids: Optional[List[int]] = None


class AppointmentServiceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    duration_minutes: Optional[int] = Field(default=None, gt=0)
    buffer_minutes: Optional[int] = Field(default=None, ge=0)
    is_active: Optional[bool] = None
    # When provided (even as an empty list), replaces the entire set of
    # linked establishments. When omitted, the existing links are untouched.
    establishment_ids: Optional[List[int]] = None


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
    # Populated by the router from appointment_service_locations — empty list
    # means "offered at all establishments" (wildcard).
    establishment_ids: List[int] = []

    model_config = ConfigDict(from_attributes=True)
