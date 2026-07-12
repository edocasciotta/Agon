# Agon — Task Log Archive

*Full forensic detail for closed/merged work, moved out of `TASK_LOG.md` on 2026-07-12 to keep the
active log fast to read. `TASK_LOG.md` keeps a one-line summary + PR link for each entry below; come
here only when you need the "why"/root-cause detail behind a specific past fix or feature round.*

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

## Test Fix (2026-07-10) — uncommitted, branch `claude/youthful-feynman-84d711`

`test_multi_turn_conversation_accumulates_slots_correctly` (`backend/tests/test_agent.py`) was
flagged as failing reproducibly. Investigation found it was a daily flake, not the double-resolution
bug it was first suspected to be: the test computed its expected date via raw
`datetime.utcnow().date()`, while production (`_studio_local_today` in `app/routers/agent.py`)
correctly anchors "domani"/"tomorrow" resolution to the studio's *local* timezone (default
Europe/Rome) — intentional, documented behavior already locked in by the sibling regression test
`test_relative_date_anchored_to_studio_timezone_not_utc`. The two diverge for ~1-2 hours every day
(whenever Rome's calendar date has advanced past UTC's), causing a reproducible one-day-off failure.
Fixed by freezing the clock in the test (same `FrozenDateTime` pattern as the sibling test) instead
of touching app logic. `agent_tools.py` untouched — no bug there.

- Only file touched: `backend/tests/test_agent.py` (single test function).
- Full backend suite: 288 passed after fix. `black`/`isort`/`ruff` clean.
- Committed `eb9823f`; PR [#8](https://github.com/edocasciotta/Agon/pull/8).

---

## Infra Fix (2026-07-10) — Vercel landing deploy broken since project creation

The "Vercel" GitHub check had been failing on every branch, including `main` (confirmed on
`main`@`c9e1486`), since the `landing` Vercel project was created (2026-07-04): `next build`
errored with "Couldn't find any `pages` or `app` directory" because the project's **Root
Directory** setting was `.` (monorepo root) instead of `landing`. Not a code issue —
`landing/app/` was present and correct the whole time.

Fixed via the Vercel REST API (`PATCH /v9/projects/{id}` with `rootDirectory: "landing"`) since
the `vercel project` CLI has no subcommand for this setting. Verified by redeploying the failed
deployment (`vercel redeploy`) — build succeeded in 57s. This is a project-level setting, so it
fixes deploys for all branches going forward, not just PR #8.

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

## Bug Fix — Email + SMS settings secret wipe (2026-07-10/11, resolves `task_fcd35817`)

**Symptom:** Saving the Settings → Email (or, once it existed, SMS) tab for any reason (e.g.
toggling TLS) silently cleared the stored secret (SMTP password / Twilio auth token) server-side,
breaking outbound email/SMS with no visible error.

**Root cause:** the GET endpoints never return the real secret (masked display value only).
`Settings.tsx`'s sync effects reset the secret field to `''` on every load. The old save handlers
sent the whole form unconditionally, so `''` was always in the payload unless the user retyped the
secret that session. Backend contract (`email_settings.py` / `sms_settings.py`, unchanged, correct):
`None`/absent = don't touch, `""` = explicit clear — so every such save hit the "clear it" branch.

**Fix (frontend only):** `Settings.tsx` tracks a per-field touched flag (`emailPasswordTouched`,
`smsAuthTokenTouched`), true only when the user edits that specific field, reset to `false` whenever
the corresponding settings query (re)loads. Both save handlers omit the secret key from the payload
entirely (object destructure, not `undefined`/`''`) unless the flag is set. Regression tests in
`Settings.test.tsx` exercise the full type→save→refetch→unrelated-change→save flow for each tab;
both verified to fail without their respective fix.

**Timeline note (how this played out across two sessions):** this branch (PR #9) initially fixed
only Email, since at the time no SMS settings tab/router/Twilio integration existed anywhere in this
codebase (confirmed via grep + `git log --all` + both spec docs — correct for the state of the repo
at that point). `origin/main` then merged PR #12, which built a new SMS tab mirroring Email's
architecture "pixel-for-pixel" — including this identical bug, which that session found and flagged
separately as `task_fcd35817`. Merging `origin/main` into this branch surfaced the SMS tab; the fix
was then extended to cover it in the same PR, closing `task_fcd35817` instead of leaving it as a
separate follow-up.

**Files touched:** `frontend/src/renderer/src/pages/Settings.tsx`, `frontend/tests/unit/pages/Settings.test.tsx`, `CHANGELOG.md`. No backend changes in either round. Verified independently by the orchestrator both rounds: `npm run build`/`lint`/`test -- --run` clean; lint warning counts diffed against baseline (stash-based pre-merge, isolated-diff post-merge) — no new warnings beyond what merging in the SMS tab's own pre-existing effect pattern already introduced. Backend re-verified post-merge: `alembic heads` single head, `pytest -q` 523/523.

**Status:** merged to `main` via PR #9 (`aefe8fd`, 2026-07-11).

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
| 1.9 | Forms / Waivers | ✅ | ✅ | ❌ (still not built as of 2026-07-12 — see `TASK_LOG.md` Known Open Items) |

### Notes — recovering truncated agent sessions (2026-07-07 → 2026-07-09)
Two rounds of sub-agents hit the weekly usage limit mid-task (session gap over the weekend). Recovery required several small follow-up delegations rather than a straight accept:
- **1.4 frontend**: locale JSON files were missing closing braces (agent cut off before finishing the write). Fixed manually — mechanical syntax repair, not a code change.
- **1.5 backend**: agent was truncated but had already written complete, correct code — 377 tests passed on first verification. No fix needed.
- **1.5 frontend** (Tags page, client detail badges, auto-tag rules): component code, routes, types, Zod schemas were all correct, but the agent was cut off *before* writing any of the 33 required i18n keys (`tags.*` namespace + `nav.tags` + 4 `clientDetail.*` keys) to the 7 locale files — the UI would have rendered raw key strings. Re-delegated a tightly-scoped follow-up with the exact key list and English reference text; verified real (non-English-copy) translations landed in all 7 files.
- **Pre-existing flaky test unmasked**: `test_checkout_with_promo_code_metadata` started failing (377→376 passed) because `backend/.env` picked up a real Stripe test-mode secret key (likely set for manual testing over the weekend), and the test wrongly assumed Stripe would always be unconfigured instead of isolating `settings.STRIPE_SECRET_KEY` explicitly like its sibling tests do. Fixed with the same save/set/restore pattern used elsewhere.
- **Mobile regression**: the original promo-code agent changed `createCheckoutSession` to accept an optional `promoCode` 3rd arg, but the call site always passed it (even as explicit `undefined`), which broke `purchase.test.tsx`'s 2-arg assertion (Jest treats `fn(a,b)` and `fn(a,b,undefined)` as different call signatures). The agent had been cut off before running its own final test pass to catch this. Fixed by only passing the 3rd arg when a promo is actually applied.
- **Lesson for future rounds**: when a sub-agent's run ends in a truncated/limit-hit summary rather than a clean "done" report, do not accept on file-existence alone — diff against HEAD, grep every new `t('...')` call against the reference locale, and run the *exact* test commands from that agent's CLAUDE.md before moving on. All of the above would have been caught by the agent's own acceptance criteria had it not been cut off before reaching them. (Generalized into the "Nested Sub-Agent Delegation" hazard note in the main `TASK_LOG.md`.)
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
- **Separately flagged, then fixed** (2026-07-12, PR #24 — see below): `app/models/location.py`'s
  `Location` model was never imported into `app/models/__init__.py`, so it was absent from
  `Base.metadata` — a future `alembic revision --autogenerate` would have proposed `DROP TABLE locations`.

### Unrelated pre-existing bug found during final verification (2026-07-09/10)

`tests/test_agent.py::test_multi_turn_conversation_accumulates_slots_correctly` failed reproducibly
at the time — resolved "domani" (tomorrow) as **+2 days** instead of +1 when the date slot was carried
unresolved across conversation turns and only resolved on the final turn. Confirmed pre-existing
(neither `agent_tools.py` nor `test_agent.py` touched this session; last commit on the test was
2026-07-03) and confirmed NOT a simple midnight-boundary race (whole test runs in ~0.45s; a race
could only ever cause a 1-day discrepancy, not 2). Root cause not found at the time — flagged as
background task `task_d47f72c7`. **Update:** re-ran the full suite after 1.7 SMS backend landed —
this test passed cleanly both in the agent's run and in an independent re-run, and has stayed green
since. Never root-caused further; treat as resolved/non-reproducing unless it recurs.

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

**Real bug found during verification** — see "Bug Fix — Email + SMS settings secret wipe" above
(PR #9): saving either the Email or SMS tab in Settings, for any reason, silently wiped the stored
secret. Confirmed pre-existing on Email and faithfully replicated on SMS (task brief explicitly
asked to mirror the email architecture exactly) — correctly not a new bug introduced by this round.

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
- **Real finding, flagged then fixed** (`task_549372fa`, closed via PRs #11/#13 above): uvicorn's own
  access logger prints the full request line — including the raw token — to stdout by default,
  bypassing the app's own PII redaction filter.

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
  then self-reported it was safe. Given how much uncommitted work had accumulated across that whole
  session (every feature since 1.4 — nothing had been committed), this was independently re-verified
  rather than taken on trust: confirmed all 5 locale namespaces added that day (`promoCodes` 30 keys,
  `tags` 28, `giftCards` 25, `sms` 34, `calendarSync` 10) were still present with correct key parity
  across all 7 locales, and all three test suites were still fully green. Nothing was lost, but a
  `git stash` in a working tree that loaded with irreplaceable uncommitted output was flagged as a
  real risk.

---

## Competitive Gap — Phase 2 (2026-07-12)

Started per user decision: highest-priority remaining gap first (Appointments, RICE score 19/20,
"Critical" in `docs/COMPETITIVE_ANALYSIS_2026_07.md`), backend-only round (same incremental cadence
as Phase 1's 1.1–1.9), frontend/mobile/docs to follow as separate rounds.

### 2.1 Appointments (1-on-1 booking) — backend (2026-07-12)

579 tests passing (+56 from 523). No PRODUCT_SPEC/TECHNICAL_SPEC section existed (post-V1 addition,
same situation as Gift Cards) — designed by mirroring the class/booking engine's conventions.
Built in an isolated worktree (`.claude/worktrees/agent-ac4c27c662b698c26`), 4 incremental commits.
Verified independently, not accepted on self-report alone (per the "Nested Sub-Agent Delegation"
hazard note in the main `TASK_LOG.md`): re-ran the full suite, ran `alembic heads`/`black`/`isort`/
`ruff` independently rather than trusting the agent's "all clean" claim, and read the router/test
diffs directly.

- **Models**: `AppointmentService` (manager-defined 1-on-1 service type — name, duration, buffer
  time), `InstructorAvailability` (weekly-recurring windows only, no date exceptions/holidays yet),
  `Appointment` (1:1, not roster-based — client + instructor + service + time range). Migration
  `a44e65e56442`, single head.
- **Endpoints**: `/appointment-services` CRUD (manager-only, soft-delete), `/instructor-availability`
  (manager any instructor, instructor only their own), `GET /appointments/available-slots` (computes
  open slots from availability minus existing bookings minus buffer), `POST /appointments` (mixed
  client/manager-booking-for-client audience, same IDOR pattern as bookings, rate-limited 10/min),
  `GET /appointments[/{id}]`, `PATCH /appointments/{id}/cancel`, `PATCH /appointments/{id}/complete`.
- **Payment model**: reuses the existing membership-credit deduction/refund/late-cancel-fee helpers
  from `booking_service.py` directly (confirmed no parallel logic was written) — no separate
  Stripe pricing path for appointments in this round.
- **Real bug caught during independent verification, not the agent's report**: agent claimed
  `black`/`isort`/`ruff` were clean on every touched file; running `isort --check` directly showed
  `app/models/appointment.py` and `app/services/appointment_service.py` had `app.*` imports placed
  after third-party `sqlalchemy` imports — inconsistent with every other model in the codebase
  (`scheduled_class.py`/`booking.py` both put `app.database` first) and a real isort violation, not
  just the known pre-existing ruff/isort config-mismatch noise. Fixed directly (2-line import
  reorder), re-ran the affected test files (110/110), committed separately in the worktree.
- **Explicitly out of scope, not built**: recurring appointments, duo/group appointments,
  room/resource booking, intake forms, SOAP notes, add-on services, availability
  exceptions/holidays, standalone Stripe pricing (credits only, matching classes).
- **Merged to `main`** via PR [#18](https://github.com/edocasciotta/Agon/pull/18) (`cded8b4`,
  2026-07-12). All CI checks passed before merge.

### 2.1 Appointments (1-on-1 booking) — desktop frontend (2026-07-12)

98 tests passing (+24 from 74). Built in an isolated worktree
(`.claude/worktrees/agent-ab0432d6f9490cf62`), 4 incremental commits. Deliberately does **not**
touch `Calendar.tsx` or its supporting modals — appointments get their own page rather than being
integrated into the existing class-scheduling grid, to avoid regression risk on a large, working,
heavily-tested file. Verified independently (build/lint/test re-run, i18n parity checked
programmatically, spot-checked the flagged bug fixes and role-gating logic directly in the diff) —
not accepted on self-report alone.

- **New page** `pages/Appointments/index.tsx`, tabbed (mirrors `Settings.tsx`'s tab pattern):
  **Upcoming** (agenda/list view — NOT a calendar grid, that's explicitly deferred — filters by
  instructor/date/status, cancel + complete/no-show row actions), **Services** (CRUD for
  `AppointmentService`, mirrors `ClassTypes.tsx`, soft-delete only), **Availability** (per-instructor
  weekly recurring schedule editor — simple form grid, not drag-to-select).
- **`BookAppointmentModal.tsx`**: service → instructor → date → fetches `available-slots` →
  pick slot → client search (reuses `ManageBookingsModal.tsx`'s typeahead pattern) → notes → confirm.
- Nav entry `/appointments` (CalendarClock icon) right after `/calendar`. 84 new i18n keys × 7
  locales = 588 strings, parity verified programmatically (zero missing in any locale).
- **Availability tab role-gating — no existing precedent, agent's call, reviewed and confirmed
  correct**: managers get a full instructor picker; instructors (role=`instructor`) see only their
  own record, no dropdown; mirrors the backend's own `require_staff` + `_assert_can_manage` gate in
  `instructor_availability.py`.
- **Real bugs the agent found and fixed in its own new code** (verified, not just trusted):
  installed Zod is 4.4.3, whose API is `.issues` not `.errors` — using `.errors` throws an uncaught
  TypeError on any invalid submit; fixed in `ServicesTab.tsx` and `BookAppointmentModal.tsx`. Also
  fixed `AvailabilityTab` gating its instructors-list query on manager-only (would've rendered blank
  for an instructor caller) and wired in proper Zod validation instead of ad-hoc checks.
- **Known latent bug, correctly left alone**: 15 pre-existing call sites elsewhere in the codebase
  still use the same wrong `.errors` API — real, but out of scope for this task, flagged separately.
- **Real, unrelated, pre-existing bug found and confirmed independently**: `Login.tsx`'s email/password
  `<label>` elements had no `htmlFor`/`id` association, so Playwright's `page.getByLabel(...)` — the
  standard helper used in every existing e2e spec in this repo, including `auth.spec.ts` — never
  resolved. Confirmed via direct grep + running `auth.spec.ts` (5/5 fail at that line) on `main`, not
  just the worktree. Flagged as a background task (`task_55959579`); **fixed** via PR #20 (see below).
- **Explicitly out of scope, not built**: appointments on the main calendar grid, recurring/duo/group
  appointment UI, room booking, intake forms, mobile app, docs-site page.
- **Merged to `main`** via PR [#19](https://github.com/edocasciotta/Agon/pull/19) (`5661d50`,
  2026-07-12). All CI checks passed before merge.

---

## E2E Login/A11y Fix + Test Speed-up (2026-07-12) — PRs #20, #21

Discovered already merged to `main` at the start of this session (done in a separate concurrent
session, `task_55959579`, flagged during Appointments desktop frontend verification above).

- **PR [#20](https://github.com/edocasciotta/Agon/pull/20)**: fixed the `Login.tsx` label/`htmlFor`
  bug that broke `page.getByLabel(...)` for every e2e spec, plus three more bugs found once the
  suite could actually run past login: wrong button-text regex in four specs, missing post-login
  route mocks causing the global 401 interceptor to bounce tests back to `/login`, and missing
  `role="dialog"`/label wiring on `ScheduleClassModal`/`Instructors`/`Clients` (same bug class as
  Login). Net: e2e suite 0/16 → 17/17 passing.
- **PR [#21](https://github.com/edocasciotta/Agon/pull/21)**: `test_no_overbooking_under_load`
  34s → ~1s by replacing per-client HTTP login round-trips with direct JWT creation and hashing the
  shared test password once instead of per-client. 579/579 backend tests still pass.

Both verified present on `main` (`87f8a57`, `7bfb9cd`) via `git log`/`gh pr view` at session start.

---

## Docs-site batch pass for 1.1–1.9 (2026-07-12)

Delegated to the Docs Agent in an isolated worktree (avoids the shared-checkout `git reset` hazard),
with incremental commits per feature group so a mid-task truncation wouldn't lose work. Verified
independently before accepting: re-ran `npm run build`, re-checked the locale-key claim against
`frontend/src/renderer/src/locales/en.json`, and grepped `mobile/` for waiver-signing UI.

**Scoping call:** 1.1 (fees), 1.2 (rollover credits), 1.3 (intro offers) are form fields inside the
existing Settings page and Membership Type form, not separate screens — so no standalone top-level
pages were created for these three; instead `studio-manager/settings.md` and
`studio-manager/memberships.md` got new subsections.

**New pages:** `studio-manager/{promo-codes,tags,gift-cards,sms-messaging,calendar-sync,waivers}.md`,
`clients/calendar-sync.md` — all wired into `sidebars.ts`.

**Corrected a real, pre-existing doc bug found during this pass:** `clients/memberships.md` claimed
"unused credits from the previous period do not carry over" — false since 1.2 (rollover credits)
shipped. Fixed, plus added promo-code/gift-card/intro-offer notes to the purchase-flow section.

**Honest gap surfaced, not papered over:** no mobile waiver-signing screen existed anywhere in
`mobile/` (confirmed via grep, zero hits) despite 1.9 backend enforcing client-self-signing at the
time. The new `WAIVER_SIGNATURE_REQUIRED` troubleshooting entry in `clients/booking-a-class.md` told
the client to contact their studio directly instead of describing a signing flow that didn't exist
yet.

**Brief errors the agent caught and fixed rather than silently working around:**
- Told it fee-override/rollover/intro-offer locale keys live under a `membershipTypes` namespace —
  wrong, no such top-level key exists; they're under `memberships`. It verified against the actual
  JSON and corrected every reference.
- Told it CHANGELOG's `[Unreleased]` already had entries for all nine features — wrong, six
  (fees, rollover, intro offers, promo codes, tags, calendar sync) had zero mentions anywhere in the
  file. It backfilled them from the actual code rather than skip the quality gate.

9 new glossary entries added (Rollover Credit, Intro Offer, Late Cancellation/No-Show Fee, Promo
Code, Gift Card, Tag, Auto-Tag Rule, Waiver, Calendar Sync Token). `npm run build` inside
`docs-site/`: zero errors, zero broken-link warnings (independently re-run).

**Status:** merged to `main` via PR [#17](https://github.com/edocasciotta/Agon/pull/17)
(`9567627`, 2026-07-12). All CI checks (Backend/Frontend/Mobile Tests, Vercel) passed before merge.

---

## 2.1 Appointments — mobile client frontend + docs (2026-07-12)

Closes out the Appointments feature across all four surfaces (backend PR #18, desktop frontend
PR #19, mobile PR #23, docs PR #22 — all merged to `main`). Both built in isolated worktrees in
parallel, verified independently before merge (re-ran tests/build/typecheck, did not accept either
agent's self-report alone).

- **Mobile** ([#23](https://github.com/edocasciotta/Agon/pull/23)): new top-level "Appointments" tab
  (`CalendarClock` icon) — deliberate call over nesting into Bookings/Classes, since the
  service→instructor→date→slot booking flow is a different shape from the weekly class grid.
  `app/appointment/book.tsx` (step flow) + `app/(tabs)/appointments.tsx` (upcoming/past list, cancel
  with confirm). New typed API clients (`appointments.ts`, `appointmentServices.ts`,
  `instructors.ts`), 39 real i18n keys × 7 locales, `agon://appointments/{id}` deep link (routes to
  the tab, not a per-id detail screen — none exists yet, matching the pre-existing state of the
  `bookings`/`waitlist` deep links). 65/65 tests passing (58 pre-existing + 7 new), `tsc --noEmit`
  clean, `expo export` clean. Flagged gap: `mobile/package.json` has no `lint` script at all
  (pre-existing, unrelated).
- **Docs** ([#22](https://github.com/edocasciotta/Agon/pull/22)): `studio-manager/appointments.md` +
  `clients/appointments.md` (client guide written generically since mobile screens weren't merged
  yet at write time — no invented screen names), 3 new glossary entries, first-ever generation of
  `docs/api/endpoints/` (36 files) via `fetch-openapi.js`, wired into `sidebars.ts`. Caught and fixed
  a real pre-existing doc bug: `api/overview.md` documented a nonexistent `BOOKING_NO_VALID_MEMBERSHIP`
  error code — the actual code (`bookings.py`, `appointments.py`, `errorMessages.ts`) uses
  `BOOKING_NO_MEMBERSHIP`. `npm run build` clean, zero broken links.
- **Process note**: a `TASK_LOG.md` commit logging PR #20/#21's discovery had been made locally
  but never pushed to `origin/main` before spawning these two worktree agents — surfaced as a stale
  `TASK_LOG.md` diff in the mobile PR that looked like a revert. Fixed by pushing `main` and
  re-merging both branches before opening PRs; worth remembering that local commits in the shared
  checkout need to actually reach `origin` before spawning worktree agents off of it.

---

## Bug Fix — `Location` model missing from `Base.metadata` (2026-07-12) — PR #24

`Location` (`backend/app/models/location.py`, table `locations`) is used at runtime by
`routers/locations.py` and has its own migration (`ea32f91fea27`), but was never imported in
`backend/app/models/__init__.py` — absent from `Base.metadata`. Consequence, confirmed directly:
`alembic check` proposed a spurious `remove_table('locations')`; a future `alembic revision
--autogenerate` would have generated a real `op.drop_table('locations')`.

Originally flagged as a background task during the Gift Cards round (2026-07-09). Found already
fixed — but sitting uncommitted for 6 days — in a stale worktree from an earlier, unrelated session
while cleaning up leftover `.claude/worktrees/*` directories. Not accepted on sight: verified
independently before merging — `alembic check` before the fix reproduces the `remove_table`
proposal, after the fix it's gone (remaining `alembic check` noise is pre-existing, unrelated SQLite
nullable/index/constraint drift on `auto_tag_rules`/`client_tags`/`gift_cards`/`tags`/`waivers`,
confirmed present independent of this change), `black`/`isort`/`ruff` clean, full backend suite
579/579 passed. Merged via PR [#24](https://github.com/edocasciotta/Agon/pull/24).

**Worktree cleanup, same session:** of the 5 stray `.claude/worktrees/*` directories found (beyond
the 2 this session's own agents used, already cleaned up post-merge), 3 belonged to other
sessions — 1 was clean and already fully landed in `main` via PR #20 (removed, nothing lost), 1 was
the `Location` fix above (recovered and merged), 1 (`agent-a35b2441df1a3e297`, LLM fine-tuning
scaffold) had uncommitted changes that were confirmed byte-identical to what's already merged into
`main` via commit `3e333ec` — a stale duplicate with zero unique content, discarded.

---

## Cleanup — orphaned `pl.json`/`tr.json` locale files (2026-07-12) — PR #25

`frontend/src/renderer/src/locales/pl.json` and `tr.json` existed alongside the 7 canonical locale
files, contradicting `frontend/CLAUDE.md`'s explicit "EN, IT, FR, DE, ES, PT, NL — 7 only. Do not
add PL or TR" rule. Investigated before deleting: `frontend/src/renderer/src/i18n.ts` only imports
and registers the 7 canonical locales (`_SUPPORTED_LANGS` array matches exactly), and a repo-wide
grep for `pl.json`/`tr.json`/language-switcher references found zero hits outside the two JSON files
themselves — confirmed orphaned, not wired into the i18n config or any UI. Deleted both files
directly (no sub-agent delegation needed — pure dead-file removal, not an application-code change).
Merged via PR [#25](https://github.com/edocasciotta/Agon/pull/25).
