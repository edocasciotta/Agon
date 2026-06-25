from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class NotificationSendRequest(BaseModel):
    client_id: int
    title: str
    body: str


class NotificationResponse(BaseModel):
    id: int
    client_id: int
    type: str
    title: str
    body: str
    status: str
    expo_ticket_id: Optional[str] = None
    sent_at: Optional[datetime] = None
    created_at: datetime
    model_config = {"from_attributes": True}
