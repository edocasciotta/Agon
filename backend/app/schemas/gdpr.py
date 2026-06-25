from pydantic import BaseModel
from typing import Optional
import datetime


class ConsentRequest(BaseModel):
    consent_type: str
    granted: bool
    ip_address: Optional[str] = None


class ConsentResponse(BaseModel):
    id: int
    client_id: int
    consent_type: str
    granted: bool
    ip_address: Optional[str] = None
    created_at: datetime.datetime

    model_config = {"from_attributes": True}
