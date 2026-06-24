# Agon — Technical Specification
*Version 1.0 — June 2026*
*Covers: V1 (Fitness Studio, single location)*

---

## 1. Overview

This document describes how Agon is built internally. It defines the database schema, API endpoints, folder structure, and contracts between modules. It is the primary reference for all development agents.

Read `PRODUCT_SPEC.md` first to understand what the system does before reading this document to understand how it does it.

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Studio Manager PC                   │
│                                                     │
│  ┌──────────────┐      ┌───────────────────────┐   │
│  │   Electron   │ HTTP │      FastAPI           │   │
│  │   + React    │─────▶│   localhost:8000       │   │
│  │   (UI)       │      │   (Backend server)     │   │
│  └──────────────┘      └──────────┬────────────┘   │
│                                   │                  │
│                         ┌─────────▼──────────┐      │
│                         │   SQLite database  │      │
│                         │   agon.db          │      │
│                         └────────────────────┘      │
│                                   │                  │
│                         ┌─────────▼──────────┐      │
│                         │  Cloudflare Tunnel │      │
│                         │  (cloudflared)     │      │
│                         └─────────┬──────────┘      │
└───────────────────────────────────┼─────────────────┘
                                    │ HTTPS
                          ┌─────────▼──────────┐
                          │  Cloudflare Edge   │
                          └─────────┬──────────┘
                                    │ HTTPS
                    ┌───────────────▼────────────────┐
                    │        Mobile App              │
                    │     React Native (Expo)        │
                    └────────────────────────────────┘
```

**Communication flow:**
- Electron UI communicates with FastAPI via HTTP on localhost:8000
- FastAPI reads and writes to SQLite
- Cloudflare Tunnel exposes the FastAPI server to the internet via a unique HTTPS URL
- The mobile app communicates with FastAPI via that public HTTPS URL
- Push notifications are sent from FastAPI to Expo Push Service, which delivers to devices

---

## 3. Folder Structure

```
agon/
├── CLAUDE.md                          # Orchestrator agent instructions
├── SPEC.md                            # Entry point, links to docs/
├── README.md
├── LICENSE                            # AGPL v3
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── ROADMAP.md
│
├── docs/
│   ├── agon_project_bible.md
│   ├── PRODUCT_SPEC.md
│   └── TECHNICAL_SPEC.md
│
├── backend/
│   ├── CLAUDE.md                      # Backend agent instructions
│   ├── main.py                        # FastAPI app entry point
│   ├── requirements.txt
│   ├── alembic.ini                    # Database migration config
│   ├── alembic/
│   │   └── versions/                  # Migration files
│   ├── app/
│   │   ├── __init__.py
│   │   ├── config.py                  # Environment config
│   │   ├── database.py                # SQLite connection and session
│   │   ├── auth.py                    # JWT logic
│   │   ├── tunnel.py                  # Cloudflare Tunnel interface
│   │   ├── backup.py                  # Backup logic
│   │   ├── notifications.py           # Expo push notification sender
│   │   ├── models/                    # SQLAlchemy models
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── client.py
│   │   │   ├── instructor.py
│   │   │   ├── class_template.py
│   │   │   ├── scheduled_class.py
│   │   │   ├── booking.py
│   │   │   ├── waitlist.py
│   │   │   ├── membership_type.py
│   │   │   ├── membership.py
│   │   │   ├── payment.py
│   │   │   ├── checkin.py
│   │   │   └── notification_log.py
│   │   ├── schemas/                   # Pydantic request/response schemas
│   │   │   ├── __init__.py
│   │   │   └── (mirrors models/)
│   │   └── routers/                   # FastAPI routers
│   │       ├── __init__.py
│   │       ├── auth.py
│   │       ├── studio.py
│   │       ├── clients.py
│   │       ├── instructors.py
│   │       ├── classes.py
│   │       ├── bookings.py
│   │       ├── checkins.py
│   │       ├── memberships.py
│   │       ├── payments.py
│   │       ├── reports.py
│   │       ├── notifications.py
│   │       ├── gdpr.py
│   │       └── settings.py
│   └── tests/
│       ├── conftest.py
│       ├── test_auth.py
│       ├── test_classes.py
│       ├── test_bookings.py
│       ├── test_checkins.py
│       ├── test_memberships.py
│       └── test_payments.py
│
├── frontend/
│   ├── CLAUDE.md                      # Frontend agent instructions
│   ├── package.json
│   ├── electron/
│   │   ├── main.js                    # Electron main process
│   │   ├── preload.js
│   │   └── updater.js                 # Auto-update logic
│   ├── src/
│   │   ├── main.tsx                   # React entry point
│   │   ├── App.tsx
│   │   ├── api/                       # API client functions
│   │   │   └── (one file per router)
│   │   ├── components/                # Reusable UI components
│   │   ├── pages/                     # Full page views
│   │   │   ├── Onboarding/
│   │   │   ├── Dashboard/
│   │   │   ├── Calendar/
│   │   │   ├── Clients/
│   │   │   ├── Instructors/
│   │   │   ├── Memberships/
│   │   │   ├── Reports/
│   │   │   ├── Settings/
│   │   │   └── GDPR/
│   │   ├── store/                     # State management (Zustand)
│   │   └── types/                     # TypeScript types
│   └── tests/
│       ├── unit/
│       └── e2e/
│
├── mobile/
│   ├── CLAUDE.md                      # Mobile agent instructions
│   ├── package.json
│   ├── app.json                       # Expo config
│   ├── src/
│   │   ├── api/                       # API client functions
│   │   ├── components/
│   │   ├── screens/
│   │   │   ├── Onboarding/
│   │   │   ├── Home/
│   │   │   ├── Classes/
│   │   │   ├── Bookings/
│   │   │   ├── CheckIn/
│   │   │   ├── Membership/
│   │   │   ├── Profile/
│   │   │   └── Notifications/
│   │   ├── store/                     # State management (Zustand)
│   │   ├── notifications.ts           # Expo push notification setup
│   │   └── types/
│   └── tests/
│
└── docs-site/
    ├── CLAUDE.md                      # Documentation agent instructions
    ├── package.json
    ├── docusaurus.config.js
    └── docs/
        └── (generated by documentation agent)
```

---

## 4. Database Schema

All tables include `created_at` and `updated_at` timestamps. All tables include `location_id` (INTEGER, default 1) for V2 multi-location compatibility. The default location is always 1 for V1.

### 4.1 users
The Studio Manager and Instructor accounts.

```sql
CREATE TABLE users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id     INTEGER NOT NULL DEFAULT 1,
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    full_name       TEXT NOT NULL,
    role            TEXT NOT NULL CHECK (role IN ('manager', 'instructor')),
    is_active       BOOLEAN NOT NULL DEFAULT 1,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 4.2 studio_settings
Single-row table containing studio configuration.

```sql
CREATE TABLE studio_settings (
    id                              INTEGER PRIMARY KEY DEFAULT 1,
    location_id                     INTEGER NOT NULL DEFAULT 1,
    studio_name                     TEXT NOT NULL,
    address                         TEXT,
    timezone                        TEXT NOT NULL DEFAULT 'Europe/Rome',
    logo_path                       TEXT,
    cancellation_hours              INTEGER NOT NULL DEFAULT 2,
    cancellation_deducts_credit     BOOLEAN NOT NULL DEFAULT 0,
    checkin_open_minutes_before     INTEGER NOT NULL DEFAULT 30,
    checkin_close_minutes_after     INTEGER NOT NULL DEFAULT 15,
    waitlist_confirm_minutes        INTEGER NOT NULL DEFAULT 30,
    guest_bookings_enabled          BOOLEAN NOT NULL DEFAULT 0,
    self_service_purchases_enabled  BOOLEAN NOT NULL DEFAULT 1,
    reminder_hours_before           INTEGER NOT NULL DEFAULT 2,
    stripe_account_id               TEXT,
    stripe_connected                BOOLEAN NOT NULL DEFAULT 0,
    backup_provider                 TEXT CHECK (backup_provider IN ('google_drive', 'dropbox', 'local', NULL)),
    backup_token                    TEXT,
    last_backup_at                  DATETIME,
    tunnel_url                      TEXT,
    created_at                      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 4.3 clients
Studio clients who book classes via the mobile app.

```sql
CREATE TABLE clients (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id     INTEGER NOT NULL DEFAULT 1,
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    full_name       TEXT NOT NULL,
    phone           TEXT,
    date_of_birth   DATE,
    photo_path      TEXT,
    notes           TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT 1,
    expo_push_token TEXT,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 4.4 consent_log
GDPR consent records for clients.

```sql
CREATE TABLE consent_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id       INTEGER NOT NULL REFERENCES clients(id),
    document_type   TEXT NOT NULL CHECK (document_type IN ('privacy_policy', 'terms_of_service')),
    document_version TEXT NOT NULL,
    accepted_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address      TEXT
);
```

### 4.5 instructors
Instructor profiles (linked to users table).

```sql
CREATE TABLE instructors (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id     INTEGER NOT NULL DEFAULT 1,
    user_id         INTEGER NOT NULL UNIQUE REFERENCES users(id),
    bio             TEXT,
    photo_path      TEXT,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 4.6 class_templates
Reusable class definitions.

```sql
CREATE TABLE class_templates (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id         INTEGER NOT NULL DEFAULT 1,
    name                TEXT NOT NULL,
    description         TEXT,
    duration_minutes    INTEGER NOT NULL DEFAULT 60,
    default_capacity    INTEGER NOT NULL DEFAULT 20,
    default_instructor_id INTEGER REFERENCES instructors(id),
    color               TEXT NOT NULL DEFAULT '#4F46E5',
    is_active           BOOLEAN NOT NULL DEFAULT 1,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 4.7 scheduled_classes
Individual class instances on the calendar.

```sql
CREATE TABLE scheduled_classes (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id         INTEGER NOT NULL DEFAULT 1,
    template_id         INTEGER NOT NULL REFERENCES class_templates(id),
    instructor_id       INTEGER REFERENCES instructors(id),
    starts_at           DATETIME NOT NULL,
    ends_at             DATETIME NOT NULL,
    capacity            INTEGER NOT NULL,
    status              TEXT NOT NULL DEFAULT 'scheduled'
                        CHECK (status IN ('scheduled', 'cancelled', 'completed')),
    recurrence_group_id TEXT,
    notes               TEXT,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 4.8 bookings

```sql
CREATE TABLE bookings (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id         INTEGER NOT NULL DEFAULT 1,
    client_id           INTEGER NOT NULL REFERENCES clients(id),
    scheduled_class_id  INTEGER NOT NULL REFERENCES scheduled_classes(id),
    status              TEXT NOT NULL DEFAULT 'confirmed'
                        CHECK (status IN ('confirmed', 'cancelled', 'no_show')),
    cancelled_at        DATETIME,
    cancellation_reason TEXT,
    credit_deducted     BOOLEAN NOT NULL DEFAULT 0,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (client_id, scheduled_class_id)
);
```

### 4.9 waitlist

```sql
CREATE TABLE waitlist (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id         INTEGER NOT NULL DEFAULT 1,
    client_id           INTEGER NOT NULL REFERENCES clients(id),
    scheduled_class_id  INTEGER NOT NULL REFERENCES scheduled_classes(id),
    position            INTEGER NOT NULL,
    status              TEXT NOT NULL DEFAULT 'waiting'
                        CHECK (status IN ('waiting', 'offered', 'confirmed', 'expired', 'declined')),
    offered_at          DATETIME,
    offer_expires_at    DATETIME,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (client_id, scheduled_class_id)
);
```

### 4.10 membership_types

```sql
CREATE TABLE membership_types (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id             INTEGER NOT NULL DEFAULT 1,
    name                    TEXT NOT NULL,
    description             TEXT,
    type                    TEXT NOT NULL CHECK (type IN ('recurring', 'credit_pack')),
    price                   REAL NOT NULL,
    currency                TEXT NOT NULL DEFAULT 'EUR',
    billing_interval        TEXT CHECK (billing_interval IN ('weekly', 'monthly', 'annual')),
    credits_included        INTEGER,
    credits_per_interval    INTEGER,
    unlimited               BOOLEAN NOT NULL DEFAULT 0,
    validity_days           INTEGER,
    can_pause               BOOLEAN NOT NULL DEFAULT 0,
    max_pause_days          INTEGER,
    applicable_class_types  TEXT,
    is_active               BOOLEAN NOT NULL DEFAULT 1,
    created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 4.11 memberships
Client membership instances.

```sql
CREATE TABLE memberships (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id             INTEGER NOT NULL DEFAULT 1,
    client_id               INTEGER NOT NULL REFERENCES clients(id),
    membership_type_id      INTEGER NOT NULL REFERENCES membership_types(id),
    status                  TEXT NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'expired', 'cancelled',
                                              'paused', 'payment_overdue')),
    starts_at               DATE NOT NULL,
    expires_at              DATE,
    credits_remaining       INTEGER,
    credits_used            INTEGER NOT NULL DEFAULT 0,
    paused_at               DATETIME,
    pause_ends_at           DATETIME,
    stripe_subscription_id  TEXT,
    created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 4.12 payments

```sql
CREATE TABLE payments (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id             INTEGER NOT NULL DEFAULT 1,
    client_id               INTEGER NOT NULL REFERENCES clients(id),
    membership_id           INTEGER REFERENCES memberships(id),
    amount                  REAL NOT NULL,
    currency                TEXT NOT NULL DEFAULT 'EUR',
    status                  TEXT NOT NULL CHECK (status IN ('pending', 'completed',
                                                             'failed', 'refunded')),
    provider                TEXT NOT NULL CHECK (provider IN ('stripe', 'manual')),
    provider_payment_id     TEXT,
    provider_invoice_id     TEXT,
    notes                   TEXT,
    paid_at                 DATETIME,
    created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 4.13 checkins

```sql
CREATE TABLE checkins (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id         INTEGER NOT NULL DEFAULT 1,
    booking_id          INTEGER NOT NULL UNIQUE REFERENCES bookings(id),
    client_id           INTEGER NOT NULL REFERENCES clients(id),
    scheduled_class_id  INTEGER NOT NULL REFERENCES scheduled_classes(id),
    method              TEXT NOT NULL CHECK (method IN ('app', 'qr', 'manual')),
    checked_in_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    checked_in_by       INTEGER REFERENCES users(id)
);
```

### 4.14 notification_log

```sql
CREATE TABLE notification_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id       INTEGER NOT NULL REFERENCES clients(id),
    type            TEXT NOT NULL,
    title           TEXT NOT NULL,
    body            TEXT NOT NULL,
    status          TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
    expo_ticket_id  TEXT,
    sent_at         DATETIME,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

---

## 5. Authentication

### 5.1 Studio Manager and Instructor (Desktop App)

JWT-based authentication. Tokens are stored in memory by the Electron renderer process — not in localStorage, not on disk.

- Access token: 8 hours expiry
- Refresh token: 30 days expiry, stored in an encrypted file on disk
- All protected routes require `Authorization: Bearer <token>` header

### 5.2 Client (Mobile App)

Same JWT mechanism. Tokens are stored in Expo SecureStore.

- Access token: 30 days expiry
- Refresh token: 90 days expiry

### 5.3 Token Refresh

When an access token expires, the client sends the refresh token to `POST /auth/refresh`. The server returns a new access token. If the refresh token is also expired, the user is logged out.

---

## 6. API Endpoints

All endpoints are prefixed with `/api/v1`.
All responses are JSON.
All protected endpoints require a valid JWT.
Dates are ISO 8601 format: `2026-06-24T10:00:00Z`.

### 6.1 Auth

```
POST   /auth/register/client          Register new client (mobile only)
POST   /auth/login                    Login (all users)
POST   /auth/refresh                  Refresh access token
POST   /auth/logout                   Invalidate refresh token
POST   /auth/forgot-password          Request password reset email
POST   /auth/reset-password           Reset password with token
```

### 6.2 Studio

```
GET    /studio                        Get studio profile and settings
PUT    /studio                        Update studio profile (manager only)
GET    /studio/status                 Get tunnel status, backup status
POST   /studio/backup                 Trigger manual backup (manager only)
```

### 6.3 Onboarding

```
GET    /onboarding/status             Check onboarding completion status
POST   /onboarding/complete           Mark onboarding as complete
GET    /onboarding/qr                 Get client onboarding QR code data
```

### 6.4 Users (Studio Manager and Instructors)

```
GET    /users                         List all staff users (manager only)
POST   /users                         Create instructor account (manager only)
GET    /users/{id}                    Get user profile
PUT    /users/{id}                    Update user profile
DELETE /users/{id}                    Deactivate user (manager only)
PUT    /users/{id}/password           Change password
```

### 6.5 Clients

```
GET    /clients                       List clients (manager/instructor)
GET    /clients/{id}                  Get client profile (manager/instructor)
PUT    /clients/{id}                  Update client profile (manager)
DELETE /clients/{id}                  Anonymize client data (GDPR, manager only)
GET    /clients/{id}/bookings         Get client booking history
GET    /clients/{id}/memberships      Get client memberships
GET    /clients/{id}/payments         Get client payment history
GET    /clients/me                    Get own profile (client)
PUT    /clients/me                    Update own profile (client)
PUT    /clients/me/push-token         Update Expo push token (client)
```

### 6.6 Instructors

```
GET    /instructors                   List instructors (all authenticated)
POST   /instructors                   Create instructor profile (manager)
GET    /instructors/{id}              Get instructor profile
PUT    /instructors/{id}              Update instructor profile (manager)
```

### 6.7 Class Templates

```
GET    /class-templates               List all active templates
POST   /class-templates               Create template (manager only)
GET    /class-templates/{id}          Get template
PUT    /class-templates/{id}          Update template (manager only)
DELETE /class-templates/{id}          Deactivate template (manager only)
```

### 6.8 Scheduled Classes

```
GET    /classes                       List classes (query: start_date, end_date,
                                      instructor_id, template_id, status)
POST   /classes                       Schedule a class (manager only)
POST   /classes/recurring             Schedule recurring classes (manager only)
GET    /classes/{id}                  Get class details
PUT    /classes/{id}                  Update class (manager only)
DELETE /classes/{id}                  Cancel class (manager only)
GET    /classes/{id}/roster           Get booked clients for a class
GET    /classes/{id}/waitlist         Get waitlist for a class
POST   /classes/{id}/complete         Mark class as completed (manager/instructor)
```

### 6.9 Bookings

```
GET    /bookings                      List bookings (manager: all, client: own)
POST   /bookings                      Create booking (client: own, manager: any)
GET    /bookings/{id}                 Get booking details
DELETE /bookings/{id}                 Cancel booking
POST   /bookings/{id}/waitlist        Join waitlist for full class
DELETE /bookings/{id}/waitlist        Leave waitlist
POST   /bookings/waitlist/{id}/confirm Confirm waitlist offer (client)
```

### 6.10 Check-Ins

```
POST   /checkins                      Check in (method: app, qr, manual)
GET    /checkins/class/{class_id}     Get all check-ins for a class
GET    /checkins/qr/{booking_id}      Generate QR code data for check-in
```

### 6.11 Membership Types

```
GET    /membership-types              List all active membership types
POST   /membership-types             Create membership type (manager only)
GET    /membership-types/{id}         Get membership type
PUT    /membership-types/{id}         Update membership type (manager only)
DELETE /membership-types/{id}         Deactivate membership type (manager only)
```

### 6.12 Memberships

```
GET    /memberships                   List memberships (manager: all, client: own)
POST   /memberships                   Assign membership (manager: any client,
                                      client: self-purchase if enabled)
GET    /memberships/{id}              Get membership details
PUT    /memberships/{id}              Update membership (manager only)
DELETE /memberships/{id}              Cancel membership (manager only)
POST   /memberships/{id}/pause        Request membership pause
POST   /memberships/{id}/resume       Resume paused membership
```

### 6.13 Payments

```
GET    /payments                      List payments (manager: all, client: own)
POST   /payments                      Record manual payment (manager only)
GET    /payments/{id}                 Get payment details
POST   /payments/{id}/refund          Issue refund (manager only)
POST   /payments/stripe/webhook       Stripe webhook receiver (no auth required)
POST   /payments/stripe/checkout      Create Stripe checkout session (client)
```

### 6.14 Reports

```
GET    /reports/attendance            Attendance report (manager only)
GET    /reports/revenue               Revenue report (manager only)
GET    /reports/memberships           Membership report (manager only)
GET    /reports/retention             Client retention report (manager only)
GET    /reports/attendance/export     Export attendance as CSV (manager only)
GET    /reports/revenue/export        Export revenue as CSV (manager only)
```

### 6.15 Notifications

```
GET    /notifications                 Get notification history (client: own)
POST   /notifications/send            Send push notification (manager only)
PUT    /notifications/{id}/read       Mark notification as read (client)
```

### 6.16 GDPR

```
GET    /gdpr/export/{client_id}       Request data export (manager or own client)
POST   /gdpr/delete/{client_id}       Request account deletion (manager or own client)
GET    /gdpr/consent-log/{client_id}  Get consent log (manager or own client)
POST   /gdpr/consent                  Record consent (client)
```

### 6.17 Settings

```
GET    /settings                      Get all settings (manager only)
PUT    /settings                      Update settings (manager only)
POST   /settings/stripe/connect       Initiate Stripe OAuth connection
POST   /settings/stripe/disconnect    Disconnect Stripe account
POST   /settings/backup/connect       Connect cloud backup provider
POST   /settings/backup/disconnect    Disconnect cloud backup provider
GET    /settings/tunnel               Get tunnel URL and status
POST   /settings/tunnel/restart       Restart Cloudflare Tunnel
```

---

## 7. Business Logic Rules

### 7.1 Booking Creation
1. Client must have an active membership or credits, OR guest bookings must be enabled
2. Class status must be 'scheduled'
3. Class must not have started yet
4. Available spots = class capacity - confirmed bookings count
5. If available spots = 0, return 409 with waitlist option
6. If client already has a booking for this class, return 409
7. On success, deduct one credit from membership if applicable
8. On success, send booking confirmation push notification

### 7.2 Booking Cancellation
1. Calculate hours until class start from now
2. If hours < cancellation_hours setting AND client is cancelling (not manager): proceed but apply late cancellation policy
3. If late cancellation AND cancellation_deducts_credit = true: do not refund the credit
4. If cancellation is within policy: refund credit to membership if one was deducted
5. Set booking status to 'cancelled'
6. Send cancellation push notification to client
7. Trigger waitlist processing (see 7.3)

### 7.3 Waitlist Processing
1. Find the first waitlist entry with status 'waiting' ordered by position
2. Set status to 'offered', set offered_at to now, set offer_expires_at to now + waitlist_confirm_minutes
3. Send push notification to client: "A spot has opened in [class name]. You have X minutes to confirm."
4. Schedule a background task to expire the offer after waitlist_confirm_minutes
5. When offer expires without confirmation: set status to 'expired', repeat from step 1 with next entry
6. When client confirms: create a booking, deduct credit, set waitlist status to 'confirmed'

### 7.4 Check-In Validation
1. Find booking by client_id + scheduled_class_id
2. Booking status must be 'confirmed'
3. Current time must be within check-in window (starts_at - checkin_open_minutes_before) to (starts_at + checkin_close_minutes_after)
4. Client must have an active membership (re-validate at check-in time)
5. If all pass: create checkin record, update booking status to 'confirmed' (already is)
6. Return success with client name for display at reception

### 7.5 Recurring Class Creation
1. Validate recurrence rule (days of week, end date or count)
2. Generate all instances within the range
3. Assign a shared recurrence_group_id (UUID) to all instances
4. Create each instance individually in the database
5. Return count of created instances

### 7.6 Class Cancellation
1. Set class status to 'cancelled'
2. Find all confirmed bookings for this class
3. For each booking: set status to 'cancelled', refund credit if one was deducted
4. For each booking: send push notification "Class [name] on [date] has been cancelled"
5. Clear the waitlist for this class

---

## 8. Background Tasks

Background tasks run as async processes managed by FastAPI's lifespan context.

### 8.1 Waitlist Expiry Checker
Runs every 5 minutes. Finds all waitlist entries with status 'offered' and offer_expires_at in the past. Expires them and triggers the next offer.

### 8.2 Membership Expiry Checker
Runs daily at 00:05 studio local time. Finds memberships expiring in 7 days and sends reminder push notifications. Finds memberships that expired today and sets status to 'expired'.

### 8.3 Class Reminder Sender
Runs every 15 minutes. Finds classes starting in the next (reminder_hours_before setting + 0.25) hours that haven't had reminders sent. Sends reminder push notifications to all confirmed bookings. Marks reminders as sent.

### 8.4 Nightly Backup
Runs daily at 03:00 studio local time. Copies the SQLite database file to the backup location (local folder and/or cloud provider). Retains last 30 daily backups. Updates last_backup_at in studio_settings.

### 8.5 Discovery Service Heartbeat
Runs every 5 minutes. Sends the studio's current tunnel URL to the Cloudflare Worker discovery service. This keeps the directory entry fresh.

### 8.6 Stripe Webhook Retry Recovery
Runs daily at 06:00. Checks for memberships with stripe_subscription_id that have status 'payment_overdue' and queries Stripe API to verify current payment status. Updates accordingly.

---

## 9. Tunnel Interface

The tunnel provider is abstracted behind a Python interface. This makes it replaceable without touching the rest of the system.

```python
class TunnelProvider(ABC):
    @abstractmethod
    async def start(self) -> str:
        """Start the tunnel and return the public URL."""
        pass

    @abstractmethod
    async def stop(self) -> None:
        pass

    @abstractmethod
    async def get_url(self) -> Optional[str]:
        pass

    @abstractmethod
    async def is_running(self) -> bool:
        pass
```

V1 implements `CloudflareTunnelProvider`. The implementation spawns `cloudflared tunnel --url localhost:8000` as a subprocess and parses the assigned URL from its stdout.

A `VPSRelayProvider` class is documented as a future alternative implementation. It is not implemented in V1.

---

## 10. Push Notifications

Push notifications are sent via the Expo Push Notification API.

```python
async def send_push_notification(
    expo_push_token: str,
    title: str,
    body: str,
    data: dict = {}
) -> str:
    """
    Send a push notification via Expo.
    Returns the Expo ticket ID.
    Logs the notification in notification_log table.
    """
```

All sent notifications are logged in the `notification_log` table with their Expo ticket ID for delivery status tracking.

---

## 11. Error Responses

All errors follow this format:

```json
{
    "error": {
        "code": "BOOKING_CLASS_FULL",
        "message": "This class is full. Would you like to join the waitlist?",
        "details": {}
    }
}
```

### Error Codes

```
AUTH_INVALID_CREDENTIALS
AUTH_TOKEN_EXPIRED
AUTH_TOKEN_INVALID
AUTH_INSUFFICIENT_PERMISSIONS

BOOKING_CLASS_FULL
BOOKING_ALREADY_EXISTS
BOOKING_CLASS_STARTED
BOOKING_CANCELLATION_WINDOW_PASSED
BOOKING_NO_VALID_MEMBERSHIP

CHECKIN_NO_BOOKING
CHECKIN_OUTSIDE_WINDOW
CHECKIN_ALREADY_CHECKED_IN

MEMBERSHIP_EXPIRED
MEMBERSHIP_NO_CREDITS

PAYMENT_FAILED
PAYMENT_PROVIDER_ERROR

STUDIO_TUNNEL_OFFLINE
STUDIO_BACKUP_FAILED

VALIDATION_ERROR
NOT_FOUND
SERVER_ERROR
```

---

## 12. Security

### 12.1 Password Storage
All passwords are hashed using bcrypt with a cost factor of 12. Plain text passwords are never stored or logged.

### 12.2 Database Encryption
The SQLite database is encrypted using SQLCipher. The encryption key is derived from a secret generated at first installation and stored in the OS keychain (Windows Credential Manager, macOS Keychain, Linux Secret Service).

### 12.3 HTTPS
All external traffic (between mobile app and studio server) passes through the Cloudflare Tunnel, which enforces HTTPS. Local traffic (between Electron and FastAPI on localhost) is HTTP — this is acceptable since it never leaves the machine.

### 12.4 JWT Security
JWT secrets are generated at first installation (256-bit random). They are stored in the OS keychain, not in a config file. Tokens are signed with HS256.

### 12.5 Stripe Webhook Verification
All incoming Stripe webhooks are verified using the Stripe webhook signing secret before processing.

### 12.6 Rate Limiting
The following endpoints are rate-limited:
- `POST /auth/login`: 10 requests per minute per IP
- `POST /auth/forgot-password`: 3 requests per hour per email
- `POST /auth/register/client`: 5 requests per minute per IP

---

## 13. Testing Requirements

Every development agent must follow these rules:

1. Every new endpoint must have at least one happy-path test and one error-path test in `backend/tests/`
2. Every new React component must have at least one unit test in `frontend/tests/unit/`
3. Every complete user flow must have an end-to-end test in `frontend/tests/e2e/`
4. Tests must run and pass before any code is considered complete
5. Test coverage for business logic functions (booking, check-in, waitlist) must be above 90%

CI runs on every commit via GitHub Actions. A failing test blocks the commit from being merged.

---

## 14. API Versioning

All endpoints are versioned under `/api/v1/`. When breaking changes are introduced in V2, they will be available under `/api/v2/` while `/api/v1/` remains active for a deprecation period. The mobile app version and the desktop app version communicate their API version in the `X-Agon-Client-Version` header on every request. The server logs version mismatches for monitoring purposes.

---

## 15. Environment Configuration

Backend configuration is managed via a `.env` file (not committed to the repository) and loaded via `python-dotenv`.

```env
# Generated at first installation — never change manually
AGON_SECRET_KEY=<256-bit random hex>
AGON_JWT_SECRET=<256-bit random hex>
DATABASE_URL=sqlite:///./agon.db
DATABASE_ENCRYPTION_KEY=<retrieved from OS keychain>

# Set during onboarding
STUDIO_TIMEZONE=Europe/Rome
STRIPE_WEBHOOK_SECRET=<from Stripe dashboard>

# Cloudflare
CLOUDFLARE_TUNNEL_TOKEN=<generated at setup>

# Expo
EXPO_ACCESS_TOKEN=<from Expo dashboard>

# Environment
AGON_ENV=production
LOG_LEVEL=INFO
```

---

*This document describes how Agon is built. For what it does, see `PRODUCT_SPEC.md`.*

---

## 16. Migration System

### 16.1 Migration Assistant Architecture

The migration assistant is powered by the same LLM used for the AI support agent, with a dedicated system prompt focused on data migration. It operates as a multi-step conversational flow inside the desktop application.

The assistant has two distinct capabilities:

**Guidance mode** — answers questions about how to export data from specific platforms, generates template emails for GDPR data portability requests, and explains what to expect from each platform. This mode requires no file access and uses only the documentation knowledge base.

**Import mode** — receives uploaded files, analyses their structure, maps columns to Agon's schema, previews the import, and executes it after confirmation. This mode interacts directly with the database via internal API calls.

### 16.2 New API Endpoints

```
POST   /migration/analyse              Upload file, get column mapping preview
POST   /migration/confirm              Execute import after user confirmation
GET    /migration/status               Get current migration job status
GET    /migration/summary              Get completed migration summary
POST   /migration/invitations/send     Send invitation emails to imported clients
GET    /migration/invitations/export   Download invitation list as CSV
GET    /migration/templates/{type}     Download standard CSV template
                                       (type: clients | memberships | classes)
```

### 16.3 New Database Table: migration_jobs

```sql
CREATE TABLE migration_jobs (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id         INTEGER NOT NULL DEFAULT 1,
    source_platform     TEXT,
    status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'analysing', 'preview',
                                          'importing', 'completed', 'failed')),
    file_path           TEXT,
    file_format         TEXT,
    column_mapping      TEXT,
    records_total       INTEGER DEFAULT 0,
    records_imported    INTEGER DEFAULT 0,
    records_skipped     INTEGER DEFAULT 0,
    skipped_details     TEXT,
    invitations_sent    INTEGER DEFAULT 0,
    error_message       TEXT,
    started_at          DATETIME,
    completed_at        DATETIME,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 16.4 Import Logic Rules

**Client import:**
- Email is the unique identifier — duplicate emails are skipped with a reason logged
- Password is never imported — a temporary random token is generated for each client for the invitation flow
- If a client email already exists in the database, the record is skipped (not overwritten)

**Membership import:**
- Requires a matching client email already in the database (import clients first)
- Membership type is mapped by name — if no matching membership type exists in Agon, the record is skipped with a suggestion to create the membership type first
- Active memberships only are imported by default — expired memberships are optional

**Class import:**
- Only future classes are imported (starts_at > now)
- Instructor is matched by name — if no match found, class is imported without an instructor and flagged for manual assignment

### 16.5 Standard CSV Templates

**clients_template.csv columns:**
`full_name, email, phone, date_of_birth`

**memberships_template.csv columns:**
`client_email, membership_type_name, starts_at, expires_at, credits_remaining`

**classes_template.csv columns:**
`class_name, starts_at, ends_at, capacity, instructor_name`

### 16.6 Client Invitation Flow

After import, for each imported client:
1. Generate a unique invitation token (UUID, expires in 7 days)
2. Store token in a new `invitation_tokens` table linked to client_id
3. Build invitation URL: `https://{tunnel_url}/invite/{token}`
4. Send email via the studio's configured email provider OR export as CSV

```sql
CREATE TABLE invitation_tokens (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id   INTEGER NOT NULL REFERENCES clients(id),
    token       TEXT NOT NULL UNIQUE,
    used        BOOLEAN NOT NULL DEFAULT 0,
    expires_at  DATETIME NOT NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

New endpoint for token redemption:
```
GET    /auth/invite/{token}            Validate token, return client pre-fill data
POST   /auth/invite/{token}/complete   Set password and activate account
```
