from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


class InstructorCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    bio: Optional[str] = None


class InstructorUpdate(BaseModel):
    full_name: Optional[str] = None
    bio: Optional[str] = None


class InstructorResponse(BaseModel):
    id: int
    user_id: int
    bio: Optional[str] = None
    full_name: str  # denormalised from user
    email: str  # denormalised from user
    is_active: bool  # denormalised from user
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}
