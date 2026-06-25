from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date


class MembershipCreate(BaseModel):
    client_id: int
    membership_type_id: int
    starts_at: date
    expires_at: Optional[date] = None  # computed from validity_days if None
    credits_remaining: Optional[int] = None  # computed from credits_included if None
    notes: Optional[str] = None


class MembershipUpdate(BaseModel):
    status: Optional[str] = None
    expires_at: Optional[date] = None
    credits_remaining: Optional[int] = None
    notes: Optional[str] = None


class MembershipResponse(BaseModel):
    id: int
    client_id: int
    membership_type_id: int
    status: str
    starts_at: date
    expires_at: Optional[date] = None
    credits_remaining: Optional[int] = None
    credits_used: int
    paused_at: Optional[datetime] = None
    pause_ends_at: Optional[datetime] = None
    stripe_subscription_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class MembershipPauseRequest(BaseModel):
    pause_days: int  # how many days to pause
