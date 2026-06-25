from pydantic import BaseModel
from typing import Optional
from datetime import datetime


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
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


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
