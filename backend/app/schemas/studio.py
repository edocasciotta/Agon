from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class StudioSettingsUpdate(BaseModel):
    studio_name: Optional[str] = None
    address: Optional[str] = None
    timezone: Optional[str] = None
    cancellation_hours: Optional[int] = None
    cancellation_deducts_credit: Optional[bool] = None
    checkin_open_minutes_before: Optional[int] = None
    checkin_close_minutes_after: Optional[int] = None
    waitlist_confirm_minutes: Optional[int] = None
    guest_bookings_enabled: Optional[bool] = None
    self_service_purchases_enabled: Optional[bool] = None
    reminder_hours_before: Optional[int] = None


class StudioSettingsResponse(BaseModel):
    id: int
    studio_name: str
    address: Optional[str] = None
    timezone: str
    cancellation_hours: int
    cancellation_deducts_credit: bool
    checkin_open_minutes_before: int
    checkin_close_minutes_after: int
    waitlist_confirm_minutes: int
    guest_bookings_enabled: bool
    self_service_purchases_enabled: bool
    reminder_hours_before: int
    stripe_connected: bool
    tunnel_url: Optional[str] = None
    last_backup_at: Optional[datetime] = None
    updated_at: datetime
    model_config = {"from_attributes": True}
