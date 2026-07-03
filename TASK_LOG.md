# Agon — Task Log
*Orchestrator coordination memory. Updated after every completed task.*

---

## Project State (2026-07-03)

**All build phases complete.** V1 shipped + improvements A–N applied.

### Test Counts
| Suite | Count | Status |
|---|---|---|
| Backend (pytest) | 244 | ✅ |
| Mobile (jest-expo) | 21 | ✅ |
| Frontend (Vitest) | 43 | ✅ |
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
- LLM stack (agent): **Ollama** `ollama_chat/agon-assistant` — locally fine-tuned Llama 3.2 3B 4-bit GGUF. Config via `LLM_PROVIDER=ollama` / `LLM_MODEL=ollama_chat/agon-assistant`. Tools API skipped for Ollama (model emits tool calls as JSON in content). `LLM_BASE_URL` was removed — never reference it.
- LLM stack (support/migration): **Groq** `llama-3.3-70b-versatile` (14,400 req/day free) via `LLM_PROVIDER=groq` / `LLM_MODEL=groq/llama-3.3-70b-versatile` / `LLM_API_KEY`.
- Agent mode: reads all studio data into system prompt upfront; 9 tools available (`create_class`, `cancel_class`, `book_client`, `cancel_booking`, `get_class_roster`, `check_in_client`, `create_client`, `assign_membership`, `get_report`); model emits raw JSON tool calls intercepted by `_parse_llama_json_tool_call`
- `Client.password_hash` is nullable (backoffice-created clients have no password yet)
- i18n: 7 locales only — EN, IT, FR, DE, ES, PT, NL. PL and TR removed.
- Supported email event types: `client_invite`, `password_reset`, `booking_confirmed`, `booking_cancelled`, `class_reminder`, `membership_expiring`, `waitlist_promoted`
- SmartList filters: `membership_status`, `last_booked_within_days`, `not_booked_within_days`, `joined_before/after`, `membership_type_id`
- Test conftest uses `StaticPool` (SQLite in-memory, one connection per test)
- Performance test seed: uses `i // 4` index to avoid UNIQUE constraint violations

---

### Post-V1 Improvements — continued
| Phase | Summary |
|---|---|
| J | Fine-tuning: LoRA on Llama 3.2 3B (lr=1e-5, rank=16), GGUF export via llama.cpp, Ollama registration as `agon-assistant`; backend switched to `ollama_chat/agon-assistant`; fixed litellm `format:json` issue by skipping tools API for Ollama; added `_parse_llama_json_tool_call`, fallback history filtering, `_KNOWN_TOOL_NAMES` guard |
| K | Agent tool expansion: 7 new tools (`book_client`, `cancel_booking`, `get_class_roster`, `check_in_client`, `create_client`, `assign_membership`, `get_report`); full entity resolution for clients + class instances; credit deduction/refund on booking/cancellation; natural-language confirmation rule for `cancel_booking`; system prompt updated with all 9 tools listed; test fix for date-sensitive timezone test; `_best_match` reverse-substring fix (`n.lower() in normalized`) for plan names with Italian prefixes (e.g. "Piano Pack" → "Pack") |
| L | Second fine-tuning round: 210-example JSONL covering all 9 tools targeting 3 regressions (`cancel_booking` multi-turn confirmation, Italian `get_class_roster` phrasings, `get_report` Italian keyword→type mapping); `train.sh` updated with Step 0 merge (Phase J + Phase L); `tools.json` expanded to 9 tools |
| M | Training execution (800 total iters on 625+210 merged set, then 600 focused iters on 210 Phase L examples at lr=5e-6); `get_report` revenue/attendance/membership/retention fixed ✅; `cancel_booking` confirmation gate implemented deterministically in router (`_is_user_confirming` + `_cancel_booking_confirm_prompt`); system prompt conflict (ONLY-JSON vs CONFIRMATION RULE) resolved; 234 tests pass |
| N | UI bug fixes post-testing: (1) hallucinated tool call guard — `_is_hallucinated_tool_call()` + `_unsupported_op_reply()` intercept JSON for unknown tools (e.g. `create_location`) before they reach the user; (2) system prompt UNSUPPORTED OPERATIONS rule added; (3) i18n language persistence — `agon-language` key in localStorage, read on app init and written on language change; 236 backend tests + 43 frontend tests pass |
| O | AI UX fixes (branch `feat/ai-support-ux-fixes`): (1) system prompt "REQUIRED FIELDS — NEVER INVENT VALUES" block added — explicit required fields per tool + correct-behavior examples; (2) system prompt "NO RAW JSON IN REPLIES" block added; (3) `_is_echoed_studio_data()` guard — detects when model echoes studio data JSON (membership_types, class_types, etc.) and returns fallback instead of raw JSON; fixes `assign_membership` echoing `{"membership_types": [...]}` to user; (4) Calendar hours now configurable from Settings (backend: `calendar_start_hour`/`calendar_end_hour` on `studio_settings` + Alembic migration `c4d5e6f7a8b9`; frontend: Settings Calendar section + Calendar.tsx reads hours from API); (5) Malformed tool-call JSON guard: any `{...}` content that could not be parsed as a valid tool call now returns a fallback message — never raw JSON (fixes create_class with double-encoded/truncated parameters); 244 backend tests pass (8 new) |

## Next Task

**Phase O — candidati da ROADMAP.md V1.1**

Candidates:
- Electron auto-update (electron-updater + GitHub releases + Alembic on relaunch)
- Multi-location support (location_id already on all tables)
- Stripe subscription billing

---

## Handover Notes (2026-07-03)

Critical facts for the next session:

### Local dev environment
- Backend: `cd backend && .venv/bin/uvicorn app.main:app --reload`
- Frontend: `cd frontend && npm run dev`
- Local DB credentials: `admin@example.com` / `password`
- Ollama model: `agon-assistant` (registered locally); backend env needs `LLM_PROVIDER=ollama LLM_MODEL=ollama_chat/agon-assistant`

### AI Agent — current state
- Fine-tuned model (`agon-assistant`) is loaded in Ollama on the user's M5 MacBook
- 9 tools implemented and working; `cancel_booking` uses a deterministic confirmation gate in the router (model-agnostic)
- `get_report` Italian keyword mapping fixed via fine-tuning
- `get_class_roster` Italian phrasings partially improved (3B model still has strong prior for alternative actions)
- Hallucinated tool calls for unsupported operations (e.g. `create_location`) are now intercepted by `_is_hallucinated_tool_call()` and return a localized unsupported-op reply

### Known open issues
- `get_class_roster` Italian phrasing still not 100% reliable — model sometimes picks wrong tool
- AI quality overall depends on the fine-tuned model being loaded in Ollama; if Ollama is not running or `agon-assistant` is not registered, the backend will fail silently

### Uncommitted changes
None — Phase O fully committed on branch `feat/ai-support-ux-fixes`.

*Last updated: 2026-07-03 — Phase O complete (all commits on feat/ai-support-ux-fixes).*
