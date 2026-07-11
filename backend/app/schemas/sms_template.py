from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class SmsTemplateCreate(BaseModel):
    name: str
    body: str


class SmsTemplateUpdate(BaseModel):
    name: Optional[str] = None
    body: Optional[str] = None


class SmsTemplateResponse(BaseModel):
    id: int
    name: str
    body: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SmsTemplateListItem(BaseModel):
    # EmailTemplateListItem keeps the short preview field (subject) and drops
    # the heavy one (html_body). SMS has no subject/body split — body is the
    # only content field and is short by nature (SMS char limits), so it is
    # kept here rather than omitted, unlike html_body.
    id: int
    name: str
    body: str
    created_at: datetime

    model_config = {"from_attributes": True}
