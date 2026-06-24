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

### Phase 0 — Project Scaffolding ⬅ CURRENT
- [ ] 0.1 Rename agent instruction files to `CLAUDE.md` in each sub-directory
- [ ] 0.2 Initialize git repository and create initial commit
- [ ] 0.3 Initialize FastAPI project structure in `/backend`
- [ ] 0.4 Initialize Electron + React project in `/frontend`
- [ ] 0.5 Initialize React Native + Expo project in `/mobile`
- [ ] 0.6 Initialize Docusaurus in `/docs-site`
- [ ] 0.7 Set up GitHub Actions CI pipeline
- [ ] 0.8 Configure Alembic for database migrations (part of backend scaffolding)

### Phase 1 — Database and Authentication
- [ ] 1.1 Create all SQLAlchemy models (TECHNICAL_SPEC.md §4)
- [ ] 1.2 Create all Alembic migrations
- [ ] 1.3 Implement JWT authentication (TECHNICAL_SPEC.md §5)
- [ ] 1.4 Implement auth endpoints (TECHNICAL_SPEC.md §6.1)

### Phase 2 — Core Backend
- [ ] 2.1 Studio settings endpoints
- [ ] 2.2 Client management endpoints
- [ ] 2.3 Instructor management endpoints
- [ ] 2.4 Class templates endpoints
- [ ] 2.5 Scheduled classes endpoints

### Phase 3 — Booking Engine
- [ ] 3.1 Booking creation with all validation rules (TECHNICAL_SPEC.md §7.1)
- [ ] 3.2 Booking cancellation with credit refund logic (TECHNICAL_SPEC.md §7.2)
- [ ] 3.3 Waitlist management (TECHNICAL_SPEC.md §7.3)
- [ ] 3.4 Background task: waitlist expiry checker (TECHNICAL_SPEC.md §8.1)

### Phase 4 — Check-In System
- [ ] 4.1 Check-in endpoint (all three methods: app, QR, manual)
- [ ] 4.2 QR code generation
- [ ] 4.3 Check-in validation logic (TECHNICAL_SPEC.md §7.4)

### Phase 5 — Memberships and Payments
- [ ] 5.1 Membership types CRUD
- [ ] 5.2 Membership assignment and lifecycle
- [ ] 5.3 Stripe integration + webhook receiver
- [ ] 5.4 Payment recording (manual + Stripe)

### Phase 6 — Notifications and Background Tasks
- [ ] 6.1 Push notification sender (Expo)
- [ ] 6.2 Class reminder background task (TECHNICAL_SPEC.md §8.3)
- [ ] 6.3 Membership expiry checker (TECHNICAL_SPEC.md §8.2)
- [ ] 6.4 Nightly backup task (TECHNICAL_SPEC.md §8.4)

### Phase 7 — Reports and GDPR
- [ ] 7.1 Attendance, revenue, membership, retention reports
- [ ] 7.2 CSV export for all reports
- [ ] 7.3 GDPR data export and deletion
- [ ] 7.4 Consent log

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

*(none yet)*

---

## Next Task

**Phase 0, Task 0.1**: Rename agent instruction files to `CLAUDE.md` in each sub-directory, initialize git, then delegate backend scaffolding to the Backend Agent.

---

*Last updated: 2026-06-24 — Initial session, no code written yet.*
