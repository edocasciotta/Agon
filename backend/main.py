import asyncio
from contextlib import asynccontextmanager

from app.database import create_tables
from app.limiter import limiter
from app.logging_config import configure_logging
from app.routers import (
    agent,
)
from app.routers import auth as auth_router
from app.routers import (
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
    instructors,
    locations,
    membership_types,
    memberships,
    migration,
    notifications,
    payments,
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
)
from app.tasks.class_reminders import run_class_reminder_loop
from app.tasks.membership_expiry import run_membership_expiry_loop
from app.tasks.nightly_backup import run_nightly_backup_loop
from app.tasks.waitlist_expiry import run_waitlist_expiry_loop
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded


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


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.config import settings

    configure_logging(settings.LOG_LEVEL)
    create_tables()
    _seed_email_event_assignments()
    _seed_sms_event_assignments()
    tasks = [
        asyncio.create_task(run_waitlist_expiry_loop()),
        asyncio.create_task(run_membership_expiry_loop()),
        asyncio.create_task(run_class_reminder_loop()),
        asyncio.create_task(run_nightly_backup_loop()),
    ]
    yield
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
app.include_router(agent.router)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
