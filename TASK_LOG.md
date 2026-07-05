# Agon — Task Log
*Orchestrator memory. Updated after every completed task.*

---

## Project State (2026-07-05)

**All 12 build phases complete (0–11). V1 shipped. Post-V1 improvements A–Q applied.**

### Test Counts
| Suite | Count | Status |
|---|---|---|
| Backend (pytest) | 244 | ✅ |
| Frontend (Vitest) | 43 | ✅ |
| Mobile (jest-expo) | 21 | ✅ |
| Docs build | — | ✅ |

### Completed Build Phases (0–11)
Scaffolding → DB models → Core API → Booking engine → Check-in → Memberships/payments → Notifications/tasks → Reports/GDPR → Migration assistant → Frontend desktop → Mobile → Docs site.

### Post-V1 Improvements
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
| Q | Landing page: inviting hero copy; 9-language toggle; mock UI screenshots section; scroll animation (CSS keyframes — deployed to agon-studio.dev) |

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
- **Landing page animation:** CSS `@keyframes` (not CSS transitions) — React 18 batches hydration + state update in same microtask; transitions don't fire. Keyframes always replay from `from {}`.

---

## Handover — 2026-07-05

### Active branch
`feat/ux-improvements` — **many uncommitted changes** (backend + frontend + mobile). Phase P+Q work is NOT yet committed. Run `git status` to see the full diff before starting.

### Local dev
- Backend: `cd backend && .venv/bin/uvicorn app.main:app --reload`
- Frontend: `cd frontend && npm run dev`
- Local DB: `admin@example.com` / `password`
- Ollama: model `agon-assistant` must be loaded; if missing, agent calls fail silently.

### Landing page (agon-studio.dev)
- Source: `landing/` — Next.js 15 static export, deployed via `npx vercel --prod` from `landing/` dir.
- After deploy: `vercel alias set <url> agon-studio.dev && vercel alias set <url> www.agon-studio.dev`.
- Do NOT run vercel from monorepo root — it uploads 15 GB.

### Known open issues
- `get_class_roster` Italian phrasings not 100% reliable — 3B model still picks wrong tool occasionally.
- Playwright e2e tests are scaffold only (no real backend needed; use `page.route()`).

## Stripe Billing Integration (in progress)

Spec: `~/Downloads/agon-stripe-billing-spec.md`

| Phase | Status | Notes |
|---|---|---|
| 1 — Schema + config | ✅ done | Migration `9c30bc2887eb`; 5 new tables; `sellable_online` on `membership_types`; `STRIPE_PUBLISHABLE_KEY` in config; 256 tests pass |
| 2 — Config endpoint + settings screen | pending | `POST /api/billing/settings`; validate key with `stripe.Account.retrieve()` |
| 3 — Checkout (one-off payments) | pending | `POST /api/billing/checkout-session` mode=payment + webhook |
| 4 — Subscriptions | pending | mode=subscription + subscription webhook handlers |
| 5 — Dashboard surfacing (Electron) | pending | Reuse existing UI patterns |
| 6 — Mobile "pay/subscribe" button | pending | Open Checkout URL in-app browser |
| 7 — Cancellation + manual override | pending | `POST /api/billing/members/{id}/subscription/cancel` |

## Next Task

**Stripe Phase 2** — `POST /api/billing/settings` endpoint (admin-only, validate key before saving).

Other V1.1 candidates (deferred):
- Electron auto-update (`electron-updater` + GitHub releases + Alembic on relaunch)
- Multi-location support (`location_id` already on all tables, backend ready)
