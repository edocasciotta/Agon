from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class WaiverCreate(BaseModel):
    title: str
    body: str
    requires_before_booking: bool = False


class WaiverUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    requires_before_booking: Optional[bool] = None


class WaiverResponse(BaseModel):
    id: int
    location_id: int
    title: str
    body: str
    version: int
    requires_before_booking: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WaiverSignRequest(BaseModel):
    signed_name: str = Field(min_length=2, max_length=200)


class WaiverSignatureResponse(BaseModel):
    id: int
    waiver_id: int
    client_id: int
    waiver_version: int
    signed_name: str
    signed_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WaiverWithStatus(BaseModel):
    id: int
    location_id: int
    title: str
    body: str
    version: int
    requires_before_booking: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime
    is_signed: bool
    signed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
