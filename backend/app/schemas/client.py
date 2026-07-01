from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


class ClientCreate(BaseModel):
    full_name: str
    email: EmailStr
    phone: Optional[str] = None


class ClientCreateResponse(BaseModel):
    id: int
    email: str
    full_name: str
    phone: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    email_sent: bool
    model_config = {"from_attributes": True}


class ClientResponse(BaseModel):
    id: int
    email: str
    full_name: str
    phone: Optional[str] = None
    date_of_birth: Optional[date] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class ClientUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    date_of_birth: Optional[date] = None
    notes: Optional[str] = None


class ClientListResponse(BaseModel):
    id: int
    email: str
    full_name: str
    phone: Optional[str] = None
    is_active: bool
    created_at: datetime
    model_config = {"from_attributes": True}
