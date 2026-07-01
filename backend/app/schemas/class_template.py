from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ClassTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    duration_minutes: int = 60
    default_capacity: int = 20
    default_instructor_id: Optional[int] = None
    color: str = "#4F46E5"


class ClassTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    duration_minutes: Optional[int] = None
    default_capacity: Optional[int] = None
    default_instructor_id: Optional[int] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None


class ClassTemplateResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    duration_minutes: int
    default_capacity: int
    default_instructor_id: Optional[int] = None
    color: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}
