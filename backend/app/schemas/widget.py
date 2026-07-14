from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class WidgetScheduledClass(BaseModel):
    """One upcoming class shown in the public embeddable widget.

    Deliberately minimal — never pricing/membership internals, never client
    rosters/credits, never instructor contact info (see
    docs/SECURITY_GUIDELINES.md and app/routers/widget.py's docstring).
    """

    scheduled_class_id: int
    class_name: str
    starts_at: datetime
    ends_at: datetime
    instructor_name: Optional[str] = None
    spots_available: int

    model_config = ConfigDict(from_attributes=True)


class WidgetScheduleResponse(BaseModel):
    """Public response for GET /api/v1/widget/{public_studio_id}/schedule.

    Mirrors the field-shape discipline of StudioBrandingResponse
    (app/schemas/studio.py) — only what a stranger on the internet embedding
    this widget on their own page needs to render a schedule.
    """

    studio_name: str
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    classes: List[WidgetScheduledClass]

    model_config = ConfigDict(from_attributes=True)
