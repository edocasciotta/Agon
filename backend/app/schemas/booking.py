from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class BookingCreate(BaseModel):
    scheduled_class_id: int
    client_id: Optional[int] = None  # manager can book on behalf of a client


class BookingResponse(BaseModel):
    id: int
    client_id: int
    scheduled_class_id: int
    status: str
    credit_deducted: bool
    cancelled_at: Optional[datetime] = None
    cancellation_reason: Optional[str] = None
    fee_charged: Optional[float] = None
    created_at: datetime
    updated_at: datetime
    # Denormalised fields (populated via outerjoin in bookings.py list/detail
    # endpoints only — mirrors the ScheduledClassResponse.template_name pattern
    # in scheduled_class.py) so mobile booking cards can show useful info
    # instead of bare IDs. None on any response path that doesn't enrich them.
    class_type_name: Optional[str] = None
    location_name: Optional[str] = None
    instructor_name: Optional[str] = None
    class_starts_at: Optional[datetime] = None
    class_ends_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class BookingCancelRequest(BaseModel):
    reason: Optional[str] = None


class WaitlistJoinRequest(BaseModel):
    scheduled_class_id: int
    client_id: Optional[int] = None  # manager can join waitlist on behalf of client


class WaitlistResponse(BaseModel):
    id: int
    client_id: int
    scheduled_class_id: int
    position: int
    status: str
    offered_at: Optional[datetime] = None
    offer_expires_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}
