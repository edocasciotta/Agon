# Changelog

All notable changes to Agon are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Agon uses [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added
- `POST /api/v1/agent/act`: AI Action Mode — studio managers can create scheduled classes from a natural-language request (e.g. "create a Yoga class next Wednesday at Milano with Elena, 1 hour"). The LLM only extracts slots via tool calling; class type, location, instructor, and date are resolved deterministically server-side and a class is created only once every field is unambiguous — otherwise the assistant asks a clarifying question. Manager-only, opt-in toggle in the AI Support chat panel.
- `GET /api/v1/clients` pagination: `page`/`page_size` query params, response now `{items, total, page, page_size}`
- `search` query param on `GET /api/v1/instructors` and `GET /api/v1/locations`, with matching searchbars on the Instructors and Establishments pages
- `setup.sh` / `setup.ps1`: one-command dev environment setup
- `Makefile`: `test`, `lint`, `format`, `build`, `dev` targets for all workspaces
- `.editorconfig`: consistent indent and charset rules
- `.github/pull_request_template.md`: PR checklist
- `.devcontainer/devcontainer.json`: VS Code Dev Container with Python 3.11 + Node 20
- `OPERATIONS.md`: runbook for updates, backups, Cloudflare Tunnel, Stripe
- `ROADMAP.md`: V1.0 → V3.0 product evolution plan
- `CODE_OF_CONDUCT.md`: Contributor Covenant v2.1
- `ARCHITECTURE.md`: system components, startup sequence, transaction semantics, delete strategy
- `docs-site/docs/api/database-schema.md`: full 17-table Mermaid ERD
- `docs-site/docs/glossary.md`: canonical terminology reference
- Playwright e2e scaffold: `auth.spec.ts`, `clients.spec.ts`, `calendar.spec.ts`, `instructors.spec.ts`
- Mobile connectivity store (`connectivityStore.ts`) with offline/online tracking
- Backend authorization tests (IDOR checks — 12 tests)
- Backend backup tests (6 tests)
- Backend load tests: 100 concurrent bookings, capacity enforcement
- Backend validation tests: edge cases for all schemas (12 tests)
- Backend migration tests: upgrade/downgrade verification

### Changed
- `require_manager` and `require_staff` now check JWT role claim before DB lookup (403 for wrong role, not 401)
- `GET /clients` and `GET /clients/{id}` restricted to staff roles (IDOR fix)
- Mobile `package.json`: removed `--passWithNoTests` flag from test script

### Fixed
- Alembic migration `086528153a55`: removed erroneous `op.drop_table('locations')` artifact
- Performance test seed: `clients[i // 4]` ensures unique `(client_id, scheduled_class_id)` pairs

---

## [1.0.0] — 2026-06-29

### Added

**Booking engine**
- `POST /api/v1/bookings`: create booking with membership validation, capacity check, waitlist fallback
- `DELETE /api/v1/bookings/{id}`: cancel booking with automatic credit refund
- Waitlist promotion background task: promotes next client when a spot opens
- Waitlist expiry background task: removes stale waitlist entries

**Check-in system**
- `POST /api/v1/check-in`: three methods — QR code, app tap, manual (by name/email)
- QR code generation per booking
- Check-in validation: only confirmed bookings within 30 min of class start

**Memberships and payments**
- Membership types CRUD (recurring and credit pack)
- Client membership assignment, activation, expiry
- Stripe integration: checkout, webhook handler (idempotent), subscription lifecycle
- Payment recording and history

**Notifications and background tasks**
- Expo push notification sender
- Class reminder task (24 h before class)
- Membership expiry checker (daily)
- Nightly SQLite backup task

**AI support agent**
- Groq-powered chat endpoint (`POST /api/v1/support/chat`)
- 9-language support (EN, IT, FR, DE, ES, PT, NL, PT-BR, RU)
- Out-of-scope filtering with multilingual keyword sets
- Docs-context retrieval (32 k chars, `studio-manager/` prioritized)

**Email system**
- SMTP configuration per studio (`GET/PUT /api/v1/studio/email`)
- Test email endpoint (`POST /api/v1/studio/email/test`)
- Email templates CRUD (`/api/v1/email/templates`)
- Event assignments (7 event types, custom template per event)
- `POST /api/v1/clients`: create client from backoffice, send invite email

**Marketing**
- Smart Lists: filter engine (membership status, booking recency, join date, membership type)
- Smart List preview: count matching clients before sending

**GDPR**
- Data export: full JSON dump of all client data
- Right-to-erasure: anonymizes client record, hard-deletes PII
- Consent log: records purpose and timestamp of each consent event

**Migration assistant**
- CSV upload and column mapping (`POST /api/v1/migration/upload`, `POST /api/v1/migration/map`)
- Import execution with progress tracking
- Client invitation flow post-import

**Onboarding**
- 5-step wizard: studio info, admin account, Cloudflare Tunnel, Stripe, backup
- Studio QR code generation and print

**Frontend (desktop)**
- Calendar view: weekly/monthly, drag-to-create, event hover tooltip, zoom controls
- Client management: list, search, create modal (invite email), booking history
- Instructor management: list, create, deactivate
- Membership management: types CRUD, client membership assignment
- Reports: attendance, revenue, retention charts
- Settings: studio info, email/SMTP, backup, Stripe, AI agent
- Email Templates page, Event Assignments page
- Smart Lists page with filter builder and inline preview
- 9-language UI (EN/IT/FR/DE/ES/PT/NL/PL/TR) via react-i18next
- Support chat: multi-session sidebar, auto-title, localStorage persistence

**Mobile**
- Onboarding: QR scan → register/login → welcome
- Class browser and booking
- QR check-in screen
- Membership status view
- Push notification setup (Expo)

**Documentation site**
- 9-language AI support agent
- 14 feature pages for studio managers
- 4 client guides
- Migration guides (CSV, BSport, Momence)
- GDPR guide
- API reference overview
- Database schema ERD

**Infrastructure**
- SQLite WAL mode (`PRAGMA journal_mode=WAL`)
- Composite indexes on booking, scheduled_class, membership tables
- Alembic migration chain (13 migrations)
- GitHub Actions CI placeholder

---

[Unreleased]: https://github.com/your-org/agon/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/your-org/agon/releases/tag/v1.0.0
