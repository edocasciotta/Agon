# Agon — Task Log
*Orchestrator coordination memory. Updated after every completed task.*

---

## Project Summary

**Agon** is a free, open-source, local-first fitness studio management platform licensed under AGPL v3. It replaces paid SaaS tools (BSport, Momence, etc.). Studio managers install it on their own computer or VPS; clients connect via a mobile app.

### Architecture
- **Desktop app**: Electron + React + TypeScript (wraps the backend)
- **Backend**: FastAPI + Python + SQLite (runs on localhost:8000)
- **Mobile**: React Native + Expo (connects to studio server via Cloudflare Tunnel)
- **Connectivity**: Cloudflare Tunnel (exposes FastAPI to internet, zero config)
- **Documentation**: Docusaurus (GitHub Pages)
- **LLM (dev)**: Ollama (local); **LLM (prod)**: Google Gemini Flash or Groq
- **License**: AGPL v3

### Key Constraints (Non-Negotiable)
1. No OpenAI API — use litellm with Ollama (dev) or Gemini/Groq (prod)
2. No code without tests (pytest / npm test)
3. No endpoint without a Docusaurus documentation page
4. No database change without an Alembic migration file
5. All data stays on the studio's machine — no external data transfer

### Database
14 tables: users, studio_settings, clients, consent_log, instructors, class_templates, scheduled_classes, bookings, waitlist, membership_types, memberships, payments, checkins, notification_log. Plus migration_jobs and invitation_tokens for Phase 8.

All tables include `created_at`, `updated_at`, and `location_id` (for V2 multi-location).

---

## Current Repository State

**Date assessed:** 2026-06-24

- Not yet a git repository (no `.git` directory)
- All 4 sub-directories exist but are empty except for their agent instruction files
- Agent instruction files are currently named `backend_CLAUDE.md`, `frontend_CLAUDE.md`, `mobile_CLAUDE.md`, `docs_CLAUDE.md` — these need to be renamed to `CLAUDE.md` in each directory before sub-agents will load them automatically

**No code has been written yet. Phase 0 has not started.**

---

## Build Order (from CLAUDE.md)

### Phase 0 — Project Scaffolding ✅ COMPLETE
- [x] 0.1 Rename agent instruction files to `CLAUDE.md` in each sub-directory
- [x] 0.2 Initialize git repository and create initial commit
- [x] 0.3 Initialize FastAPI project structure in `/backend` — FastAPI 0.111, SQLAlchemy 2.0, Pydantic v2, /health endpoint, pytest 1 test passing
- [x] 0.4 Initialize Electron + React project in `/frontend` — electron-vite, React 18, TypeScript, Vitest, Tailwind, TanStack Query, 1 test passing
- [x] 0.5 Initialize React Native + Expo project in `/mobile` — Expo SDK 51, Expo Router, Zustand, jest-expo, 1 test passing
- [x] 0.6 Initialize Docusaurus in `/docs-site` — Docusaurus 3 latest, full sidebar, getting-started docs, build succeeds
- [x] 0.7 Set up GitHub Actions CI pipeline — `.github/workflows/ci.yml` runs all three test suites on push
- [x] 0.8 Configure Alembic for database migrations — `alembic.ini`, `alembic/env.py` with Base.metadata wired

### Phase 1 — Database and Authentication ✅ COMPLETE
- [x] 1.1 Create all 14 SQLAlchemy models (TECHNICAL_SPEC.md §4)
- [x] 1.2 Alembic migration `5584d5240ba6_initial_schema.py` — all 14 tables
- [x] 1.3 JWT auth: bcrypt hashing, access/refresh tokens, get_current_user, get_current_client, require_manager
- [x] 1.4 Auth endpoints: POST /register/client, POST /login (unified), POST /refresh, POST /logout, POST /forgot-password (stub), POST /reset-password (stub), GET /me

**Notes:**
- Replaced `passlib[bcrypt]` with direct `bcrypt 5.0.0` (passlib 1.7.4 incompatible with bcrypt 4+)
- Test conftest uses `StaticPool` for SQLite in-memory isolation (one connection shared per test)
- pytest: **18 passed, 0 failed** (commit c02c9ca)

### Phase 2 — Core Backend ✅ COMPLETE
- [x] 2.1 Studio settings endpoints (`GET/PUT /api/v1/studio`, `GET /studio/status`, `POST /studio/backup`)
- [x] 2.2 Client management endpoints (list, get, update, GDPR delete, bookings, memberships, `/me` endpoints)
- [x] 2.3 Instructor management endpoints (list, create, get, update)
- [x] 2.4 Class templates endpoints (list, create, get, update, soft-delete)
- [x] 2.5 Scheduled classes endpoints (list, create, create-recurring, get, update, cancel, roster, waitlist, complete)

### Phase 3 — Booking Engine ✅ COMPLETE
- [x] 3.1 Booking creation with all validation rules (TECHNICAL_SPEC.md §7.1)
- [x] 3.2 Booking cancellation with credit refund + late-cancellation policy (TECHNICAL_SPEC.md §7.2)
- [x] 3.3 Waitlist join, leave, confirm offer with race-condition safety (TECHNICAL_SPEC.md §7.3)
- [x] 3.4 Background task: waitlist expiry checker every 5 min (TECHNICAL_SPEC.md §8.1)
- [x] Class cancellation cascade: refund credits, decline waitlist (TECHNICAL_SPEC.md §7.6)

### Phase 4 — Check-In System ✅ COMPLETE
- [x] 4.1 Check-in endpoint (app, QR, manual methods) with time-window validation
- [x] 4.2 QR code generation (signed JWT + PNG base64)
- [x] 4.3 Check-in validation logic (TECHNICAL_SPEC.md §7.4)

### Phase 5 — Memberships and Payments ✅ COMPLETE
- [x] 5.1 Membership types CRUD (list, create, get, update, soft-delete)
- [x] 5.2 Membership assignment and lifecycle (assign, update, cancel, pause, resume)
- [x] 5.3 Stripe checkout session creation + webhook receiver (checkout.session.completed)
- [x] 5.4 Payment recording (manual + Stripe), refund endpoint

### Phase 6 — Notifications and Background Tasks ✅ COMPLETE
- [x] 6.1 Expo push notification sender with NotificationLog (app/services/push_service.py)
- [x] 6.2 Class reminder background task every 15 min (TECHNICAL_SPEC.md §8.3)
- [x] 6.3 Membership expiry checker daily (TECHNICAL_SPEC.md §8.2)
- [x] 6.4 Nightly backup task daily, retains 30 copies (TECHNICAL_SPEC.md §8.4)
- [x] Notifications router (GET /notifications, POST /send, PUT /{id}/read)

### Phase 7 — Reports and GDPR ✅ COMPLETE
- [x] 7.1 Attendance, revenue, membership, retention reports
- [x] 7.2 CSV export for attendance and revenue reports
- [x] 7.3 GDPR data export and account deletion (with full anonymization)
- [x] 7.4 Consent log (record consent, get log)

### Phase 8 — Migration Assistant
- [ ] 8.1 File upload and analysis endpoint
- [ ] 8.2 Column mapping engine (LLM-assisted)
- [ ] 8.3 Import execution
- [ ] 8.4 Client invitation flow

### Phase 9 — Frontend (Desktop)
- [ ] 9.1 Onboarding wizard (5 steps)
- [ ] 9.2 Calendar view
- [ ] 9.3 Client management screens
- [ ] 9.4 Membership management screens
- [ ] 9.5 Reports screens
- [ ] 9.6 Settings screens

### Phase 10 — Mobile App
- [ ] 10.1 Client onboarding + studio QR connect
- [ ] 10.2 Class browser and booking
- [ ] 10.3 Check-in screen (app + QR)
- [ ] 10.4 Membership view
- [ ] 10.5 Push notification setup (Expo)

### Phase 11 — Docs Site
- [ ] 11.1 Documentation for every feature
- [ ] 11.2 AI support agent integration

---

## Completed Tasks

### Phase 7 — Reports and GDPR (2026-06-25)
All tasks complete. 11 new tests + 106 Phase 1–6 = **117 passed, 0 failed**.

**Files produced:**
- `app/routers/reports.py` — attendance, revenue, membership, retention, + 2 CSV exports
- `app/routers/gdpr.py` — export, delete, consent-log, consent
- `app/schemas/gdpr.py`
- `tests/test_reports.py`, `tests/test_gdpr.py`

---

### Phase 6 — Notifications and Background Tasks (2026-06-25)
All tasks complete. 5 new tests + 101 Phase 1–5 = **106 passed, 0 failed**.

**Files produced:**
- `app/services/push_service.py` — Expo sender with NotificationLog persistence
- `app/schemas/notification.py`, `app/routers/notifications.py`
- `app/tasks/membership_expiry.py`, `app/tasks/class_reminders.py`, `app/tasks/nightly_backup.py`
- `tests/test_notifications.py`

---

### Phase 5 — Memberships and Payments (2026-06-25)
All tasks complete. 20 new tests + 81 Phase 1–4 = **101 passed, 0 failed**.

**Files produced:**
- `app/schemas/`: membership_type.py, membership.py, payment.py
- `app/routers/`: membership_types.py, memberships.py, payments.py
- `tests/`: test_membership_types.py, test_memberships.py, test_payments.py
- `requirements.txt` — stripe==9.5.0
- `app/config.py` — STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET defaults

**Endpoints:** 5 membership-types, 7 memberships (incl. pause/resume), 6 payments (incl. Stripe checkout + webhook)

---

### Phase 4 — Check-In System (2026-06-25)
All tasks complete. 10 new tests + 71 Phase 1–3 = **81 passed, 0 failed**.

**Files produced:**
- `app/schemas/checkin.py` — CheckinCreate, CheckinResponse, QRCodeResponse
- `app/routers/checkins.py` — POST /checkins, GET /checkins/qr/{id}, GET /checkins/class/{id}
- `tests/test_checkins.py` — 10 tests
- `app/auth.py` — create_qr_token, decode_qr_token added
- `requirements.txt` — qrcode[pil]==7.4.2 added

---

### Phase 3 — Booking Engine (2026-06-25)
All tasks complete. 18 new tests + 53 Phase 1–2 = **71 passed, 0 failed**.

**Files produced:**
- `app/schemas/booking.py` — BookingCreate, BookingResponse, WaitlistJoinRequest, WaitlistResponse
- `app/services/booking_service.py` — get_active_membership, can_book, deduct_credit, refund_credit, process_waitlist
- `app/routers/bookings.py` — 7 endpoints (list, create, get, cancel, join/leave/confirm waitlist)
- `app/tasks/waitlist_expiry.py` — background loop, 5-min expiry checker
- `tests/test_bookings.py` — 18 tests

**Modified:**
- `main.py` — bookings router + waitlist expiry background task wired into lifespan
- `app/routers/classes.py` — DELETE now cascades: refunds credits, declines waitlist
- `tests/conftest.py` — added membership_type, client_membership, scheduled_class_fixture, full_class_fixture

---

### Phase 2 — Core Backend (2026-06-25)
All tasks complete. 35 new tests + 18 Phase 1 = **53 passed, 0 failed**.

**Files produced:**
- `app/schemas/`: studio.py, client.py, instructor.py, class_template.py, scheduled_class.py
- `app/routers/`: studio.py, clients.py, instructors.py, class_templates.py, classes.py
- `tests/`: test_studio.py, test_clients.py, test_instructors.py, test_class_templates.py, test_classes.py
- `main.py` updated to register all 5 routers

**31 new endpoints** covering studio settings, client management, instructor management, class templates, and scheduled classes.

---

### Phase 1 — Database and Authentication (2026-06-25)
All tasks complete. 18 tests passing. Commit: c02c9ca.

### Phase 0 — Project Scaffolding (2026-06-24/25)
All tasks complete. 98 files committed in two commits.

**Commits:**
- `1e23d67` — initial repository setup (specs, CLAUDE.md files, TASK_LOG)
- `80780f1` — Phase 0 complete project scaffolding

**Test status at Phase 0 completion:**
- `backend/`: `pytest tests/ -v` → 1 passed
- `frontend/`: `npm test` → 1 passed  
- `mobile/`: `npm test` → 1 passed
- `docs-site/`: `npm run build` → success (0 errors)

**Known minor issues to fix in later phases:**
- backend/app/database.py: `declarative_base()` import is the SQLAlchemy 1.x style (works, but shows deprecation warning in 2.0) — fix when writing models
- backend/main.py: uses `@app.on_event("startup")` (deprecated, prefer `lifespan`) — fix in Phase 1
- mobile: requires `--legacy-peer-deps` for npm install due to peer dep conflict between `@testing-library/react-native` and React 18

---

## Next Task

**Phase 8 — Migration Assistant**: booking creation with all validation rules, cancellation with credit refund, waitlist management, waitlist expiry background task (TECHNICAL_SPEC.md §7.1–7.3, §8.1).

---

*Last updated: 2026-06-25 — Phase 7 complete, 117 tests passing.*
