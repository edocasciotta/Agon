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

## Security Hardening (2026-07-10) — PRs #11, #13

Secret invitation token leaked via uvicorn's own access log. `GET /api/v1/auth/invite/{token}`
(`auth.py:300`) puts a long-lived (7-day), single-use `uuid.uuid4()` token in the URL path — the
only viable auth mechanism before the client has a password. uvicorn's `uvicorn.access` logger is
configured with `propagate=False` and its own handler (confirmed against installed uvicorn
source), so the app's `PIIRedactionFilter` (attached to the root logger only) never saw these
lines — every request printed the raw token to stdout unredacted, on both the dev
(`uvicorn main:app --reload`) and Electron-spawned (`frontend/src/main/index.ts`) launch paths.

| # | Severity | Fix |
|---|---|---|
| 1 | Medium | `AccessLogTokenRedactionFilter` added to `app/logging_config.py`, attached directly to the `uvicorn.access` logger. Redacts `/api/v1/auth/invite/{token}` path segments to `[redacted-token]` while preserving uvicorn's positional 5-tuple `record.args` shape (naively nulling `args` the way `PIIRedactionFilter` does breaks `AccessFormatter`'s unpacking). Pattern list is extensible for future secret-in-URL endpoints. Tests in `tests/test_logging_config.py`, mutation-tested — confirmed they fail when the redaction is sabotaged. No DB/API changes — no migration, no docs-site page needed. (PR #11) |
| 2 | Low | `GET /invite/{token}` and `POST /reset-password` (both in `auth.py`) validate a secret token but had no `@limiter.limit`, unlike every sibling auth endpoint — inconsistent with `SECURITY_GUIDELINES.md` §1.5. Added `@limiter.limit("10/minute")` (per-IP, matching `login`/`refresh`) to both. Tokens are `uuid.uuid4()` (122 bits) so brute force wasn't practical either way — this is guideline-consistency/defense-in-depth, not an urgent exploit. Tests in `test_auth.py` follow the existing `test_booking_rate_limit_disabled_in_test_env` convention (decorator-presence check, since `AGON_ENV=test` disables actual enforcement). `POST /clients` (invite creation) was checked and left alone — already gated by `require_manager`, not an anonymous target. (PR #11) |
| 3 | Medium | `GET /api/v1/calendar/{token}.ics` (`calendar_sync.py`, landed separately via the competitive-gap work after #1/#2 above) had a docstring claiming its token "is never logged" that wasn't actually true — that commit never touched `logging_config.py`. Extended `_ACCESS_LOG_SECRET_PATTERNS` with one line for `/api/v1/calendar/`, same mechanism as #1. This token (`secrets.token_urlsafe(32)`) is long-lived and repeatedly polled by external calendar apps over months, so more cumulative exposure than the single-use invite token. Tests added to `tests/test_logging_config.py` mirroring the invite-token tests exactly. (PR #13) |

**Note:** #1/#2 were originally investigated as a hypothetical `GET /api/v1/calendar/{token}.ics` in
a `calendar_sync.py` that did not exist anywhere in this repo, on any branch, or in the specs, at
the time. Confirmed real equivalents instead (`/invite/{token}`, `/reset-password`) before
delegating those two fixes. `calendar_sync.py` then landed for real via concurrent, unrelated
competitive-gap work shortly after — and turned out to have exactly the originally-hypothesized bug
once it existed, closed by #3.

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

## Competitive Gap — Phase 1 (2026-07-09)

Closing top gaps from `docs/COMPETITIVE_ANALYSIS_2026_07.md`.

**Docs-site debt (user decision 2026-07-09):** Features 1.1–1.5 shipped without `docs-site/` pages,
violating orchestrator rule #2. User chose to **batch documentation at the end of Phase 1** rather
than backfill now or gate each remaining feature on it. Action item: once 1.9 (Forms/Waivers) lands,
delegate one docs agent pass covering 1.1–1.9 (fees, rollover, intro offers, promo codes, tags,
gift cards, SMS, calendar sync, forms) before starting Phase 2.

### Test Counts (1.1–1.5 complete)
| Suite | Count | Status |
|---|---|---|
| Backend (pytest) | 377 | ✅ |
| Frontend (Vitest) | 53 | ✅ |
| Mobile (jest-expo) | 44 | ✅ |

### Feature Status
| # | Feature | Backend | Frontend | Mobile |
|---|---------|---------|----------|--------|
| 1.1 | Late Cancel / No-Show Fees | ✅ | ✅ | n/a |
| 1.2 | Rollover Credits | ✅ | ✅ | ✅ |
| 1.3 | Intro Offers | ✅ | ✅ | ✅ |
| 1.4 | Promo Codes | ✅ | ✅ | ✅ |
| 1.5 | Tags + Auto-Tag Rules | ✅ | ✅ | ✅ (view-only) |
| 1.6 | Gift Cards | ✅ | ✅ | ✅ |
| 1.7 | SMS Messaging | ✅ | ✅ | n/a |
| 1.8 | Calendar Sync iCal | ✅ | ✅ | ✅ |
| 1.9 | Forms / Waivers | 🔄 in progress | — | — |

### Notes — recovering truncated agent sessions (2026-07-07 → 2026-07-09)
Two rounds of sub-agents hit the weekly usage limit mid-task (session gap over the weekend). Recovery required several small follow-up delegations rather than a straight accept:
- **1.4 frontend**: locale JSON files were missing closing braces (agent cut off before finishing the write). Fixed manually — mechanical syntax repair, not a code change.
- **1.5 backend**: agent was truncated but had already written complete, correct code — 377 tests passed on first verification. No fix needed.
- **1.5 frontend** (Tags page, client detail badges, auto-tag rules): component code, routes, types, Zod schemas were all correct, but the agent was cut off *before* writing any of the 33 required i18n keys (`tags.*` namespace + `nav.tags` + 4 `clientDetail.*` keys) to the 7 locale files — the UI would have rendered raw key strings. Re-delegated a tightly-scoped follow-up with the exact key list and English reference text; verified real (non-English-copy) translations landed in all 7 files.
- **Pre-existing flaky test unmasked**: `test_checkout_with_promo_code_metadata` started failing (377→376 passed) because `backend/.env` picked up a real Stripe test-mode secret key (likely set for manual testing over the weekend), and the test wrongly assumed Stripe would always be unconfigured instead of isolating `settings.STRIPE_SECRET_KEY` explicitly like its sibling tests do. Fixed with the same save/set/restore pattern used elsewhere.
- **Mobile regression**: the original promo-code agent changed `createCheckoutSession` to accept an optional `promoCode` 3rd arg, but the call site always passed it (even as explicit `undefined`), which broke `purchase.test.tsx`'s 2-arg assertion (Jest treats `fn(a,b)` and `fn(a,b,undefined)` as different call signatures). The agent had been cut off before running its own final test pass to catch this. Fixed by only passing the 3rd arg when a promo is actually applied.
- **Lesson for future rounds**: when a sub-agent's run ends in a truncated/limit-hit summary rather than a clean "done" report, do not accept on file-existence alone — diff against HEAD, grep every new `t('...')` call against the reference locale, and run the *exact* test commands from that agent's CLAUDE.md before moving on. All of the above would have been caught by the agent's own acceptance criteria had it not been cut off before reaching them.
- Promo code validation endpoint: `POST /api/v1/promo-codes/validate` — clients validate codes during purchase (mobile: discount breakdown UI on purchase screen). Tags are manager-assigned only (desktop); mobile shows them read-only on the client profile.

### 1.6 Gift Cards — backend (2026-07-09)

408 tests passing (+31 from 377). No PRODUCT_SPEC/TECHNICAL_SPEC section existed for this feature
(post-V1 addition) — designed by mirroring the Promo Codes architecture. Reviewed personally
(money + IDOR risk) rather than accepted on the agent's self-report alone, per the lesson above.

- **Models**: `GiftCard` (code `GC-XXXXXXXX`, `initial_value`/`remaining_balance`, `purchaser_client_id`
  nullable FK, `recipient_name/email`, `message`, `expires_at`), `GiftCardRedemption` (audit trail,
  mirrors `PromoCodeUsage`). Migration `93a8001b6cef`, single head, verified clean on a fresh DB.
- **Endpoints**: `POST/GET /gift-cards`, `GET/DELETE /gift-cards/{id}` (manager-only), `POST
  /gift-cards/validate` (client or manager, read-only balance check), `POST
  /gift-cards/checkout-session` (Stripe self-purchase as a gift, separate flow from membership
  checkout — no `StripePrice` caching since amount is arbitrary per purchase).
- **Redemption at membership checkout**: `POST /api/billing/checkout-session` gained an optional
  `gift_card_code` field. Balance is capped (`min(balance, price)`) and only actually deducted on
  webhook `checkout.session.completed` (mirrors promo-code-usage timing) — an abandoned checkout
  never burns the gift card. Full-coverage edge case (gift card pays the entire price) bypasses
  Stripe entirely — Stripe Checkout can't do a $0 line item — grants the membership synchronously
  and redeems immediately; explicitly excluded for recurring/subscription memberships.
  Response shape extended backward-compatibly: `{checkout_url, session_id, already_completed,
  membership_id}`.
- **Verified directly** (not just trusted the agent report): webhook idempotency check
  (`StripeWebhookEvent.stripe_event_id`) happens *before* dispatch, so retried Stripe deliveries
  can't double-create/double-redeem a gift card; `purchaser_client_id` always derives from the
  caller's JWT `sub`, never a client-suppliable field, so there's no IDOR vector for attributing a
  purchase to someone else.
- **Known minor limitations** (not blocking, not re-delegated): `GiftCardPurchaseRequest.amount` has
  no Pydantic `gt=0`/max bound — Stripe rejects bad values server-side so it degrades to a 502
  instead of a clean 422 (same looseness already present on `PromoCodeCreate.discount_value`, not a
  new gap). Gift card purchase currency is hardcoded `"EUR"` regardless of the studio's configured
  currency.
- **Separately flagged, not fixed here** (correctly out of scope): `app/models/location.py`'s
  `Location` model is never imported into `app/models/__init__.py`, so it's absent from
  `Base.metadata` — a future `alembic revision --autogenerate` would propose `DROP TABLE locations`.
  Background task spawned by the agent to track this.

### Unrelated pre-existing bug found during final verification (2026-07-09/10)

`tests/test_agent.py::test_multi_turn_conversation_accumulates_slots_correctly` fails reproducibly
right now — resolves "domani" (tomorrow) as **+2 days** instead of +1 when the date slot is carried
unresolved across conversation turns and only resolved on the final turn. Confirmed pre-existing
(neither `agent_tools.py` nor `test_agent.py` touched this session; last commit on the test was
2026-07-03) and confirmed NOT a simple midnight-boundary race (whole test runs in ~0.45s; a race
could only ever cause a 1-day discrepancy, not 2). Root cause not yet found — flagged as background
task `task_d47f72c7` with investigation notes rather than derailing into it mid–Gift-Cards-verification.
Unrelated to Promo Codes/Tags/Gift Cards; likely worth fixing before it undermines confidence in the
AI agent feature area. **Update:** re-ran the full suite after 1.7 SMS backend landed — this test
passed cleanly both in the agent's run and in my own independent re-run. Not investigated further;
still worth a real fix per the flagged background task, but no longer blocking confidence in the
green baseline.

### 1.7 SMS Messaging — backend (2026-07-10)

449 tests passing (+41 from 408). Mirrors the Email system architecture exactly (`SmsTemplate` /
`SmsEventAssignment` parallel `EmailTemplate`/`EmailEventAssignment`, reusing the same `EVENT_TYPES`
list from `email_event_assignment.py` rather than duplicating it), using Twilio (`twilio==9.10.9`)
as the provider. Deliberately scoped to match email's *actual* current reach (only wired into the
`password_reset` and `client_invite` flows in `auth.py`/`clients.py` — email itself doesn't fire on
`booking_confirmed`/`class_reminder`/etc. yet either, so SMS wasn't stretched further than that).

- **New capability beyond the email mirror**: `POST /api/v1/sms/send` — manager sends a one-off
  manual SMS to a specific client (no template/event involved). Not present in the email system;
  added because ad-hoc SMS is part of the actual competitive gap being closed.
- **Security-reviewed personally** (external credentials + PII): Twilio auth token is masked to
  last-4-chars (`••••1234`) on every `GET /settings` response, never returned in full. Phone numbers
  and the auth token are never logged. `TwilioRestException` is always caught and re-raised as a
  clean `SmsSendError`/`ValueError` — no raw third-party exception ever reaches a client response.
  13 IDOR tests confirm every `/api/v1/sms/*` endpoint is manager-only.
- **Operational note**: the long-running dev `uvicorn --reload` process (up since Monday) picked up
  the new SMS models via `Base.metadata.create_all()` before the migration ran, causing the same
  `alembic upgrade head` collision the Gift Cards migration hit. Resolved the same way — verified
  the live schema matched the hand-written migration column-for-column, then `alembic stamp head`
  rather than re-running DDL that had already applied.
- **Settings storage**: DB-only (`StudioSettings` row), matching how email SMTP settings actually
  work in this codebase (not `.env`, despite Stripe using `.env` for its secret — checked each
  system's real behavior rather than assuming consistency across all three).

### 1.7 SMS Messaging — frontend (2026-07-10)

64 tests passing (+6 from 58). New "SMS" tab in Settings (account SID / auth token / from number /
enabled / test-send, mirroring the email tab pixel-for-pixel), `SmsTemplates` + `SmsEvents` pages
mirroring `EmailTemplates`/`EmailEvents`, manual "Send SMS" action on `ClientDetail.tsx` (only shown
when the client has a phone on file). Nav/routes under the existing Marketing section. 34 `sms`
locale keys, real translations verified across all 7 languages.

**Real bug found during verification, not blocking, flagged separately (`task_fcd35817`):** saving
either the Email or SMS tab in Settings — for *any* reason, even an unrelated field — silently wipes
the stored secret (SMTP password / Twilio auth token) to null server-side. Root cause: the GET
endpoints only ever return a masked display value, so both forms reset the secret field to `''` on
load; the save handlers (`handleEmailSave`/`handleSmsSave`) send the *whole* form on every save,
including that now-empty secret field; the backend's partial-update contract treats an empty string
in the payload as "clear this credential" (`None` = leave alone, `""` = clear) — and since the
frontend always includes the key (never omits it), it always takes the clear branch unless the user
happens to retype the secret in that same save. This is pre-existing on the Email tab (confirmed via
the same code path) and was faithfully replicated on the new SMS tab because the task brief
explicitly asked to mirror the email architecture exactly — correctly not a new bug introduced by
this round, but real and worth fixing for both tabs together. Not silently accepted as a footnote:
flagged as a standalone task with full repro and a concrete fix direction (don't send the secret key
at all unless the user actually touched that field this session).

### 1.8 Calendar Sync iCal — backend (2026-07-10)

469 tests passing (+20 from 449). Different shape from 1.4–1.7: no CRUD/templates, just a long-lived
secret token embedded in a subscribable URL (`webcal`-style), since calendar apps (Google/Apple/
Outlook) poll a static URL and can't do OAuth/JWT login — the token in the path IS the credential.

- `Client.calendar_sync_token` (nullable, unique, lazily generated via `secrets.token_urlsafe(32)` —
  deliberately stronger/longer-lived than the existing `InvitationToken`'s `uuid4()`, since this
  token is polled repeatedly over months, not used once and expired).
- `GET/POST /api/v1/clients/{client_id}/calendar-sync[/regenerate]` — standard client-or-manager IDOR
  pattern already established in this codebase. `GET /api/v1/calendar/{token}.ics` — deliberately no
  JWT dependency, rate-limited (`10/minute`), generic 404 on bad token (no malformed-vs-unknown
  distinction), only `confirmed` bookings included, stable `uid` per booking so calendar apps don't
  duplicate events on re-poll, explicit UTC tzinfo attached before rendering (datetimes are stored
  UTC-naive in this codebase).
- **Real finding, flagged not fixed inline** (`task_549372fa`): uvicorn's own access logger (separate
  from this app's Python logging / PII redaction filter) prints the full request line — including the
  raw token — to stdout by default. The app's own code never logs it; this is a launch-configuration
  gap (`uvicorn ... ` with no `--no-access-log`/custom `log_config`), bounded in practice by this
  being a local-first desktop app but not zero-risk for the documented hosted/VPS deployment modes.
  Also worth checking whether invitation-link tokens (query-param based) have the same exposure.

### 1.8 Calendar Sync iCal — frontend + mobile (2026-07-10)

Frontend 68 tests (+4), mobile 58 tests (+8), backend re-confirmed 470/470 (the +1 vs. the 469 noted
above is pre-existing unrelated `test_memberships.py` coverage sitting uncommitted since before this
session — a `client_name`/`membership_type_name` enrichment test, unrelated to calendar sync; verified
it's harmless and not something any agent touched today).

- **Frontend**: new card on `ClientDetail.tsx` (manager can view/copy/regenerate a client's feed URL
  — useful for in-person troubleshooting). Regenerate uses a neutral (indigo) confirm, not the red
  destructive-delete pattern, since nothing is deleted, just rotated.
- **Mobile**: new "Sync to Calendar" section on the Profile screen (the primary surface for this
  feature) — "Add to Calendar" swaps `https://` → `webcal://` client-side before `Linking.openURL` to
  trigger the OS calendar app's native subscribe flow; "Copy Link" via newly-added `expo-clipboard`
  dependency; regenerate behind a two-button `Alert.alert` confirm.
- **Process note — verify after any operation that touches the working tree, not just the feature's
  own tests**: the frontend agent ran `git stash` / `git stash pop` mid-task to inspect file state,
  then self-reported it was safe. Given how much uncommitted work has accumulated across today's whole
  session (every feature since 1.4 — nothing has been committed), this was independently re-verified
  rather than taken on trust: confirmed all 5 locale namespaces added today (`promoCodes` 30 keys,
  `tags` 28, `giftCards` 25, `sms` 34, `calendarSync` 10) are still present with correct key parity
  across all 7 locales, and all three test suites are still fully green. Nothing was lost, but a
  `git stash` in a working tree this loaded with irreplaceable uncommitted output is a real risk next
  time — worth considering a checkpoint commit soon so future stash-like operations have a safety net.

---

## Next Task Candidates

- **1.9 Forms / Waivers** (backend + frontend + mobile) — last Phase 1 item
- **Bug fix**: Settings save silently clears SMTP/Twilio secrets on unrelated saves (`task_fcd35817`)
- **Bug fix**: uvicorn access log leaks secret tokens embedded in URLs (`task_549372fa`)
- **Consider**: a checkpoint commit — nothing from 1.4 onward (promo codes through calendar sync) has
  been committed yet; everything today has lived in the working tree only
- Docs-site batch pass for 1.1–1.9 once 1.9 lands (see "Docs-site debt" note above)
- Phase 2: Appointments, Marketing Automations, Web Widgets, Online Classes, Custom Roles, Payroll, Invoicing
