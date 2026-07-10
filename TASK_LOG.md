# Agon — Task Log
*Orchestrator memory. Updated after every completed task.*

---

## Project State (2026-07-06)

**All 12 build phases complete (0–11). V1 shipped. Post-V1 improvements A–R applied.**

### Test Counts
| Suite | Count | Status |
|---|---|---|
| Backend (pytest) | 288 | ✅ |
| Frontend (Vitest) | 53 | ✅ |
| Mobile (jest-expo) | 44 | ✅ |
| Docs build | — | ✅ |

### Active branch
`main` — all changes committed and pushed (`a33dd7e`).

### Local dev
- Backend: `cd backend && .venv/bin/uvicorn main:app --reload` (entry point is top-level `backend/main.py`, not `app/main.py`)
- Frontend: `cd frontend && npm run dev`
- Mobile: `cd mobile && npx expo start`
- Local DB: `admin@example.com` / `password`
- Ollama: model `agon-assistant` must be loaded; if missing, agent calls fail silently.

---

### Completed Build Phases (0–11)
Scaffolding → DB models → Core API → Booking engine → Check-in → Memberships/payments → Notifications/tasks → Reports/GDPR → Migration assistant → Frontend desktop → Mobile → Docs site.

---

## Post-V1 Improvements
| Phase | Summary |
|---|---|
| D | SQLite WAL + composite indexes (migration `086528153a55`); ARCHITECTURE.md |
| E | IDOR tests (`test_authorization.py`); Playwright e2e scaffold; offline store |
| F | `setup.sh`, `setup.ps1`, Makefile, Dev Container |
| G | OPERATIONS.md, ROADMAP.md, CHANGELOG.md, CONTRIBUTING.md |
| H | Mobile offline-first (pendingQueue, OfflineBanner); deep linking `agon://` |
| I | Groq reliability: preload studio data into system prompt; tools 8→2 write-only |
| J | Fine-tuning round 1: LoRA on Llama 3.2 3B → GGUF → Ollama `agon-assistant` |
| K | Agent tools expanded to 9; entity resolution; credit deduction on booking |
| L | Fine-tuning round 2: 210 examples for `cancel_booking` / `get_report` Italian |
| M | Fine-tuning execution (800+600 iters); `cancel_booking` confirmation gate in router |
| N | Hallucinated-tool guard; i18n language persistence (localStorage) |
| O | System prompt: REQUIRED FIELDS + NO RAW JSON; echoed-data guard; calendar hours configurable from Settings |
| P | Color customization; per-class booking windows; ID visibility + search by ID |
| Q | Landing page: inviting hero copy; 9-language toggle; mock UI screenshots section; scroll animation |
| R | Stripe billing phases 1–7 (schema → config → checkout → subscriptions → desktop → mobile → cancel) |

---

## Security Hardening (2026-07-06) — commit `5224e19`

Full security audit. Normative doc: `docs/SECURITY_GUIDELINES.md`.

| # | Severity | Fix |
|---|---|---|
| 1 | Critical | Role/entity confusion: `User.id` & `Client.id` overlap. JWT `role` claim checked before DB lookup. |
| 2 | Critical | `/auth/refresh` now dispatches on refresh token's own `role`; no "try users then clients". |
| 3 | High | IDOR in `POST /billing/checkout-session`: non-staff caller now restricted to their own `sub`. |
| 4 | High | Path traversal in migration analyser — `basename` + allow-list + `commonpath` confinement. |
| 5 | High | Root `agon.db` / `backups/` added to `.gitignore`. |
| 6 | Medium | Login user-enumeration: `burn_password_check()` on no-match path. |
| 7 | Medium | bcrypt silent truncation: `AUTH_PASSWORD_TOO_LONG` guard (72 bytes). |
| 8 | Medium | Mobile: `validateStudioUrl` rejects non-local plain-http URLs. |
| 9 | Added | Rate limit on `POST /auth/refresh` (10/min). |

---

## UX Improvements (2026-07-06) — commit `a33dd7e`

### Backend
- `GET /classes` + `GET /classes/{id}` — outerjoin `ClassTemplate`, response includes `template_name`
- `PATCH /membership-types/{id}/reactivate` — sets `is_active = True`
- `DELETE /membership-types/{id}/remove` — hard-delete; blocked (409 `MEMBERSHIP_TYPE_HAS_MEMBERS`) if any `Membership` references the type
- `POST /bookings` — manager role bypass: can book into already-started classes
- `POST /billing/checkout-session` — `sellable_online` gate restored

### Frontend – Dashboard
- All colors derived from `primary_color` / `secondary_color` in Studio Settings; zero hardcoded Tailwind color classes for UI elements
- New KPIs: **Retention rate** (churned sub) + **Check-in rate** (avg size sub); replaced weaker "total clients" + "classes this week"
- New insights row (3 cards): **Attendance highlights** (4-stat grid), **Top class types** (CSS bar chart by bookings), **Members by plan** (CSS bar chart by active count)

### Frontend – Memberships page
- `membershipTypesApi.list(true)` — deactivated types visible and manageable in backoffice
- Per-row actions: Edit, Deactivate ↔ Reactivate toggle, Remove (red confirmation dialog)
- `resolveApiError()` platform-wide utility for user-friendly API error messages; applied to all mutation handlers in ManageBookingsModal, EditClassModal, ScheduleClassModal

### Mobile
- Classes list + detail: `template_name` shown instead of "Class #19"
- Home tab: language switcher in header
- Purchase screen: filtered by `is_active && sellable_online`

---

## Security Hardening (2026-07-10) — uncommitted

Secret invitation token leaked via uvicorn's own access log. `GET /api/v1/auth/invite/{token}`
(`auth.py:300`) puts a long-lived (7-day), single-use `uuid.uuid4()` token in the URL path — the
only viable auth mechanism before the client has a password. uvicorn's `uvicorn.access` logger is
configured with `propagate=False` and its own handler (confirmed against installed uvicorn
source), so the app's `PIIRedactionFilter` (attached to the root logger only) never saw these
lines — every request printed the raw token to stdout unredacted, on both the dev
(`uvicorn main:app --reload`) and Electron-spawned (`frontend/src/main/index.ts`) launch paths.

| # | Severity | Fix |
|---|---|---|
| 1 | Medium | `AccessLogTokenRedactionFilter` added to `app/logging_config.py`, attached directly to the `uvicorn.access` logger. Redacts `/api/v1/auth/invite/{token}` path segments to `[redacted-token]` while preserving uvicorn's positional 5-tuple `record.args` shape (naively nulling `args` the way `PIIRedactionFilter` does breaks `AccessFormatter`'s unpacking). Pattern list is extensible for future secret-in-URL endpoints. Tests in `tests/test_logging_config.py` (4 tests, mutation-tested — confirmed they fail when the redaction is sabotaged). No DB/API changes — no migration, no docs-site page needed. |
| 2 | Low | `GET /invite/{token}` and `POST /reset-password` (both in `auth.py`) validate a secret token but had no `@limiter.limit`, unlike every sibling auth endpoint — inconsistent with `SECURITY_GUIDELINES.md` §1.5. Added `@limiter.limit("10/minute")` (per-IP, matching `login`/`refresh`) to both. Tokens are `uuid.uuid4()` (122 bits) so brute force wasn't practical either way — this is guideline-consistency/defense-in-depth, not an urgent exploit. Tests in `test_auth.py` follow the existing `test_booking_rate_limit_disabled_in_test_env` convention (decorator-presence check, since `AGON_ENV=test` disables actual enforcement). `POST /clients` (invite creation) was checked and left alone — already gated by `require_manager`, not an anonymous target. |

**Note:** originally investigated as a hypothetical `GET /api/v1/calendar/{token}.ics` in a
`calendar_sync.py` that doesn't exist anywhere in this repo, on any branch, or in the specs.
Confirmed real equivalents above (`/invite/{token}`, `/reset-password`) instead before delegating
either fix.

Aside: `ruff check` flags a pre-existing `I001` (import order) finding on `auth.py`, confirmed via
`git stash` to already exist at HEAD before either fix — a `pyproject.toml` gap where
`[tool.isort]` sets `profile = "black"` but `[tool.ruff.lint]` has no matching isort sub-config, so
ruff's built-in sorter disagrees with the real `isort` binary (which considers the file clean).
Cosmetic, unrelated to this work, left untouched.

---

## Key Implementation Decisions (non-obvious)

- **LLM agent:** Ollama `ollama_chat/agon-assistant` (locally fine-tuned Llama 3.2 3B 4-bit). Tools API skipped for Ollama — model emits JSON in content; intercepted by `_parse_llama_json_tool_call`. Env: `LLM_PROVIDER=ollama`, `LLM_MODEL=ollama_chat/agon-assistant`.
- **LLM support/migration:** Groq `llama-3.3-70b-versatile`. Env: `LLM_PROVIDER=groq`, `LLM_MODEL=groq/llama-3.3-70b-versatile`, `LLM_API_KEY`. `LLM_BASE_URL` removed — never reference it.
- **Agent tools (9):** `create_class`, `cancel_class`, `book_client`, `cancel_booking`, `get_class_roster`, `check_in_client`, `create_client`, `assign_membership`, `get_report`.
- **`cancel_booking` confirmation:** deterministic gate in router (`_is_user_confirming`), not model-side.
- **`passlib` replaced** with direct `bcrypt 5.0.0` (passlib incompatible with bcrypt 4+).
- **`Client.password_hash` nullable** — backoffice-created clients have no password until invited.
- **i18n:** 7 locales only — EN, IT, FR, DE, ES, PT, NL. PL and TR removed.
- **Test conftest:** `StaticPool` (SQLite in-memory, one connection per test).
- **Membership lifecycle:** deactivate = soft-delete (`is_active = False`, reversible); remove = hard-delete (blocked by FK if any Membership purchased). Industry standard (Mindbody/Glofox).
- **`resolveApiError(err, fallback)`:** platform-wide error utility. Priority: `errorMessages[code]` → `err.message` → `fallback`. `apiClient` rejects with plain `ApiError` object (not `Error` instance) — `instanceof Error` checks always fail.
- **Dashboard color system:** `primary_color` for quantity metrics (memberships, revenue); `secondary_color` for rate metrics (retention, check-in). All hex colors passed via `style={}`, never Tailwind classes.
- **`template_name` in ScheduledClassResponse:** added via SQLAlchemy outerjoin + post-validation attribute assignment (Pydantic V2 models are mutable by default). No ORM model change needed.

---

## Landing page (agon-studio.dev)
- Source: `landing/` — Next.js 15 static export, deployed via `npx vercel --prod` from `landing/` dir.
- After deploy: `vercel alias set <url> agon-studio.dev && vercel alias set <url> www.agon-studio.dev`.
- Do NOT run vercel from monorepo root — it uploads 15 GB.

---

## Known Open Items
- `get_class_roster` Italian phrasings not 100% reliable — 3B model still picks wrong tool occasionally.
- Playwright e2e tests are scaffold only (no real backend needed; use `page.route()`).
- Mobile: booked count per class not shown on Today's classes (requires new backend field on ScheduledClass).

---

## Next Task Candidates

- **Electron auto-update** (`electron-updater` + GitHub releases + Alembic migration on relaunch)
- **Multi-location support** (`location_id` already on all tables; backend ready; needs UI routing)
- **Reports page enrichment** — surface `by_class_template` and `by_membership_type` charts there too
- **Waitlist notifications** — push when a spot opens (Expo push already wired for bookings)
- **Client app: booking history screen** — list past + upcoming bookings with status
