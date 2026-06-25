from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class CheckinCreate(BaseModel):
    booking_id: Optional[int] = None       # for app/manual check-in
    qr_token: Optional[str] = None         # for QR check-in
    method: str                             # 'app', 'qr', or 'manual'
    scheduled_class_id: Optional[int] = None  # for manual: manager specifies class
    client_id: Optional[int] = None           # for manual: manager specifies client


class CheckinResponse(BaseModel):
    id: int
    booking_id: int
    client_id: int
    scheduled_class_id: int
    method: str
    checked_in_at: datetime
    checked_in_by: Optional[int] = None
    client_name: str   # denormalized from Client for display at reception
    model_config = {"from_attributes": True}


class QRCodeResponse(BaseModel):
    booking_id: int
    qr_token: str
    qr_image_base64: str   # PNG encoded as base64
    expires_at: Optional[datetime] = None
