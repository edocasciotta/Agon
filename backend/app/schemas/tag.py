from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


# ── Tag ──────────────────────────────────────────────────────────────────────


class TagCreate(BaseModel):
    name: str
    color: Optional[str] = None


class TagUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None


class TagResponse(BaseModel):
    id: int
    name: str
    color: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── ClientTag ────────────────────────────────────────────────────────────────


class ClientTagAssign(BaseModel):
    tag_id: int


class ClientTagResponse(BaseModel):
    id: int
    client_id: int
    tag_id: int
    tag_name: str
    tag_color: Optional[str]
    assigned_at: datetime
    assigned_by: str

    model_config = ConfigDict(from_attributes=True)


# ── AutoTagRule ──────────────────────────────────────────────────────────────

VALID_TRIGGER_EVENTS = {
    "booking_created",
    "booking_cancelled",
    "membership_purchased",
    "membership_expired",
    "no_show",
    "checkin",
}


class AutoTagRuleCreate(BaseModel):
    tag_id: int
    trigger_event: str
    condition_json: Optional[dict] = None
    is_active: bool = True


class AutoTagRuleUpdate(BaseModel):
    tag_id: Optional[int] = None
    trigger_event: Optional[str] = None
    condition_json: Optional[dict] = None
    is_active: Optional[bool] = None


class AutoTagRuleResponse(BaseModel):
    id: int
    tag_id: int
    trigger_event: str
    condition_json: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
