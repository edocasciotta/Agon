from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class MembershipTypeCreate(BaseModel):
    name: str
    description: Optional[str] = None
    type: str  # 'recurring' or 'credit_pack'
    price: float
    currency: str = "EUR"
    billing_interval: Optional[str] = None  # 'weekly', 'monthly', 'annual'
    credits_included: Optional[int] = None
    credits_per_interval: Optional[int] = None
    unlimited: bool = False
    validity_days: Optional[int] = None
    can_pause: bool = False
    max_pause_days: Optional[int] = None
    sellable_online: bool = False


class MembershipTypeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    credits_included: Optional[int] = None
    credits_per_interval: Optional[int] = None
    unlimited: Optional[bool] = None
    validity_days: Optional[int] = None
    can_pause: Optional[bool] = None
    max_pause_days: Optional[int] = None
    is_active: Optional[bool] = None
    sellable_online: Optional[bool] = None


class MembershipTypeResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    type: str
    price: float
    currency: str
    billing_interval: Optional[str] = None
    credits_included: Optional[int] = None
    credits_per_interval: Optional[int] = None
    unlimited: bool
    validity_days: Optional[int] = None
    can_pause: bool
    max_pause_days: Optional[int] = None
    is_active: bool
    sellable_online: bool
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}
