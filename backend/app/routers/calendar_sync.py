"""Calendar Sync (iCal) — /api/v1/clients/{client_id}/calendar-sync,
/api/v1/calendar/{token}.ics

A client can subscribe their Google/Apple/Outlook calendar to a personal feed
URL showing their upcoming confirmed class bookings. The feed URL embeds a
long-lived secret token (see app/services/calendar_sync_service.py) because
calendar apps poll a static URL periodically and cannot perform OAuth/JWT
login — the token in the path IS the credential for that one endpoint.
"""

from datetime import timedelta, timezone

from app.auth import decode_token, oauth2_scheme
from app.database import get_db
from app.limiter import limiter
from app.models.booking import Booking
from app.models.class_template import ClassTemplate
from app.models.client import Client
from app.models.scheduled_class import ScheduledClass
from app.models.studio_settings import StudioSettings
from app.services.calendar_sync_service import (
    get_client_by_calendar_token,
    get_or_create_calendar_token,
    regenerate_calendar_token,
)
from app.utils import raise_api_error, utcnow
from fastapi import APIRouter, Depends, Request, Response
from icalendar import Calendar, Event
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1", tags=["calendar-sync"])

# Trailing window: a calendar app may have cached an older poll, so include a
# short lookback in addition to all upcoming classes (no upper bound needed).
_TRAILING_WINDOW_DAYS = 7


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _resolve_caller(token: str) -> tuple[str, int]:
    """Decode an access token and return (role, subject_id).

    Mirrors app/routers/tags.py::_resolve_caller — the established pattern
    for mixed client/manager endpoints in this codebase.
    """
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise_api_error("AUTH_TOKEN_INVALID", "Invalid token type.", status_code=401)
    role = payload.get("role", "client")
    sub = payload.get("sub")
    if sub is None:
        raise_api_error("AUTH_TOKEN_INVALID", "Token missing subject.", status_code=401)
    return role, int(sub)


def _require_self_or_staff(role: str, subject_id: int, target_client_id: int) -> None:
    """Reject a client caller whose subject id is not the target client_id.

    Managers/instructors may act on any client (see docs/SECURITY_GUIDELINES.md §2).
    """
    if role not in ("manager", "instructor"):
        if subject_id != target_client_id:
            raise_api_error("FORBIDDEN", "You may only act on your own account.", status_code=403)


def _resolve_backend_base_url(db: Session) -> str:
    """Resolve the backend's own public base URL for building the feed URL.

    The feed URL must point at this backend server (not the Electron
    frontend) since it's pasted directly into a calendar app's "subscribe to
    URL" field. Reuses StudioSettings.tunnel_url the same way
    app/routers/migration.py builds invite URLs that target the backend
    directly, falling back to the backend's own dev port (8000) rather than
    the frontend dev server's port (5173).
    """
    studio_settings = db.query(StudioSettings).filter(StudioSettings.id == 1).first()
    if studio_settings and studio_settings.tunnel_url:
        return studio_settings.tunnel_url
    return "http://localhost:8000"


def _build_feed_url(db: Session, token: str) -> str:
    base_url = _resolve_backend_base_url(db)
    return f"{base_url}/api/v1/calendar/{token}.ics"


def _as_utc(dt):
    """Attach explicit UTC tzinfo to a naive datetime.

    Datetimes are stored UTC-naive in this codebase (see app/utils.utcnow).
    icalendar needs an aware datetime to render the Z-suffixed UTC form in
    DTSTART/DTEND/DTSTAMP — leaving it naive would let calendar apps
    misinterpret it as local time.
    """
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


# ---------------------------------------------------------------------------
# GET /api/v1/clients/{client_id}/calendar-sync  (client or manager)
# ---------------------------------------------------------------------------


@router.get("/clients/{client_id}/calendar-sync")
def get_calendar_sync(
    client_id: int,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    """Return the client's personal iCal feed URL, generating a token if needed."""
    role, subject_id = _resolve_caller(token)
    _require_self_or_staff(role, subject_id, client_id)

    client = db.query(Client).filter(Client.id == client_id).first()
    if client is None:
        raise_api_error("CLIENT_NOT_FOUND", "Client not found.", status_code=404)

    sync_token = get_or_create_calendar_token(db, client_id)
    db.commit()

    return {"feed_url": _build_feed_url(db, sync_token)}


# ---------------------------------------------------------------------------
# POST /api/v1/clients/{client_id}/calendar-sync/regenerate  (client or manager)
# ---------------------------------------------------------------------------


@router.post("/clients/{client_id}/calendar-sync/regenerate")
def regenerate_calendar_sync(
    client_id: int,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    """Regenerate the client's iCal feed token, invalidating the old one."""
    role, subject_id = _resolve_caller(token)
    _require_self_or_staff(role, subject_id, client_id)

    client = db.query(Client).filter(Client.id == client_id).first()
    if client is None:
        raise_api_error("CLIENT_NOT_FOUND", "Client not found.", status_code=404)

    sync_token = regenerate_calendar_token(db, client_id)
    db.commit()

    return {"feed_url": _build_feed_url(db, sync_token)}


# ---------------------------------------------------------------------------
# GET /api/v1/calendar/{token}.ics  (PUBLIC — no JWT, token in path is the credential)
# ---------------------------------------------------------------------------


@router.get("/calendar/{token}.ics")
@limiter.limit("10/minute")
def get_calendar_feed(request: Request, token: str, db: Session = Depends(get_db)):
    """Public iCal feed of a client's upcoming confirmed bookings.

    Deliberately has NO JWT auth dependency — calendar apps (Google/Apple/
    Outlook) subscribe to this URL and poll it periodically, and cannot do
    OAuth/JWT login. The token embedded in the path is itself the credential,
    so it is never logged (see docs/SECURITY_GUIDELINES.md §5) and this
    endpoint is rate-limited per docs/SECURITY_GUIDELINES.md §1.5 / §0.
    """
    # Note: the literal ".ics" suffix in the route path is stripped by
    # FastAPI's path compiler, so `token` here never includes it.
    client = get_client_by_calendar_token(db, token)
    if client is None:
        # Generic 404 — do not distinguish "malformed" from "doesn't exist"
        # (same enumeration-resistance principle as login).
        raise_api_error("NOT_FOUND", "Calendar feed not found.", status_code=404)

    window_start = utcnow() - timedelta(days=_TRAILING_WINDOW_DAYS)

    rows = (
        db.query(Booking, ScheduledClass, ClassTemplate)
        .join(ScheduledClass, Booking.scheduled_class_id == ScheduledClass.id)
        .join(ClassTemplate, ScheduledClass.template_id == ClassTemplate.id)
        .filter(
            Booking.client_id == client.id,
            Booking.status == "confirmed",
            ScheduledClass.starts_at >= window_start,
        )
        .all()
    )

    # Location model exists but is not yet wired into app/models/__init__.py
    # (tracked separately, out of scope here) so we don't join to it.
    # StudioSettings.studio_name is the best available studio/location label.
    studio_settings = db.query(StudioSettings).filter(StudioSettings.id == 1).first()
    studio_name = studio_settings.studio_name if studio_settings else None

    cal = Calendar()
    cal.add("prodid", "-//Agon//Calendar Sync//EN")
    cal.add("version", "2.0")
    cal.add("calscale", "GREGORIAN")
    cal.add("method", "PUBLISH")
    cal.add("x-wr-calname", "Agon Schedule")

    now = utcnow()
    for booking, scheduled_class, class_template in rows:
        event = Event()
        event.add("summary", class_template.name)
        event.add("dtstart", _as_utc(scheduled_class.starts_at))
        event.add("dtend", _as_utc(scheduled_class.ends_at))
        event.add("dtstamp", _as_utc(now))
        # Stable across regenerations of the feed — booking.id never changes,
        # so a calendar app treats this as the same event on every poll
        # instead of creating a duplicate each time the token is refreshed.
        event.add("uid", f"booking-{booking.id}@agon-studio")
        event.add("status", "CONFIRMED")
        if studio_name:
            event.add("location", studio_name)
        cal.add_component(event)

    ics_body = cal.to_ical()

    return Response(
        content=ics_body,
        media_type="text/calendar",
        headers={"Content-Disposition": 'inline; filename="agon-schedule.ics"'},
    )
