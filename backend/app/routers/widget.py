"""Public Widget Schedule — GET /api/v1/widget/{public_studio_id}/schedule

A studio manager embeds a small booking-schedule widget on their own public
website (Squarespace, Wix, a custom site they don't control — see
widget/CLAUDE.md). That widget runs in a browser on a page this backend does
not control and cannot assume anything about, and it has no way to hold a
JWT (there is no login flow for an anonymous website visitor).

This endpoint is therefore INTENTIONALLY PUBLIC — no auth dependency at
all — mirroring the reasoning already used for the public .ics calendar feed
in app/routers/calendar_sync.py: some callers are legitimately unauthenticated
by design. The difference from that feed is that there is no secret token in
the path here; `public_studio_id` is not a credential, it is simply the
public identifier of a studio's schedule (equivalent in sensitivity to a
studio's public class timetable on its own website). Internal pricing,
membership, client-roster, and instructor-contact data are never included in
the response — see docs/SECURITY_GUIDELINES.md and the widget agent's
data-minimalism gate in widget/CLAUDE.md.
"""

from fastapi import APIRouter, Depends, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.limiter import limiter
from app.models.booking import Booking
from app.models.class_template import ClassTemplate
from app.models.instructor import Instructor
from app.models.scheduled_class import ScheduledClass
from app.models.studio_settings import StudioSettings
from app.models.user import User
from app.schemas.widget import WidgetScheduledClass, WidgetScheduleResponse
from app.utils import raise_api_error, utcnow

router = APIRouter(prefix="/api/v1/widget", tags=["widget"])


@router.get("/{public_studio_id}/schedule", response_model=WidgetScheduleResponse)
@limiter.limit("30/minute")
def get_widget_schedule(
    request: Request,
    public_studio_id: str,
    db: Session = Depends(get_db),
):
    """Public upcoming-class schedule for one studio's embeddable widget.

    IP-keyed rate limit (get_remote_address, same key_func as the
    unauthenticated calendar feed at calendar_sync.py) since there is no
    JWT here to key on.
    """
    studio_settings = (
        db.query(StudioSettings).filter(StudioSettings.public_studio_id == public_studio_id).first()
    )
    if studio_settings is None:
        # Generic 404 — don't distinguish "malformed id" from "unknown id"
        # (same enumeration-resistance principle as calendar_sync.py's
        # token-in-path 404 and the login flow).
        raise_api_error("NOT_FOUND", "Studio not found.", status_code=404)

    confirmed_count = (
        func.count(Booking.id).filter(Booking.status == "confirmed").label("booking_count")
    )
    rows = (
        db.query(
            ScheduledClass,
            ClassTemplate.name.label("class_name"),
            User.full_name.label("instructor_name"),
            confirmed_count,
        )
        .join(ClassTemplate, ScheduledClass.template_id == ClassTemplate.id)
        .outerjoin(Instructor, ScheduledClass.instructor_id == Instructor.id)
        .outerjoin(User, Instructor.user_id == User.id)
        .outerjoin(Booking, Booking.scheduled_class_id == ScheduledClass.id)
        .filter(
            # Scope to this studio's own location — today there is only one
            # studio/location in practice, but this keeps the query correct
            # if that assumption ever changes (see test_widget.py's
            # cross-studio isolation test).
            ScheduledClass.location_id == studio_settings.location_id,
            ScheduledClass.status == "scheduled",
            ScheduledClass.starts_at >= utcnow(),
        )
        .group_by(ScheduledClass.id)
        .order_by(ScheduledClass.starts_at)
        .all()
    )

    classes = [
        WidgetScheduledClass(
            scheduled_class_id=sc.id,
            class_name=class_name,
            starts_at=sc.starts_at,
            ends_at=sc.ends_at,
            instructor_name=instructor_name,
            spots_available=max(sc.capacity - (booking_count or 0), 0),
        )
        for sc, class_name, instructor_name, booking_count in rows
    ]

    return WidgetScheduleResponse(
        studio_name=studio_settings.studio_name or "Agon",
        primary_color=studio_settings.primary_color,
        secondary_color=studio_settings.secondary_color,
        classes=classes,
    )
