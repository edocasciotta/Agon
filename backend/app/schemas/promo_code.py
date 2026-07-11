from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class PromoCodeCreate(BaseModel):
    code: str
    discount_type: str  # "percentage" | "fixed"
    discount_value: float
    applicable_membership_type_ids: Optional[list[int]] = None
    max_uses: Optional[int] = None
    one_per_client: bool = True
    valid_from: datetime
    valid_until: Optional[datetime] = None
    is_active: bool = True


class PromoCodeUpdate(BaseModel):
    code: Optional[str] = None
    discount_type: Optional[str] = None
    discount_value: Optional[float] = None
    applicable_membership_type_ids: Optional[list[int]] = None
    max_uses: Optional[int] = None
    one_per_client: Optional[bool] = None
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    is_active: Optional[bool] = None


class PromoCodeResponse(BaseModel):
    id: int
    location_id: int
    code: str
    discount_type: str
    discount_value: float
    applicable_membership_type_ids: Optional[list[int]] = None
    max_uses: Optional[int] = None
    current_uses: int
    one_per_client: bool
    valid_from: datetime
    valid_until: Optional[datetime] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PromoCodeValidateRequest(BaseModel):
    code: str
    membership_type_id: int


class PromoCodeValidateResponse(BaseModel):
    valid: bool
    discount_type: str
    discount_value: float
    discount_amount: float
    original_price: float
    final_price: float
