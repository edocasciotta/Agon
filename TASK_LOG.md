# Agon — Task Log
*Orchestrator memory. Updated after every completed task. Full forensic detail for closed work
lives in `TASK_LOG_ARCHIVE.md` — this file stays lean for fast reading at session start.*

---

## Project State (2026-07-12)

**All 12 build phases complete (0–11). V1 shipped. Post-V1 improvements A–R applied. Competitive
Gap Phase 1 (1.1–1.9) and Phase 2's Appointments (2.1) both fully shipped across all surfaces.**

### Test Counts
| Suite | Count | Status | As of |
|---|---|---|---|
| Backend (pytest) | 640 | ✅ (independently re-run) | PR #46 |
| Frontend (Vitest) | 126 | ✅ (independently re-run) | PR #47 |
| Mobile (jest-expo) | 116 | ✅ (independently re-run) | PR #45 |
| Docs build | — | ✅ | PR #43 |

### Active branch
`main` — through PR #47 (Mobile Access URL validation), merged 2026-07-14. The full 8-item mobile
UX request is done (items 1–8, PRs #30–#42), plus 5 follow-on fixes found during live user testing:
#38 (10000% check-in rate), #43 (missing docs-site pages), #44 (Expo Go crash-on-open: bad
expo-font/expo-splash-screen SDK pins), #45 (Expo Go crash-on-login: expo-notifications module-scope
error), #46 (VPN interface hijacking LAN IP auto-detection), #47 (unvalidated Mobile Access URL
field let a malformed value silently break QR onboarding). All merged and independently verified.
See the Shipped Feature / Fix Log and new Known Hazard section below for detail.

### Local dev
- Backend: `cd backend && .venv/bin/uvicorn main:app --reload` (entry point is top-level `backend/main.py`, not `app/main.py`)
- Frontend: `cd frontend && npm run dev`
- Mobile: `cd mobile && npx expo start`
- Local DB: `admin@example.com` / `password`
- Ollama: model `agon-assistant` must be loaded; if missing, agent calls fail silently.

---

## Known Hazard: Shared Main Checkout + `git reset` (2026-07-10)

Sessions routinely run with cwd directly in `/Users/edoardo/Projects/Agon` instead of an isolated
`.claude/worktrees/*` dir, so they share **one** working tree and index. On 2026-07-09/10 this
caused a real incident: a waivers-feature session's uncommitted edits, and a concurrent
memberships-pagination session's, were silently wiped. Root-caused via reflog forensics to repeated
`git reset --hard` calls (main checkout reflog showed five same-commit `reset: moving to HEAD`
events across 07-09/07-10), permitted by a blanket `Bash(git reset *)` entry in
`.claude/settings.local.json`. Each reset discards *all* uncommitted changes tree-wide, not just
the issuing task's own edits — worktrees themselves were confirmed properly isolated (separate
index/HEAD per `git worktree list --porcelain`) and were not the mechanism.

Both silently-wiped feature sets (waivers, and the rest of the 1.1–1.9 competitive-gap push) were
independently redone and merged via PR #12 before this note landed — no work was permanently lost,
but the underlying hazard needed a real fix, not just a lucky recovery.

**Fix applied:** removed the blanket `git reset` entry from the main checkout's
`.claude/settings.local.json` — resets there now require per-invocation confirmation instead of
running unattended.

**Still true going forward:**
- Prefer an isolated worktree for concurrent feature work (`isolation: "worktree"` on sub-agent
  Task calls, or a separate top-level session worktree) — the `.claude/worktrees/*` dirs in this
  repo never cross-contaminate each other or the main checkout.
- If working directly in the main checkout anyway, commit early/often as a checkpoint — nothing
  already committed can be `git reset --hard`'d away.
- A reflog full of repeated `reset: moving to HEAD` at the same commit is the diagnostic signature
  of this pattern — check `git reflog` first if files mysteriously revert.

---

## Known Hazard: Nested Sub-Agent Delegation Silently Produces Nothing (2026-07-11)

Delegating the 1.9 Waivers desktop-frontend task went through two attempts. The first: an
orchestrator-level agent spawned a frontend sub-agent, which — instead of writing the code itself —
spawned a *second-level* nested sub-agent (`spawnDepth: 3`) to do the actual work. That inner agent
hit a worktree-not-on-disk race, worked around it by manually recreating the worktree, then its
transcript **ended mid-task** right after a research/planning message, with zero `Write`/`Edit` calls
ever made and no commit. The outer agent reported back "waiting for it to complete" and moved on —
that status was never actually verified, just assumed. The failure was only caught because the
orchestrator independently checked `git status`/`find ... -iname "*waiver*"` after the "completed"
notification and found literally nothing on disk.

Confusingly, the same first-attempt agent **later resumed on its own** (many minutes afterward,
unprompted) via a stray notification, recreated its worktree again, and this time completed the
work for real — producing a fully independent, parallel implementation of the same feature, committed
to a separate branch (`worktree-agent-a4e8a1cac472597f3` / `b36f69e`). This happened concurrently with
a second, direct (non-nested) re-attempt the orchestrator had already dispatched in the shared
checkout, which is the version that actually got verified (build/lint/test independently re-run, plus
a live browser click-through) and kept. The duplicate branch/worktree was discarded after confirming
no unique content was in it.

**Takeaways:**
- Don't trust a sub-agent's "in progress" self-report as a completion signal — a `Task`-tool
  "completed" notification means the agent *stopped*, not that it *finished*. Verify with `git
  status`/`git diff`/file existence before accepting, every time, not just when something feels off.
- Explicitly instruct sub-agents not to spawn further nested sub-agents for a single well-scoped
  implementation task — nesting adds a layer where failures (and, as here, delayed unprompted resumes)
  are much harder to see.
- A "completed" notification can arrive **very late** for an agent that appeared to have already
  finished (or been abandoned) earlier in the session — don't assume an old task ID is dead just
  because you already got a report from it once.
- Reinforced repeatedly in practice (see `TASK_LOG_ARCHIVE.md`'s "recovering truncated agent
  sessions" note and every "verified independently, not accepted on self-report alone" line
  throughout the archive) — this is the single most load-bearing habit in this project's workflow.

---

## Known Hazard: Dev-Machine VPN Breaks Mobile Onboarding + Expo Go SDK-Mismatch Crashes (2026-07-14)

Two unrelated but easily-confused classes of "mobile app is broken" reports, both hit live in one
session — worth recognizing quickly next time instead of re-diagnosing from scratch:

**1. App crashes immediately (before or right after login), "Something went wrong" in Expo Go.**
Root cause both times was an Expo-Go-specific SDK incompatibility, not application logic:
- `expo-font`/`expo-splash-screen` pinned to versions wildly newer than what Expo SDK 54 expects
  (present since original scaffolding) — `SplashScreen.preventAutoHideAsync()` runs at module-load
  time in `app/_layout.tsx`, so a native-module version mismatch there crashes before any screen
  renders. Fixed by PR #44 (`npx expo install expo-constants expo-font expo-splash-screen
  react-native-svg`; `npx expo-doctor` is the fast way to catch this class of bug — run it first).
- `expo-notifications`: as of Expo Go SDK 53+, remote push was removed from the Expo Go client
  entirely — merely *importing* the package (not calling any API) fires a disruptive module-scope
  `console.error` on Android. Since Expo Router eagerly evaluates every tab screen's module, one
  static import in `app/(tabs)/profile.tsx` broke every login. Fixed by PR #45 — gate the import
  itself behind an Expo-Go check (`Constants.executionEnvironment === StoreClient`) using a
  conditional `require()`, not just guarding the API calls (guarding calls alone doesn't help — the
  crash fires on import, before any call happens).
- **Diagnostic tip**: the Expo Go in-app red error screen ("Something went wrong") shows no useful
  detail — the *actual* stack trace only appears in the Metro terminal log (where `npx expo start`
  is running). Always ask for that log first; it named the exact file/line both times.

**2. "Server unreachable" / login fails / QR code onboarding fails, but the app itself doesn't crash.**
Root cause: the backend's `_get_lan_url()` (`backend/app/routers/studio.py`) auto-detects its own
LAN IP via a UDP-connect-to-8.8.8.8 trick — if a VPN is active on the host and is the default route,
this returns the VPN's internal tunnel address (e.g. `10.5.0.2` on a macOS `utun*` interface)
instead of the real WiFi address a phone can reach. This silently poisons the QR code / Mobile
Access URL shown in desktop Settings, with no error until a phone actually tries to connect. Fixed
by PR #46 (cross-check the detected IP's owning interface by name via `psutil`, skip anything
`utun*`/`tun*`/`tap*`/`ppp*`/`ipsec*`/`wg*`-named). A **second**, compounding issue found in the
same investigation: the desktop Settings "Mobile Access URL" field had zero validation before
saving — a stale malformed value (bare hostname, no `http://`/port) was already sitting in the DB
from an earlier bad save, and kept silently overriding the (now-fixed) auto-detection. Fixed by
PR #47 (Zod validation mirroring mobile's own `validateStudioUrl.ts` rules, byte-identical regex,
inline error before any API call, plus a "reset to detected address" escape hatch).
- **Diagnostic tip**: `python3 -c "import socket; s=socket.socket(socket.AF_INET,
  socket.SOCK_DGRAM); s.connect(('8.8.8.8',80)); print(s.getsockname()[0])"` reproduces exactly what
  the backend sees — run it directly on the host to check if a VPN is currently poisoning the result
  before assuming it's a code bug. `ifconfig | grep "inet "` shows all active interfaces including
  VPN tunnels.
- Also: a stale Metro process from a *previous day's* session (`ps aux | grep expo`) was still
  holding port 8081 during this same investigation — always check for and kill orphaned dev-server
  processes when "start clean" instructions don't seem to take effect.

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

## Key Implementation Decisions (non-obvious)

- **LLM agent:** Ollama `ollama_chat/agon-assistant` (locally fine-tuned Llama 3.2 3B 4-bit). Tools API skipped for Ollama — model emits JSON in content; intercepted by `_parse_llama_json_tool_call`. Env: `LLM_PROVIDER=ollama`, `LLM_MODEL=ollama_chat/agon-assistant`.
- **LLM support/migration:** Groq `llama-3.3-70b-versatile`. Env: `LLM_PROVIDER=groq`, `LLM_MODEL=groq/llama-3.3-70b-versatile`, `LLM_API_KEY`. `LLM_BASE_URL` removed — never reference it.
- **Agent tools (9):** `create_class`, `cancel_class`, `book_client`, `cancel_booking`, `get_class_roster`, `check_in_client`, `create_client`, `assign_membership`, `get_report`.
- **`cancel_booking` confirmation:** deterministic gate in router (`_is_user_confirming`), not model-side.
- **`passlib` replaced** with direct `bcrypt 5.0.0` (passlib incompatible with bcrypt 4+).
- **`Client.password_hash` nullable** — backoffice-created clients have no password until invited.
- **i18n:** 7 locales only — EN, IT, FR, DE, ES, PT, NL. PL and TR files existed as orphans (never imported by `i18n.ts`), removed 2026-07-12 (PR #25).
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
- **Mobile: no waiver-signing UI exists anywhere in `mobile/`** (confirmed via grep, zero hits) despite
  the 1.9 backend enforcing client-self-signing — clients cannot actually sign a waiver from the app.
  Flagged repeatedly since the 2026-07-12 docs-site pass; still unaddressed.
- `get_class_roster` Italian phrasings not 100% reliable — 3B model still picks wrong tool occasionally.
- Playwright e2e tests are scaffold only (no real backend needed; use `page.route()`).
- Mobile: booked count per class not shown on Today's classes (requires new backend field on ScheduledClass).
- `mobile/package.json` has no `lint` script at all, and eslint isn't even installed in `mobile/node_modules` despite `.eslintrc.cjs` existing (flagged during Appointments mobile round PR #23, confirmed again 2026-07-12 during the appointment-booking header fix — still unfixed).
- `mobile`: `npx expo export` (default/web platform) fails — `react-native-web` isn't installed. `--platform ios`/`--platform android` export clean. Flagged 2026-07-12, pre-existing, unfixed.
- 15 pre-existing frontend call sites use the wrong Zod `.errors` API instead of `.issues` (installed Zod is 4.4.3) — flagged during Appointments desktop frontend round, still unfixed outside the 2 files that round touched.

---

## Shipped Feature / Fix Log (compact — full detail in `TASK_LOG_ARCHIVE.md`)

- **Security Hardening** (2026-07-06, `5224e19`): 9 fixes — role/entity confusion JWT dispatch, refresh-token role dispatch, checkout-session IDOR, migration-analyser path traversal, `.gitignore` for db/backups, login user-enumeration timing, bcrypt truncation guard, mobile URL validation, refresh rate-limit.
- **UX Improvements** (2026-07-06, `a33dd7e`): dashboard KPIs/insights, memberships backoffice actions, `resolveApiError` utility, mobile `template_name` display + language switcher + purchase filter.
- **Test Fix** (2026-07-10, PR [#8](https://github.com/edocasciotta/Agon/pull/8)): fixed a daily-flake in the agent slot-accumulation test (froze the clock) — not a real app bug.
- **Infra Fix** (2026-07-10): Vercel landing deploy root-directory misconfig, fixed via REST API.
- **Security Hardening** (2026-07-10, PRs [#11](https://github.com/edocasciotta/Agon/pull/11)/[#13](https://github.com/edocasciotta/Agon/pull/13)): access-log token redaction (invite + calendar-sync tokens) + rate limits on invite/reset-password.
- **Bug Fix — Email+SMS secret wipe** (2026-07-10/11, PR [#9](https://github.com/edocasciotta/Agon/pull/9)): touched-field tracking so unrelated Settings saves don't null out SMTP/Twilio secrets.
- **Competitive Gap Phase 1** (1.1–1.9, 2026-07-09/10/11): fees, rollover credits, intro offers, promo codes, tags, gift cards, SMS messaging, calendar sync iCal, forms/waivers — backend+frontend+mobile across all nine, merged incrementally via PR #12 and follow-ons.
- **Docs-site batch pass 1.1–1.9** (2026-07-12, PR [#17](https://github.com/edocasciotta/Agon/pull/17)): 8 new pages, 9 glossary entries, fixed a stale rollover-credits doc claim.
- **Competitive Gap Phase 2 — 2.1 Appointments** (2026-07-12): backend PR [#18](https://github.com/edocasciotta/Agon/pull/18), desktop frontend PR [#19](https://github.com/edocasciotta/Agon/pull/19), mobile PR [#23](https://github.com/edocasciotta/Agon/pull/23), docs PR [#22](https://github.com/edocasciotta/Agon/pull/22) — all four surfaces shipped.
- **E2E Login/A11y Fix + Test Speed-up** (2026-07-12, PRs [#20](https://github.com/edocasciotta/Agon/pull/20)/[#21](https://github.com/edocasciotta/Agon/pull/21)): fixed `Login.tsx` label bug that broke all Playwright specs (e2e 0/16 → 17/17); sped up an overbooking-load test 34s → ~1s.
- **Bug Fix — `Location` model missing from `Base.metadata`** (2026-07-12, PR [#24](https://github.com/edocasciotta/Agon/pull/24)): would have caused a future autogenerate migration to drop the `locations` table.
- **Cleanup — orphaned `pl.json`/`tr.json` locale files** (2026-07-12, PR [#25](https://github.com/edocasciotta/Agon/pull/25)): confirmed unwired, deleted.
- **Docs cleanup — `TASK_LOG.md` split into lean log + archive** (2026-07-12, PR [#26](https://github.com/edocasciotta/Agon/pull/26)): 736→186 lines, full detail preserved in `TASK_LOG_ARCHIVE.md`.
- **Bug Fix — mobile appointment booking screen** (2026-07-12): duplicate native header (missing `headerShown: false`) + blank instructor list on zero availability, fixed via `<Stack.Screen>` + empty-state message. Reported live by the user via screenshot after fixing the Expo Go infinite-loading issue (stale VPN interface confusing Metro's LAN IP advertisement — resolved by disabling the VPN and restarting Metro with `REACT_NATIVE_PACKAGER_HOSTNAME` forced).
- **Mobile brand-color theming** (2026-07-12, PR [#28](https://github.com/edocasciotta/Agon/pull/28), merged): mobile now consumes the existing public `GET /api/v1/studio/branding` endpoint and applies the manager-chosen `primary_color`/`secondary_color` app-wide (~46 call sites: tab bar, buttons, links, spinners, selected states) instead of hardcoded indigo. New `mobile/src/theme/ThemeContext.tsx` + `mobile/src/lib/color.ts` (mirrors desktop's shade math) + `mobile/src/api/studio.ts`. Falls back to default indigo when uncustomized/fetch fails; last-known color cached in SecureStore to avoid flashing default on offline restart. Semantic green (success/error/discount/status) deliberately left hardcoded, not tied to secondary_color. No backend or docs-site changes needed (endpoint pre-existing, already documented). Delegation note: first pass stalled mid-task (600s no-progress) in an isolated worktree with real, uncommitted, correct partial work — resumed via `SendMessage` to the same agent rather than restarting; second pass completed, committed, and was independently re-verified (typecheck, 75/75 tests, override-pattern spot-check across screens) before PR creation.
- **Desktop sidebar reorganization** (2026-07-13, PR [#29](https://github.com/edocasciotta/Agon/pull/29)): sidebar regrouped from one flat 14-item list + separate ad-hoc "Marketing" block into 6 category sections — Overview (Dashboard, no header), Scheduling, People, Sales, Marketing (unchanged), Admin. Pure regrouping: all 19 routes/icons/i18n keys unchanged, single `navSections` structure replaces two hardcoded arrays. New `nav.sections.*` i18n keys in all 7 locales; reuses existing `marketing.sectionTitle` key. Delegation note: first attempt's orchestrating process crashed mid-task with zero commits made — its worktree was auto-cleaned with nothing recoverable; re-delegated fresh with the same approved category spec and an explicit "commit as soon as it passes" instruction, which completed cleanly on the second attempt (5b505ff) and was independently re-verified (typecheck, lint, 101/101 tests, i18n translations spot-checked in all 7 locales) before PR creation.
- **Mobile UX improvement batch, items 1/2/3/5/6/7** (2026-07-13, PRs [#30](https://github.com/edocasciotta/Agon/pull/30)–[#36](https://github.com/edocasciotta/Agon/pull/36)): user-requested batch of 8 mobile improvements, delegated and verified as separate PRs in complexity order. **#30**: removed Appointments tab's duplicate header; fixed booking wizard's stuck service-selection highlight on back-nav (generic `stepClearers` over `STEP_ORDER`); added missing `SafeAreaView` to Membership tab (open question flagged: native tab header should already inset, real fix may be card top-margin — awaiting user's device confirmation). **#31+#32**: backend denormalizes `GET /bookings`/`/appointments` with `class_type_name`/`location_name`/`instructor_name`/timestamps (mirrors existing `template_name` pattern, no migration); mobile Bookings cards now show real info instead of "Booking #12", new `booking/[id].tsx` + `instructor/[id].tsx` detail screens, fixed a dead `agon://bookings/{id}` deep link. **#33**: Membership purchase split from one large per-type card (promo/gift-card inputs inline) into a compact list + new `membership/checkout/[typeId].tsx`. **#34+#35+#36**: profile photo upload end-to-end — backend upload/serving endpoints (owner-or-manager IDOR-safe, Pillow magic-byte validation, path-traversal-safe storage, `photo_path` column already existed pre-feature), desktop `PhotoUpload`/`AuthenticatedImage` components (Instructors + Client Detail), mobile `expo-image-picker` + `expo-image` with authenticated headers on the Profile tab (photo upload deliberately not queued for offline retry — binary files don't fit `usePendingQueue`'s serializable-operation shape). **Recurring verification finding**: two independent backend sub-agents' `ruff check --fix` broke `isort` order (ground truth per `backend/CLAUDE.md`) while self-reporting "clean" — caught both times by independently re-running `isort --check` against `main`, see `agon_ruff_isort_import_order_conflict` memory.
- **Bug fix — 10000% check-in rate on Reports page** (2026-07-13/14, PR [#38](https://github.com/edocasciotta/Agon/pull/38)): user-reported. Root cause: backend (`reports.py`) already returns `checkin_rate`/`retention_rate` as 0-100 scaled percentages, but `frontend/src/renderer/src/pages/Reports.tsx` multiplied by 100 again. Removed the extra `* 100`; added a regression test asserting the exact rendered string, verified failing pre-fix and passing post-fix.
- **Item 4 completion — service/establishment scoping** (2026-07-13/14, PRs [#37](https://github.com/edocasciotta/Agon/pull/37)/[#39](https://github.com/edocasciotta/Agon/pull/39)/[#40](https://github.com/edocasciotta/Agon/pull/40)): **#37** (backend, already logged above under the batch) added nullable `service_id` on `instructor_availability` (NULL = all services, no backfill) and a new `appointment_service_locations` join table (zero links = all establishments), plus `GET /appointment-services/{id}/available-instructors`. **#39** wires the desktop Availability/Services tabs to these fields (service `<select>`, establishment checkbox list). **#40** switches mobile's appointment-booking instructor step from listing every instructor unconditionally to calling the new scoped endpoint — the actual fix for the originally-reported "no instructors available" confusion.
- **Item 8 — instructor mobile login** (2026-07-14, PRs [#41](https://github.com/edocasciotta/Agon/pull/41)/[#42](https://github.com/edocasciotta/Agon/pull/42)): mobile was client-only; now branches on JWT `role` at login. **#41** (backend): new `GET /instructors/me` resolves the JWT to the caller's own `Instructor` row (role checked before DB lookup per `SECURITY_GUIDELINES.md` §1.1); confirmed check-in (`POST /checkins` method=manual) and class-completion (`POST /classes/{id}/complete`) already permitted instructor tokens, no auth change needed there. **#42** (mobile): new `(instructor-tabs)` route group (Schedule, Profile) separate from the client tabs; Schedule fetches `GET /classes?instructor_id=...`; tapping a class opens a roster screen merging `GET /classes/{id}/roster` with `GET /checkins/class/{id}` for per-client check-in state, with a manual check-in button and a confirmed "Mark Complete" action (backend has no double-completion guard, so the confirm dialog is a client-side safety net); Profile shows the instructor's own bio/email/photo. Shipped initially with a client-side `getMe()` workaround (email search) since #41 hadn't merged yet when the mobile worktree branched — swapped for the real endpoint in a follow-up commit once #41 landed.
- **Recurring session pattern — cascading CHANGELOG conflicts**: with ~13 PRs all editing `CHANGELOG.md`'s `[Unreleased]` section in the same session, nearly every PR needed a manual re-merge (sometimes twice) as sibling PRs merged ahead of it — resolved by always keeping both sides' entries under their correct `### Added`/`### Changed`/`### Fixed` headers, never dropping content. One symlinked-`node_modules` shortcut (used to avoid a slow `npm ci` mid-conflict-resolution) caused a false 23-file dual-React test failure on PR #39's second conflict — root-caused to a stray symlink nested inside an already-real `node_modules` dir rather than replacing it; fixed by always doing a full `rm -rf node_modules && npm ci` when verifying a merge-resolution commit, never a symlink.
- **Docs-site gap closed** (2026-07-14, PR [#43](https://github.com/edocasciotta/Agon/pull/43)): 3 endpoints shipped earlier in the session without docs pages (photo upload/serving, available-instructors, instructors/me) — regenerated via the existing `fetch-openapi.js` pipeline against a live local backend so formatting matches every other auto-generated page exactly; new `photos.md` page (new tag), 3 existing pages extended.
- **Live-user-testing bug fix chain** (2026-07-14, PRs [#44](https://github.com/edocasciotta/Agon/pull/44)–[#47](https://github.com/edocasciotta/Agon/pull/47)): see the new "Known Hazard: Dev-Machine VPN Breaks Mobile Onboarding + Expo Go SDK-Mismatch Crashes" section above for full technical detail on all four. Found by the user actually using the freshly-merged instructor-login feature on a real device — none of these were caught by any test suite (all are environment/runtime issues: SDK version pins, an Expo-Go-only code path, host VPN state, and unvalidated user input), reinforcing that "all tests pass" and "actually works on a device" are different bars for mobile work specifically.

---

## In Progress (2026-07-14, started this session)

Competitive-gap follow-up after re-checking `docs/COMPETITIVE_ANALYSIS_2026_07.md` against live code
(doc now carries a "Status Update — 2026-07-14" section + per-table annotations reflecting reality).
Three sub-agents dispatched in parallel, each in its own worktree, none merged yet:

1. **Mobile waiver-signing UI** — ✅ **shipped**, [PR #48](https://github.com/edocasciotta/Agon/pull/48)
   (independently re-verified: typecheck clean, 32/32 suites / 127/127 tests, code diff spot-checked
   against `mobile/CLAUDE.md`'s offline/i18n conventions before push). Closes the last open surface of
   1.9 Forms/Waivers (backend+desktop had already shipped). New `mobile/app/waivers/index.tsx` (list)
   + `[id].tsx` (sign: typed name + consent checkbox, offline-disabled not queued — signing is an
   explicit real-time consent action, mirrors the photo-upload precedent). `class/[id].tsx`'s
   `bookMutation.onError` now handles `WAIVER_SIGNATURE_REQUIRED` distinctly (shows blocking
   waiver(s), links to sign screen, keeps Book available to retry). New Profile entry point. i18n in
   all 7 locales. **Forms/Waivers is now fully closed across all four surfaces.**
2. **Backend: real tunnel provider + public widget schedule endpoint** — ✅ **shipped**,
   [PR #50](https://github.com/edocasciotta/Agon/pull/50) (independently re-verified in a fresh venv:
   666/666 pytest, clean `alembic upgrade head` from both pre-existing and fresh DB, `ruff`/`black`
   clean on touched files, isort disagreement confirmed as the known pre-existing tooling conflict
   — not introduced by this PR — code-reviewed `tunnel.py`'s subprocess handling and the IDOR-style
   widget test). Implements `CloudflareTunnelProvider` for real (was a stub), adds
   `StudioSettings.public_studio_id`/`directory_secret`, wires tunnel startup into `main.py` lifespan
   (gated off for `AGON_ENV in ("test", "development")`), and a new public
   `GET /api/v1/widget/{public_studio_id}/schedule` endpoint (IP-rate-limited 30/min, minimal-fields
   response, generic 404). `DIRECTORY_WORKER_URL` is still a placeholder pending PR #49's live deploy.
3. **`directory-worker/`** — ✅ **shipped**, [PR #49](https://github.com/edocasciotta/Agon/pull/49)
   (independently re-verified: `tsc --noEmit` clean, 5/5 vitest passing, code-reviewed for
   constant-time secret comparison and no leaked secrets in `wrangler.toml`). New Cloudflare Worker +
   KV, `studio_id → tunnel_url` directory (the one deliberately-centralized piece of infra in this
   project, per `docs/agon_project_bible.md`'s Local-First principle — stores nothing but a URL per
   studio, `{ tunnel_url, updated_at, secret_hash }`, never the raw secret). `POST /register`
   (trust-on-first-use secret claim, strict `https://`-only validation) + `GET /resolve/{id}` (public,
   generic 404 that never distinguishes malformed from unknown ids). Not live-deployed to a real
   Cloudflare account yet — verified locally via `wrangler dev` + miniflare; deploying it and filling
   in the real KV namespace id is a manual follow-up once the backend PR (still in progress) is ready
   to point at it.

**Architecture context**: full plan at the time of dispatch is `/Users/edoardo/.claude/plans/humming-tickling-bird.md`
(orchestrator-local, not in the repo). Root `CLAUDE.md` was updated this session to add `widget/` and
`directory-worker/` to the Environment tree and Agent Hierarchy (new `widget/CLAUDE.md` persistent
sub-agent brief; `directory-worker/CLAUDE.md` is a one-off brief, no persistent sub-agent). Scope for
this round is **deliberately limited to Phase 1 (tunnel) + Phase 2 (read-only widget)** — a studio's
website can show its live schedule, but booking-inside-the-widget (Phase 3, low risk, deferred) and
anonymous-visitor checkout (Phase 4, high risk — first-ever unauthenticated `Client`-creation path,
needs a scoped exception to `SECURITY_GUIDELINES.md` §3 — deferred deliberately until Phase 1/2 prove
real studio adoption) are explicitly NOT being built yet.

**All three Phase 1+2 tracks now shipped** (PRs #48–#50 — note #48 is the unrelated mobile waiver
fix from the same session, #49 directory-worker, #50 backend tunnel+widget). **Still to delegate**:
`widget/` SPA itself (new persistent sub-agent, brief at `widget/CLAUDE.md`), a new "Website Widget"
tab in `frontend/src/renderer/src/pages/Settings.tsx`, docs-site pages for both the tunnel (automatic,
no manager action) and the widget embed snippet, and a manual step to actually `wrangler deploy`
PR #49's Worker + fill in the real `DIRECTORY_WORKER_URL` in backend config once deployed. None of
PRs #48–#50 are merged into `main` yet (all pushed + open on GitHub) — merge them (and run the full
suite once more post-merge) before starting the widget SPA, since it depends on PR #50's endpoint
contract being the actual `main` state.

## Next Task Candidates

- Phase 2 (after Web Booking Widget Phase 1+2 above lands): Marketing Automations, Online Classes,
  Custom Roles, Payroll, Invoicing — per `docs/COMPETITIVE_ANALYSIS_2026_07.md` RICE ranking.
- Mobile: add a `lint` script to `mobile/package.json` and install eslint (currently missing entirely).
- Mobile: install `react-native-web` so `npx expo export` works for the default/web target, not just `--platform ios/android`.
- Frontend: fix the remaining 15 call sites still using the wrong Zod `.errors` API instead of `.issues`.
