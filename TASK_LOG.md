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
| Backend (pytest) | 579 | ✅ (independently re-run) | PR #24, unchanged through PR #25 |
| Frontend (Vitest) | 98 | ✅ (last logged) | PR #19 |
| Mobile (jest-expo) | 65 | ✅ (last logged) | PR #23 |
| Docs build | — | ✅ | PR #22 |

### Active branch
`main` — through PR #34 (backend photo upload), merged 2026-07-13. Open, auto-merge enabled on
all: #32 (mobile bookings/appointments enrichment UI), #33 (mobile membership purchase redesign),
#35 (desktop photo upload UI), #36 (mobile photo upload UI).

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
- **Mobile UX improvement batch, items 1/2/3/5/6/7** (2026-07-13, PRs [#30](https://github.com/edocasciotta/Agon/pull/30)–[#36](https://github.com/edocasciotta/Agon/pull/36)): user-requested batch of 8 mobile improvements, delegated and verified as separate PRs in complexity order. **#30**: removed Appointments tab's duplicate header; fixed booking wizard's stuck service-selection highlight on back-nav (generic `stepClearers` over `STEP_ORDER`); added missing `SafeAreaView` to Membership tab (open question flagged: native tab header should already inset, real fix may be card top-margin — awaiting user's device confirmation). **#31+#32**: backend denormalizes `GET /bookings`/`/appointments` with `class_type_name`/`location_name`/`instructor_name`/timestamps (mirrors existing `template_name` pattern, no migration); mobile Bookings cards now show real info instead of "Booking #12", new `booking/[id].tsx` + `instructor/[id].tsx` detail screens, fixed a dead `agon://bookings/{id}` deep link. **#33**: Membership purchase split from one large per-type card (promo/gift-card inputs inline) into a compact list + new `membership/checkout/[typeId].tsx`. **#34+#35+#36**: profile photo upload end-to-end — backend upload/serving endpoints (owner-or-manager IDOR-safe, Pillow magic-byte validation, path-traversal-safe storage, `photo_path` column already existed pre-feature), desktop `PhotoUpload`/`AuthenticatedImage` components (Instructors + Client Detail), mobile `expo-image-picker` + `expo-image` with authenticated headers on the Profile tab (photo upload deliberately not queued for offline retry — binary files don't fit `usePendingQueue`'s serializable-operation shape). **Recurring verification finding**: two independent backend sub-agents' `ruff check --fix` broke `isort` order (ground truth per `backend/CLAUDE.md`) while self-reporting "clean" — caught both times by independently re-running `isort --check` against `main`, see `agon_ruff_isort_import_order_conflict` memory. Items 4 (availability/service/establishment scoping) and 8 (instructor mobile login) still in progress — biggest remaining scope, see Next Task Candidates.

---

## Next Task Candidates

- **Mobile waiver-signing UI** — closes out the 1.9 Forms/Waivers feature (backend + desktop already
  ship; mobile is the last open surface, see Known Open Items).
- Phase 2 (next gap after Appointments): Marketing Automations, Web Widgets, Online Classes, Custom
  Roles, Payroll, Invoicing — per `docs/COMPETITIVE_ANALYSIS_2026_07.md` RICE ranking.
- Mobile: add a `lint` script to `mobile/package.json` and install eslint (currently missing entirely).
- Mobile: install `react-native-web` so `npx expo export` works for the default/web target, not just `--platform ios/android`.
- Frontend: fix the remaining 15 call sites still using the wrong Zod `.errors` API instead of `.issues`.
