from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class PaymentCreate(BaseModel):
    client_id: int
    membership_id: Optional[int] = None
    amount: float
    currency: str = "EUR"
    provider: str = "manual"
    notes: Optional[str] = None


class PaymentResponse(BaseModel):
    id: int
    client_id: int
    membership_id: Optional[int] = None
    amount: float
    currency: str
    status: str
    provider: str
    provider_payment_id: Optional[str] = None
    notes: Optional[str] = None
    paid_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class StripeCheckoutRequest(BaseModel):
    membership_type_id: int
    success_url: str
    cancel_url: str
