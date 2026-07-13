from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class AppointmentCreate(BaseModel):
    service_id: int
    instructor_id: int
    starts_at: datetime
    client_id: Optional[int] = None  # manager/instructor can book on behalf of a client
    notes: Optional[str] = None


class AppointmentResponse(BaseModel):
    id: int
    location_id: int
    service_id: int
    instructor_id: int
    client_id: int
    starts_at: datetime
    ends_at: datetime
    status: str
    cancelled_at: Optional[datetime] = None
    cancellation_reason: Optional[str] = None
    credit_deducted: bool
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    # Denormalised fields (populated via outerjoin in appointments.py list/detail
    # endpoints only — same pattern as BookingResponse / ScheduledClassResponse)
    # so mobile appointment cards don't need separate service/instructor round-trips.
    service_name: Optional[str] = None
    instructor_name: Optional[str] = None
    location_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AppointmentCancelRequest(BaseModel):
    reason: Optional[str] = None


class AppointmentCompleteRequest(BaseModel):
    status: str  # "completed" | "no_show"


class AvailableSlot(BaseModel):
    starts_at: datetime
    ends_at: datetime
