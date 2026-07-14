import asyncio
import logging
import os
from contextlib import asynccontextmanager

from app.database import create_tables
from app.limiter import limiter
from app.logging_config import configure_logging
from app.routers import (
    agent,
    appointment_services,
    appointments,
    bookings,
    calendar_sync,
    checkins,
    class_templates,
    classes,
    clients,
    email_events,
    email_settings,
    email_templates,
    gdpr,
    gift_cards,
    instructor_availability,
    instructors,
    locations,
    membership_types,
    memberships,
    migration,
    notifications,
    payments,
    photos,
    promo_codes,
    reports,
    smart_lists,
    sms_events,
    sms_send,
    sms_settings,
    sms_templates,
    stripe_billing,
    studio,
    support,
    tags,
    waivers,
    widget,
)
from app.routers import auth as auth_router
from app.services.tunnel_registration import register_with_directory
from app.tasks.class_reminders import run_class_reminder_loop
from app.tasks.membership_expiry import run_membership_expiry_loop
from app.tasks.nightly_backup import run_nightly_backup_loop
from app.tasks.waitlist_expiry import run_waitlist_expiry_loop
from app.tunnel import CloudflareTunnelProvider
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

_main_logger = logging.getLogger(__name__)

# Holds the running tunnel provider between the startup and shutdown halves
# of the lifespan context manager, so _stop_tunnel() can stop the exact
# instance _start_tunnel() created. Module-level because the two calls are
# separated by `yield` inside lifespan() and there is no per-request/app
# state object convenient to stash it on at this point in startup.
_tunnel_provider: CloudflareTunnelProvider | None = None


def _seed_email_event_assignments():
    """Insert any missing EmailEventAssignment rows at startup."""
    from app.database import SessionLocal
    from app.models.email_event_assignment import EVENT_TYPES, EmailEventAssignment

    db = SessionLocal()
    try:
        existing = {r.event_type for r in db.query(EmailEventAssignment).all()}
        for et in EVENT_TYPES:
            if et not in existing:
                db.add(EmailEventAssignment(event_type=et, template_id=None))
        db.commit()
    finally:
        db.close()


def _seed_sms_event_assignments():
    """Insert any missing SmsEventAssignment rows at startup."""
    from app.database import SessionLocal
    from app.models.sms_event_assignment import EVENT_TYPES, SmsEventAssignment

    db = SessionLocal()
    try:
        existing = {r.event_type for r in db.query(SmsEventAssignment).all()}
        for et in EVENT_TYPES:
            if et not in existing:
                db.add(SmsEventAssignment(event_type=et, template_id=None))
        db.commit()
    finally:
        db.close()


def _tunnel_enabled() -> bool:
    """Whether the Cloudflare tunnel should actually be started this run.

    Mirrors the AGON_ENV-gate mechanism already used for rate limiting in
    app/limiter.py (read directly from os.environ, default "development"),
    but the condition is intentionally broader: tunnel startup spawns a real
    subprocess and opens a public internet-facing URL, which must never
    happen during automated tests (pytest would spawn `cloudflared` on every
    `TestClient(app)` lifespan startup — hundreds of times per run) and
    should not happen silently during ordinary local development either. It
    only runs when AGON_ENV is explicitly set to something else (e.g.
    "production").
    """
    return os.environ.get("AGON_ENV", "development") not in ("test", "development")


async def _start_tunnel() -> None:
    """Start the Cloudflare Quick Tunnel and register it with the directory Worker.

    Best-effort end to end: a missing `cloudflared` binary, a timeout
    waiting for the assigned URL, a missing StudioSettings row, or a
    directory-worker registration failure are all logged and swallowed here
    (register_with_directory already swallows its own failures) so nothing
    in this step can prevent the backend from serving LAN traffic.
    """
    global _tunnel_provider
    if not _tunnel_enabled():
        return

    from app.database import SessionLocal
    from app.models.studio_settings import StudioSettings

    provider = CloudflareTunnelProvider()
    try:
        tunnel_url = await provider.start()
    except Exception:
        _main_logger.warning(
            "Cloudflare tunnel failed to start; public widget/reset-password "
            "links will not be available this session.",
            exc_info=True,
        )
        return

    _tunnel_provider = provider

    db = SessionLocal()
    try:
        studio_settings = db.query(StudioSettings).filter(StudioSettings.id == 1).first()
        if studio_settings is None:
            _main_logger.warning(
                "No StudioSettings row found; skipping directory-worker registration."
            )
            return
        studio_settings.tunnel_url = tunnel_url
        db.commit()
        db.refresh(studio_settings)
        public_studio_id = studio_settings.public_studio_id
        directory_secret = studio_settings.directory_secret
    finally:
        db.close()

    await register_with_directory(public_studio_id, tunnel_url, directory_secret)


async def _stop_tunnel() -> None:
    global _tunnel_provider
    if _tunnel_provider is not None:
        await _tunnel_provider.stop()
        _tunnel_provider = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.config import settings

    configure_logging(settings.LOG_LEVEL)
    create_tables()
    _seed_email_event_assignments()
    _seed_sms_event_assignments()
    await _start_tunnel()
    tasks = [
        asyncio.create_task(run_waitlist_expiry_loop()),
        asyncio.create_task(run_membership_expiry_loop()),
        asyncio.create_task(run_class_reminder_loop()),
        asyncio.create_task(run_nightly_backup_loop()),
    ]
    yield
    await _stop_tunnel()
    for t in tasks:
        t.cancel()
    for t in tasks:
        try:
            await t
        except asyncio.CancelledError:
            pass


app = FastAPI(title="Agon API", version="0.1.0", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server (Electron renderer)
        "http://localhost:4173",  # Vite preview
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(studio.router)
app.include_router(clients.router)
app.include_router(instructors.router)
app.include_router(class_templates.router)
app.include_router(classes.router)
app.include_router(bookings.router)
app.include_router(appointment_services.router)
app.include_router(instructor_availability.router)
app.include_router(appointments.router)
app.include_router(calendar_sync.router)
app.include_router(checkins.router)
app.include_router(membership_types.router)
app.include_router(memberships.router)
app.include_router(payments.router)
app.include_router(promo_codes.router)
app.include_router(gift_cards.router)
app.include_router(stripe_billing.router)
app.include_router(notifications.router)
app.include_router(reports.router)
app.include_router(gdpr.router)
app.include_router(migration.router)
app.include_router(photos.router)
app.include_router(support.router)
app.include_router(email_settings.router)
app.include_router(email_templates.router)
app.include_router(email_events.router)
app.include_router(sms_settings.router)
app.include_router(sms_templates.router)
app.include_router(sms_events.router)
app.include_router(sms_send.router)
app.include_router(smart_lists.router)
app.include_router(locations.router)
app.include_router(tags.router)
app.include_router(waivers.router)
app.include_router(agent.router)
app.include_router(widget.router)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
