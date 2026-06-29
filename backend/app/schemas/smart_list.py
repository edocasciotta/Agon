from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Any


class SmartListCreate(BaseModel):
    name: str
    description: Optional[str] = None
    filters: Optional[dict] = None


class SmartListUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    filters: Optional[dict] = None


class SmartListResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    filters: Any  # will be deserialized from JSON string
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SmartListListItem(BaseModel):
    id: int
    name: str
    description: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}
