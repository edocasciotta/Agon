# Agon — Task Log
*Orchestrator coordination memory. Updated after every completed task.*

---

## Project State (2026-07-02)

**All build phases complete.** V1 shipped + improvements A–I applied.

### Test Counts
| Suite | Count | Status |
|---|---|---|
| Backend (pytest) | 232 | ✅ |
| Mobile (jest-expo) | 21 | ✅ |
| Frontend (Vitest) | 8 | ✅ |
| Frontend (Playwright) | scaffold only | — |
| Docs build | — | ✅ |

### Completed Phases
- **0** Scaffolding (FastAPI, Electron, Expo, Docusaurus, CI, Alembic)
- **1** DB models (14 tables) + JWT auth
- **2** Core API (studio, clients, instructors, class templates, scheduled classes)
- **3** Booking engine (create, cancel, waitlist, expiry background task)
- **4** Check-in (app/QR/manual, time-window validation, QR code generation)
- **5** Memberships & payments (Stripe checkout + webhook, manual payments, refunds)
- **6** Notifications & background tasks (Expo push, class reminders, expiry checker, nightly backup)
- **7** Reports & GDPR (attendance/revenue/membership/retention + CSV, GDPR export/delete, consent log)
- **8** Migration assistant (CSV upload, LLM column mapping, import, invitation tokens + email)
- **9** Frontend desktop (onboarding 6-step, calendar, clients, memberships, reports, settings, dashboard)
- **10** Mobile (onboarding QR+manual, class browser, bookings, check-in, membership, push notifications)
- **11** Docs site (19 pages, AI support widget, glossary, ERD, OpenAPI script)

### Post-V1 Improvements Applied
| Phase | Summary |
|---|---|
| A | *(not logged — see git history)* |
| B–C | *(not logged — see git history)* |
| D | SQLite WAL verified; composite indexes migration `086528153a55`; performance tests (500 clients, 1000 classes, 2000 bookings, all <100 ms); ARCHITECTURE.md + ERD page |
| E | IDOR/auth tests (`test_authorization.py`, 12 tests); backup tests; Playwright e2e scaffold (4 specs); load test (100 clients, cap-50 class); input validation tests (12); mobile offline store (`connectivityStore`) |
| F | `setup.sh` + `setup.ps1`; Makefile; `.editorconfig`; PR template; VS Code Dev Container |
| G | OPERATIONS.md; ROADMAP.md; CODE_OF_CONDUCT.md; `fetch-openapi.js`; glossary page; CHANGELOG.md; CONTRIBUTING.md co-maintainer section |
| H | Mobile offline-first (pendingQueue, OfflineBanner, NetworkWatcher, 21 tests); deep linking (`agon://`); Electron auto-update docs (V1.1 scope) |
| I | Groq tool-call reliability: pre-load all studio data into system prompt, reduce tools sent to LLM from 8 → 2 write-only; fixes malformed tool calls and schema validation errors |

### Key Implementation Decisions (non-obvious)
- `passlib` replaced with direct `bcrypt 5.0.0` (passlib 1.7.4 incompatible with bcrypt 4+)
- LLM stack: **Groq** `llama-3.3-70b-versatile` (14,400 req/day free). Config in `backend/app/config.py` via `LLM_PROVIDER` / `LLM_MODEL` / `LLM_API_KEY`. `LLM_BASE_URL` was removed — never reference it.
- Agent mode: reads all studio data into system prompt upfront; only 2 write tools sent to Groq (`create_class`, `cancel_class`)
- `Client.password_hash` is nullable (backoffice-created clients have no password yet)
- i18n: 7 locales only — EN, IT, FR, DE, ES, PT, NL. PL and TR removed.
- Supported email event types: `client_invite`, `password_reset`, `booking_confirmed`, `booking_cancelled`, `class_reminder`, `membership_expiring`, `waitlist_promoted`
- SmartList filters: `membership_status`, `last_booked_within_days`, `not_booked_within_days`, `joined_before/after`, `membership_type_id`
- Test conftest uses `StaticPool` (SQLite in-memory, one connection per test)
- Performance test seed: uses `i // 4` index to avoid UNIQUE constraint violations

---

## Next Task

**User-driven.** No orchestrator-initiated tasks pending.

Candidates from ROADMAP.md V1.1:
- Electron auto-update (electron-updater + GitHub releases + Alembic on relaunch)
- Storybook component library
- Multi-location support (location_id already on all tables)
- Stripe subscription billing

*Last updated: 2026-07-02 — Phase I complete.*
