from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import create_tables

app = FastAPI(title="Agon API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Router registrations (uncomment as phases are implemented)
# from app.routers import auth
# app.include_router(auth.router)
# from app.routers import clients
# app.include_router(clients.router)
# from app.routers import instructors
# app.include_router(instructors.router)
# from app.routers import class_templates
# app.include_router(class_templates.router)
# from app.routers import scheduled_classes
# app.include_router(scheduled_classes.router)
# from app.routers import bookings
# app.include_router(bookings.router)
# from app.routers import checkins
# app.include_router(checkins.router)
# from app.routers import memberships
# app.include_router(memberships.router)
# from app.routers import payments
# app.include_router(payments.router)
# from app.routers import reports
# app.include_router(reports.router)
# from app.routers import studio
# app.include_router(studio.router)
# from app.routers import migration
# app.include_router(migration.router)


@app.on_event("startup")
async def startup_event():
    create_tables()


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
