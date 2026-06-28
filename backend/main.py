import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.database import create_tables
from app.limiter import limiter
from app.tasks.waitlist_expiry import run_waitlist_expiry_loop
from app.tasks.membership_expiry import run_membership_expiry_loop
from app.tasks.class_reminders import run_class_reminder_loop
from app.tasks.nightly_backup import run_nightly_backup_loop


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
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

from app.routers import auth as auth_router
app.include_router(auth_router.router)

from app.routers import studio, clients, instructors, class_templates, classes
app.include_router(studio.router)
app.include_router(clients.router)
app.include_router(instructors.router)
app.include_router(class_templates.router)
app.include_router(classes.router)

from app.routers import bookings
app.include_router(bookings.router)

from app.routers import checkins
app.include_router(checkins.router)

from app.routers import membership_types, memberships, payments
app.include_router(membership_types.router)
app.include_router(memberships.router)
app.include_router(payments.router)

from app.routers import notifications
app.include_router(notifications.router)

from app.routers import reports, gdpr
app.include_router(reports.router)
app.include_router(gdpr.router)

from app.routers import migration
app.include_router(migration.router)

from app.routers import support
app.include_router(support.router)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
