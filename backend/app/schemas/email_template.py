from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class EmailTemplateCreate(BaseModel):
    name: str
    subject: str
    html_body: str


class EmailTemplateUpdate(BaseModel):
    name: Optional[str] = None
    subject: Optional[str] = None
    html_body: Optional[str] = None


class EmailTemplateResponse(BaseModel):
    id: int
    name: str
    subject: str
    html_body: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EmailTemplateListItem(BaseModel):
    id: int
    name: str
    subject: str
    created_at: datetime

    model_config = {"from_attributes": True}
