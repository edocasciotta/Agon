from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class GiftCardIssueRequest(BaseModel):
    initial_value: float
    recipient_name: Optional[str] = None
    recipient_email: Optional[str] = None
    message: Optional[str] = None
    expires_at: Optional[datetime] = None


class GiftCardResponse(BaseModel):
    id: int
    location_id: int
    code: str
    initial_value: float
    remaining_balance: float
    currency: str
    purchaser_client_id: Optional[int] = None
    recipient_name: Optional[str] = None
    recipient_email: Optional[str] = None
    message: Optional[str] = None
    is_active: bool
    expires_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GiftCardValidateRequest(BaseModel):
    code: str


class GiftCardValidateResponse(BaseModel):
    valid: bool
    remaining_balance: float
    currency: str


class GiftCardPurchaseRequest(BaseModel):
    amount: float
    recipient_name: Optional[str] = None
    recipient_email: Optional[str] = None
    message: Optional[str] = None
    success_url: str
    cancel_url: str
