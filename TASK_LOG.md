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

### Phase 8 — Migration Assistant ✅ COMPLETE
- [x] 8.1 File upload and analysis — POST /migration/analyse (CSV, multipart)
- [x] 8.2 LLM-assisted column mapping with heuristic fallback (litellm)
- [x] 8.3 Import execution — POST /migration/confirm (client import with dupe detection)
- [x] 8.4 Client invitation flow — token generation, CSV export, GET /auth/invite/{token}

### Phase 9 — Frontend (Desktop) ✅ COMPLETE
- [x] 9.1 Onboarding wizard (5 steps): studio info, account, connectivity, Stripe, complete
- [x] 9.2 Calendar view (react-big-calendar, weekly, cancel panel on click)
- [x] 9.3 Client management (list + search, detail with bookings/memberships tabs, assign membership)
- [x] 9.4 Membership management (types CRUD + all memberships table)
- [x] 9.5 Reports (tabbed: attendance, revenue, memberships, retention; CSV export)
- [x] 9.6 Settings (full studio settings form)
- [x] Dashboard (4 stat cards), Login page, Layout with sidebar nav

### Phase 10 — Mobile App ✅ COMPLETE
- [x] 10.1 Client onboarding: QR scan (expo-camera) + manual URL entry, login, register
- [x] 10.2 Class browser (weekly, grouped by day), class detail with book/waitlist
- [x] 10.3 Check-in via app button (POST /checkins method=app); QR display in bookings
- [x] 10.4 Membership view (active membership, credits, expiry) + purchase stub
- [x] 10.5 Push notification registration (expo-notifications, token sent to backend)

### Phase 11 — Docs Site ✅ COMPLETE
- [x] 11.1 Documentation for every feature (19 pages, zero stubs remaining)
- [x] 11.2 AI support agent integration — POST /api/v1/support/chat (litellm + docs KB) + SupportChat widget (frontend) + documentation page

---

## Completed Tasks

### Gemini Migration — Remove Ollama, add Gemini onboarding step (2026-06-28)
Task complete. **132 backend tests + 19 frontend tests.**

**Decision:** Replaced Ollama (local LLM) with Google Gemini Flash (free API). Studio managers enter their Gemini API key during onboarding. Key is validated via a live litellm test call and persisted to `backend/.env`.

**Backend files modified:**
- `backend/app/config.py` — defaults changed to `LLM_PROVIDER="gemini"`, `LLM_MODEL="gemini/gemini-1.5-flash"`, `LLM_BASE_URL` removed
- `backend/app/routers/studio.py` — added `GET /api/v1/studio/ai` (configured check) + `POST /api/v1/studio/ai` (validate key via litellm, write to .env, update in-memory settings)
- `backend/app/routers/support.py` — removed `api_base` parameter from litellm call
- `backend/tests/test_ai_setup.py` — 2 new tests

**Frontend files deleted:**
- `src/main/ollama.ts`, `src/renderer/src/components/OllamaSetup.tsx`, `src/renderer/src/types/electron.d.ts`, `tests/unit/components/OllamaSetup.test.tsx`

**Frontend files modified:**
- `src/main/index.ts` — removed Ollama imports, `setupOllama()`, all `ipcMain.handle('ollama:...')` handlers
- `src/preload/index.ts` — removed `ollamaApi` contextBridge block
- `src/renderer/src/App.tsx` — removed `OllamaSetup` gate; app renders router directly
- `src/renderer/src/api/studio.ts` — added `saveAiKey()` method
- `src/renderer/src/pages/Onboarding/index.tsx` — 5 steps → 6 steps; new Step 5 "AI Assistant" (Gemini key input, validate button, skip option)
- `tests/unit/pages/Onboarding.test.tsx` — 1 new test (6 step circles)

---

### Phase 11.2 — AI Support Agent (2026-06-26)
Task complete. **3 new backend tests + 3 new frontend tests.**

**Files produced:**
- `backend/app/routers/support.py` — POST /api/v1/support/chat endpoint (litellm + docs as KB, fallback on LLM error)
- `backend/tests/test_support.py` — 3 tests (success, unauthenticated, LLM error fallback)
- `backend/main.py` — support router registered
- `frontend/src/renderer/src/api/support.ts` — API client for /support/chat
- `frontend/src/renderer/src/components/SupportChat.tsx` — floating chat widget (bottom-right)
- `frontend/src/renderer/src/components/Layout.tsx` — SupportChat wired into layout
- `frontend/tests/unit/components/SupportChat.test.tsx` — 3 tests
- `docs-site/docs/studio-manager/ai-support.md` — documentation page
- `docs-site/sidebars.ts` — ai-support added to studio-manager section

**Test totals:** Backend 130 passed | Frontend 12 passed | Docs build: zero errors

---

### Phase 11 — Docs Site (2026-06-26)
All tasks complete. Build passes cleanly (EN + IT locales).

**19 pages written** — all stubs replaced with real user-facing documentation:
- Getting Started (installation, onboarding, client setup)
- Studio Manager (classes, clients, memberships, payments, check-in, reports, settings)
- For Clients (booking, check-in, memberships, notifications)
- Migration (overview, column-mapping guide)
- GDPR guide, API Reference overview
- Sidebar updated with new pages

---

### Phase 10 — Mobile App (2026-06-25)
All tasks complete. **9 tests pass.**

**Files produced (30+ files in mobile/):**
- `src/api/`: auth, classes, bookings, memberships, notifications
- `src/store/`: authStore, studioStore (SecureStore-backed)
- `src/components/`: LoadingView, ErrorView
- `src/lib/errorMessages.ts`, `src/types/index.ts`, `src/notifications.ts`
- `app/`: _layout, index (auth router), onboarding/scan, onboarding/login, onboarding/register
- `app/(tabs)/`: _layout (5 tabs), index (home), classes, bookings, membership, profile
- `app/class/[id].tsx`, `app/membership/purchase.tsx`
- `__tests__/`: 4 new test files

---

### Phase 9 — Frontend Desktop App (2026-06-25)
All tasks complete. **9 tests pass, build zero TypeScript errors.**

**Files produced (30+ files in frontend/src/renderer/src/):**
- `api/`: auth, studio, clients, classes, memberships, reports
- `components/`: Layout (sidebar), LoadingSpinner, ErrorMessage, PageHeader
- `pages/`: Login, Onboarding (5-step wizard), Dashboard, Calendar, Clients/index, Clients/ClientDetail, Memberships, Reports, Settings
- `store/authStore.ts`, `types/index.ts`, `lib/errorMessages.ts`
- `tests/unit/`: 4 new component/lib/store test files

---

### Phase 8 — Migration Assistant (2026-06-25)
All tasks complete. 10 new tests + 117 Phase 1–7 = **127 passed, 0 failed**.

**Files produced:**
- `app/models/migration_job.py`, `app/models/invitation_token.py`
- `app/services/migration_service.py` — CSV parsing, LLM mapping, client import, invitation tokens
- `app/routers/migration.py` — 7 endpoints
- `app/routers/auth.py` — GET /auth/invite/{token} added
- `alembic/versions/06ae94d7aa0e_add_migration_jobs_and_invitation_tokens.py`
- `tests/test_migration.py`

---

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

## Post-V1 Fixes

### Ollama auto-setup (2026-06-26)
Bug: AI chat showed "couldn't connect" because (1) backend not restarted after support router commit, (2) `LLM_MODEL` default missing `"ollama/"` prefix, (3) Ollama not auto-installed.

**Files modified:**
- `backend/app/config.py` — `LLM_MODEL` default: `"llama3.2"` → `"ollama/llama3.2"`
- `frontend/src/main/ollama.ts` — Ollama lifecycle: detect, start server, pull model
- `frontend/src/main/index.ts` — `setupOllama()` runs non-blocking on startup; IPC handlers registered
- `frontend/src/preload/index.ts` — `window.ollamaApi` IPC bridge exposed
- `frontend/src/renderer/src/components/OllamaSetup.tsx` — full-screen setup overlay (5 states)
- `frontend/src/renderer/src/App.tsx` — OllamaSetup shown before router when in Electron

Backend: 130 tests | Frontend: 15 tests, 0 TS errors

---

## Post-V1 Improvements (2026-06-28)

### AI Assistant quality fix + SupportChat sessions + i18n (commit 7550339, 7ecd257)

**Backend (135 tests):**
- Keyword pre-screening in support chat: off-topic questions rejected before calling LLM (no hallucination)
- System prompt hardened with 4 few-shot refusal examples
- Docs context raised from 32k → 60k chars, `studio-manager/` files prioritised
- Prefix matching in `_is_in_scope` (handles plurals: booking→bookings)
- 3 new tests for pre-screening logic

**Frontend (21 tests, build clean):**
- SupportChat redesigned: 2-column layout (session sidebar + chat), multiple sessions, localStorage persistence, auto-title from first message, delete session
- Full i18n with react-i18next: EN + IT covering all pages and components (14 namespaces)
- Global language selector (EN/IT) in sidebar Layout — switches entire app
- Removed Ollama setup (OllamaSetup component, ollama.ts, IPC handlers) — replaced by Gemini onboarding step

---

## Post-V1 Improvements (2026-06-29)

### AI Support Agent — Groq migration + 9-language UX (commits 19a2169, ac7daa9)

**Backend (135 tests passing):**
- LLM provider switched from Gemini to **Groq** (`llama-3.3-70b-versatile`, 14,400 req/day free)
- Pre-screener replaced vocabulary extraction with static multilingual keyword sets (`_AGON_KEYWORDS`, `_HELP_WORDS`) covering all 9 languages — fixes Italian/FR/DE/ES etc. being rejected
- Greeting handler (`_GREETING_LANG` + `_GREETING_REPLIES`) returns greetings in the detected language
- `OUT_OF_SCOPE_REPLY` and `FALLBACK_REPLY` constants replaced with `_out_of_scope_reply(lang)` / `_fallback_reply(lang)` helpers — localised in all 9 languages
- `ChatRequest` accepts optional `language: str = "en"` field
- System prompt enforces response language via `{language_name}` and bans all markdown (`**bold**`, `*italic*`, `# headers`)
- Docs context cap reduced 60k → 32k chars to stay under Groq 12k token limit
- Tests updated to use new helper functions

**Frontend (build clean):**
- `supportApi.chat()` passes `i18n.language` to backend
- `authStore.logout()` clears `agon-chat-sessions` from localStorage
- `SupportChat`: no auto-greeting on open; empty state shows `t('support.emptyHint')` hint; New Chat creates empty session without injecting a greeting message
- All 9 locale files updated with `support.greeting`, `support.emptyHint`, `onboarding.step5*` keys

**Docs:**
- All 7 studio-manager pages: correct UI button/nav labels + multilingual term tables in all 9 languages
- `intro.md`: multilingual navigation reference table and key terms table added

---

## Post-V1 Improvements (2026-06-29)

### SMTP Email Service + Create Client from Backoffice (commit e4faa26)

**Backend (148 tests):**
- `app/services/email_service.py` — async SMTP sender (`aiosmtplib`), HTML templates for invite + reset + test email
- 7 new SMTP columns on `studio_settings` (`email_smtp_host/port/user/password/tls`, `email_from_name/address`) + Alembic migration `a1b2c3d4e5f6`
- `POST /api/v1/clients` — create client from backoffice (no password), generates 7-day `InvitationToken`, sends "set your password" email; returns `email_sent: bool`
- `GET /api/v1/studio/email` — returns SMTP settings (password masked as `***`)
- `PUT /api/v1/studio/email` — save SMTP settings
- `POST /api/v1/studio/email/test` — sends test email to authenticated manager
- `POST /auth/forgot-password` — now real: generates 2-hour token, sends reset email silently
- `POST /auth/reset-password` — now real: validates token, sets new password, marks token used
- `Client.password_hash` made nullable (backoffice-created clients have no password yet)

**Frontend (29 tests, build clean):**
- Clients page: New Client modal (full_name, email, phone) wired to `POST /api/v1/clients`; shows invite-sent / email-failed feedback
- Settings page: restructured with two tabs "Studio" | "Email"; Email tab has 7 SMTP fields, Save, and Send Test Email button
- 18 new i18n keys in all 9 locale files (EN/IT/DE/ES/FR/NL/PL/PT/TR)

---

## Post-V1 Improvements (2026-06-29)

### Email Templates + Event Assignments + Smart Lists (commit 32a979f)

**Backend (170 tests):**
- `EmailTemplate` model + CRUD: GET/POST/PUT/DELETE `/api/v1/email/templates`
- `EmailEventAssignment` model: 7 event types (`client_invite`, `password_reset`, `booking_confirmed`, `booking_cancelled`, `class_reminder`, `membership_expiring`, `waitlist_promoted`) seeded at startup
- `GET/PUT /api/v1/email/events` — assign custom template per event type
- `email_service.send_event_email()`: looks up custom template, renders `{{var}}` placeholders, falls back to built-in default
- `SmartList` model + CRUD + `GET /{id}/preview`: filter engine supports membership_status, last_booked_within_days, not_booked_within_days, joined_before/after, membership_type_id
- Alembic migration `b2c3d4e5f6a7`

**Frontend (35 tests, build clean):**
- Email Templates page: table + create/edit modal with variable chip hints
- Event Assignments page: table with auto-saving template dropdowns per event
- Smart Lists page: filter builder (membership, booking recency, join date, type) + inline preview panel
- "Marketing" section in sidebar with 3 nav items
- i18n `marketing` namespace (34 keys) in all 9 locale files

---

---

## Improvement Plan — Phase D: Database & Performance (2026-07-01)

Commits: `ff79969` (migration fix + perf test) · `9f971e7` (ARCHITECTURE.md + ERD)

### D1 — SQLite WAL mode
Already present in `database.py`. Verified active (`PRAGMA journal_mode=WAL`, `PRAGMA synchronous=NORMAL`). ✅

### D2+D5 — Composite indexes + migration fix
Migration `086528153a55` had erroneous `op.drop_table('locations')` artifact. Fixed to only create/drop 4 composite indexes: `idx_booking_class_status`, `idx_booking_client_status`, `idx_membership_client_status`, `idx_class_starts_at_location_status`.

Migration test `backend/tests/test_migrations.py`: verifies full upgrade (13 tables) and clean downgrade.

### D3 — Performance tests
`backend/tests/test_performance.py`: 500 clients, 1000 classes, 2000 bookings. Verifies list_classes, roster, booking creation all < 100 ms. Seed uses `i // 4` index to avoid UNIQUE constraint violations.

### D4 — ARCHITECTURE.md
Created at project root: system diagram, Mermaid startup sequence, transaction semantics, background task lifecycle, per-entity delete strategy table, GDPR flow.

### D6 — Database ERD
`docs-site/docs/api/database-schema.md`: 17-table Mermaid ERD + field descriptions + design notes. Added to Docusaurus sidebar.

---

## Improvement Plan — Phase E: Test Strategy (2026-07-01)

Commits: `566547f` (E1/E2/E4/E5) · `bfb5278` (E3/E6)

### E1 — IDOR / Authorization tests (security fix)
`backend/tests/test_authorization.py` (12 tests). `require_manager`/`require_staff` in `auth.py` rewritten to check JWT role claim before DB lookup (403 for wrong role, 401 for missing user). `GET /clients` restricted to staff only.

### E2 — Backup tests
`backend/tests/test_backup.py` (6 tests). `app/backup.py` rewritten from stub to real SQLite file-copy implementation.

### E3 — Playwright e2e scaffold
`frontend/playwright.config.ts` + 4 spec files: `auth.spec.ts`, `clients.spec.ts`, `calendar.spec.ts`, `instructors.spec.ts`. API calls mocked via `page.route()`.

### E4 — Load test
`backend/tests/test_load.py`: 100 clients booking a capacity-50 class. Verifies exactly 50 confirmed, no overbooking.

### E5 — Input validation tests
`backend/tests/test_validation.py` (12 tests). Pydantic schemas updated with `Field(gt=0)`, `field_validator`, `model_validator`.

### E6 — Mobile offline store
`mobile/src/store/connectivityStore.ts` + 6 tests. `mobile/package.json` test script fixed (no `--passWithNoTests`).

**State after Phase E: Backend 212 tests · Mobile 15 tests · Frontend typecheck clean · Docs build clean**

---

---

## Improvement Plan — Phase F: Developer Experience (2026-07-01)

### F1 — setup.sh + setup.ps1
`setup.sh` (macOS/Linux) and `setup.ps1` (Windows): one-command full-repo setup. Creates Python venv, installs all deps, runs `alembic upgrade head`, installs npm deps for frontend/mobile/docs-site, creates `backend/.env` if missing.

### F2 — Makefile
`Makefile` at project root with targets: `setup`, `test` (all three suites), `test-backend/frontend/mobile`, `lint`, `format`, `build`, `docs`, `dev` (backend + frontend in parallel), `dev-backend/frontend/mobile/docs`, `clean`.

### F3 — .editorconfig
`.editorconfig` at project root: 2-space indent for TS/JS/JSON/YAML, 4-space for Python, tabs for Makefile, LF line endings, UTF-8, final newline.

### F4 — PR template
`.github/pull_request_template.md`: standard checklist covering tests, migrations, i18n keys, secrets, PII logging, TypeScript build, and security review.

### F5 — VS Code Dev Container
`.devcontainer/devcontainer.json`: Python 3.11 + Node 20 image, `postCreateCommand: bash setup.sh`, port forwarding (8000/5173/3000), VS Code extensions (Python, Ruff, ESLint, Prettier, Tailwind, dotenv).

---

---

## Improvement Plan — Phase G: Documentation (2026-07-01)

Commit: `78c8d39`

- **G2 — OPERATIONS.md**: backup/restore, update, Cloudflare Tunnel, Stripe config, monitoring checklist, auto-update roadmap (section 7)
- **G3 — ROADMAP.md**: V1.0 (current) → V1.1 → V2.0 → V3.0 product evolution
- **G4 — CODE_OF_CONDUCT.md**: Contributor Covenant v2.1 full text
- **G5 — docs-site/scripts/fetch-openapi.js**: generates per-tag Markdown pages from live `/openapi.json`
- **G6 — docs-site/docs/glossary.md**: 15 canonical terms, added to Docusaurus sidebar
- **G7 — CHANGELOG.md**: V1.0 full feature list + unreleased improvements in Keep a Changelog format
- **H1 (partial) — CONTRIBUTING.md**: "Becoming a Co-Maintainer" section (criteria, responsibilities, process)
- Docs site builds clean (EN + IT)

---

## Improvement Plan — Phase H: Long-term Sustainability (2026-07-01)

### H1 — Co-maintainer documentation ✅
Added "Becoming a Co-Maintainer" section to CONTRIBUTING.md (criteria, responsibilities, trial period process).

### H2 — Mobile offline-first with React Query
- `mobile/src/hooks/useNetworkStatus.ts`: polls studio `/health` every 30 s, updates `connectivityStore`
- `mobile/src/components/OfflineBanner.tsx`: yellow banner shown when `isOnline === false`, includes last-seen timestamp
- `mobile/src/store/pendingQueue.ts`: Zustand FIFO queue for `CREATE_BOOKING` / `CANCEL_BOOKING` operations
- `mobile/app/_layout.tsx`: `NetworkWatcher` drains pending queue on reconnect; `DeepLinkHandler` handles deep links
- `mobile/__tests__/store/pendingQueue.test.ts`: 6 tests (FIFO, CRUD, clear)
- Mobile: **21 tests passing**

### H3 — Mobile deep linking for notification taps
- `app.json` already had `"scheme": "agon"` ✅
- `DeepLinkHandler` in `_layout.tsx`: maps `agon://bookings/N` → `/bookings/N`, `agon://classes/N` → `/class/N`, `agon://waitlist/N` → `/bookings/waitlist/N`
- Handles both cold-start (`Linking.getInitialURL()`) and foreground notification taps (`Notifications.addNotificationResponseReceivedListener`)

### H4 — Electron auto-update documentation
- `OPERATIONS.md` section 7: explains planned V1.1 auto-update flow (electron-updater, GitHub releases, Alembic migration on relaunch)
- Implementation checklist for V1.1 contributors
- Note: auto-update code itself is V1.1 scope (no electron-updater dependency in V1.0)

### H5 — Storybook *(deferred to V1.1)*
High effort, lower priority. Not blocked by anything else.

---

## Next Task

**All 8 improvement plan phases complete (A–H).**

Final state:
- Backend: **212 tests**
- Mobile: **21 tests**
- Frontend: TypeScript clean, 35 Vitest tests, Playwright e2e scaffold
- Docs site: build clean (EN + IT), glossary, ERD, OpenAPI script
- Root: ARCHITECTURE.md, OPERATIONS.md, ROADMAP.md, CHANGELOG.md, CODE_OF_CONDUCT.md, CONTRIBUTING.md, Makefile, setup.sh/.ps1, .editorconfig, .devcontainer, PR template

Next work should be user-driven (new features, V1.1 items from ROADMAP.md, or bug fixes).

---

*Last updated: 2026-07-01 — All improvement plan phases (A–H) complete.*
