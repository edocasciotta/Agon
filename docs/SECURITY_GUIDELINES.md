# Agon — Security Guidelines

**Status: normative.** Every change to backend, frontend, or mobile code MUST satisfy these rules
before it is merged. They are enforced in code review and referenced from each agent's `CLAUDE.md`
(root, `backend/`, `frontend/`, `mobile/`) so they are loaded on every task.

These guidelines encode the concrete vulnerability classes that have actually appeared in this
codebase — not abstract best practice. When you add code that touches authentication,
authorization, money, PII, file I/O, external URLs, or LLM calls, re-read the relevant section.

---

## 0. The 60-second pre-merge checklist

Run through this for every PR. If any answer is "no", fix it first.

- [ ] Does every new endpoint declare an explicit auth dependency (`require_manager`,
      `require_staff`, `get_current_user`, `get_current_client`, or a role-checked resolver)?
- [ ] For any endpoint that takes a `client_id` / resource id in the path or body: does a
      **client caller** get rejected (403) when the id is not their own? Is there an IDOR test?
- [ ] Does the JWT `role` claim get checked **before** any DB lookup that assumes an entity type?
- [ ] Are all secrets read from config/env — never hard-coded, never logged, never returned in a
      response body?
- [ ] Does any user-supplied string that becomes a filesystem path get sanitized
      (`os.path.basename` + allow-list) and confined to its directory?
- [ ] Are new user-facing errors going through the standard error envelope (no stack traces,
      no internal detail leaked)?
- [ ] Did you add/keep rate limits on auth and other abuse-prone endpoints?
- [ ] Did tests pass (`pytest -q`, `npm test`, `npm run typecheck`) with zero failures?

---

## 1. Authentication & tokens

### 1.1 User.id and Client.id share one integer space — always gate on the `role` claim
`User` (managers/instructors) and `Client` (members) are **separate tables with overlapping
integer primary keys**. A token's `sub` alone is ambiguous. Any dependency that resolves a token
to an entity MUST verify the JWT `role` claim **before** the DB lookup:

- `get_current_user` → reject unless `role in ("manager", "instructor")`.
- `get_current_client` → reject unless `role == "client"`.
- `require_manager` / `require_staff` → check `role` first, then look up the row.
- `/auth/refresh` → mint the new access token from the **refresh token's own `role`**, never by
  "try the users table, then the clients table". The try-users-first pattern let a client refresh
  token be upgraded to a manager access token on id collision.

**Rule:** never dispatch on `sub` across two entity types. Dispatch on `role`, then load by id.

### 1.2 Password hashing
- Use `hash_password` / `verify_password` from `app/auth.py` (direct bcrypt, cost 12). Never call
  bcrypt or any other hasher directly elsewhere.
- bcrypt silently ignores bytes past **72**. Reject passwords longer than `PASSWORD_MAX_BYTES`
  (returns `AUTH_PASSWORD_TOO_LONG`) so a long password can't create a false sense of strength.
- Minimum length is 8 characters, enforced server-side. Client-side checks are UX only, never the
  security boundary.

### 1.3 Login must not reveal whether an account exists
- Login returns the same `AUTH_INVALID_CREDENTIALS` error for unknown email and wrong password.
- When no account matches, call `burn_password_check()` so response timing matches the
  password-verifying path (defeats timing-based user enumeration).
- `/auth/forgot-password` always returns 200 with a neutral message, regardless of whether the
  email exists. Email-send failures are swallowed. Keep it that way.

### 1.4 JWT hygiene
- One signing secret: `settings.AGON_JWT_SECRET`, HS256. It is auto-generated with
  `secrets.token_hex(32)` on first run and persisted to `.env`. Never hard-code it, never commit a
  real one, never log it.
- Every token carries a `type` claim (`access`, `refresh`, `qr_checkin`). Every consumer checks the
  `type` it expects. Never accept an `access` token where a `qr_checkin` token is required, etc.
- Access-token lifetimes: manager 8h, client 30d. Do not lengthen without a documented reason.

### 1.5 Rate limiting (abuse-prone endpoints)
Keep `@limiter.limit(...)` on: `POST /auth/login` (10/min), `POST /auth/refresh` (10/min),
`POST /auth/register/client` (5/min), `POST /auth/forgot-password` (3/hour). Any new endpoint that
sends email/SMS, validates a secret, or is a brute-force target gets a limit too.

---

## 2. Authorization (IDOR is the #1 risk in this app)

Every endpoint that reads or mutates data tied to a specific client MUST verify the caller is
allowed to touch **that specific record** — presence of a valid token is not enough.

- **Managers/instructors**: may act across clients (staff scope).
- **Clients**: may only act on **their own** `client_id`. Compare the path/body id against the
  token's `sub` and return 403 otherwise.

Concrete pattern for mixed-audience endpoints (see `stripe_billing.create_checkout_session`,
`checkins`, `memberships`, `gdpr`):

```python
caller_role = payload.get("role", "client")
if caller_role not in ("manager", "instructor"):
    if str(payload.get("sub")) != str(target_client_id):
        raise_api_error("FORBIDDEN", "You may only act on your own account.", status_code=403)
```

**Rules:**
- Never trust a `client_id` from the request body as an identity — it is a *target*, and must be
  authorized against the token.
- Staff-only endpoints use `require_manager` / `require_staff`. Never `get_current_user` as the sole
  guard for a manager-only action if the action isn't role-checked.
- Every new client-facing endpoint gets a matching test in `backend/tests/test_authorization.py`
  proving a client cannot reach another client's data (403).

---

## 3. Money & webhooks (Stripe)

- **Checkout authorization**: a client may only open a checkout session for their own `client_id`
  (§2). Managers may act for any client.
- **Webhook signatures**: always verify with `stripe.Webhook.construct_event` against
  `STRIPE_WEBHOOK_SECRET`. Never process an unverified payload. While the secret is the placeholder
  `whsec_test`, acknowledge **without** processing (so Stripe stops retrying) — never grant
  memberships from an unverified event.
- **Idempotency**: check the `StripeWebhookEvent` ledger (unique `stripe_event_id`) before writing,
  and record the event id in the same commit. Handlers must be safe to receive twice.
- **Secret keys** (`STRIPE_SECRET_KEY`) are never returned by any endpoint. `GET /billing/settings`
  returns connection status + publishable key only.
- Amounts come from the server-side `MembershipType`, never from the client. Never let the client
  send a price.

---

## 4. Input handling & injection

### 4.1 Filesystem paths from user input (path traversal)
Any user-controlled string that becomes part of a path (uploads, exports, backups) MUST be:
1. reduced to its base name (`os.path.basename`),
2. filtered to an allow-list (`re.sub(r"[^A-Za-z0-9._-]", "_", name)`) and length-capped, and
3. confirmed to resolve **inside** the intended directory (`os.path.commonpath([...])`).

See `migration.analyse_file`. Never interpolate `file.filename` straight into a path.

### 4.2 SQL
Use SQLAlchemy ORM query builders / bound parameters exclusively. Never build SQL with f-strings or
string concatenation of user input.

### 4.3 Validation at the boundary
- Pydantic schemas validate every request body. Use `EmailStr`, length caps, and `field_validator`
  for anything free-form (see `support.ChatMessage` — 2000-char cap, role allow-list).
- Cap the size/count of collections (message lists, batch imports) to bound resource use.

---

## 5. PII, logging & data protection

- **Never** log email, phone, or full name. The `PIIRedactionFilter`
  (`app/logging_config.py`) redacts emails/phones on the root logger, but do not rely on it as a
  license to log PII — omit it in the first place.
- Never put secrets, tokens, password hashes, or card data in logs or error responses.
- Error responses use the standard envelope
  `{"detail": {"error": {"code", "message", "details?}}}`. No stack traces, no raw exception text,
  no SQL. Map internal failures to a generic code.
- GDPR export/delete (`gdpr` router) is restricted to a manager or the client themselves. Keep the
  consent log append-only.

---

## 6. Frontend (Electron desktop)

- **Token storage**: `accessToken` lives in memory only (Zustand + `sessionStorage` adapter) and is
  excluded from any persisted slice via `partialize`. **Never** put a token in `localStorage`.
- **Electron hardening** (`src/main/index.ts`): `sandbox: true`, `contextIsolation: true`, and no
  `nodeIntegration` in `webPreferences`. The preload script exposes only a minimal, explicit surface
  through `contextBridge` — never expose `ipcRenderer` wholesale or Node built-ins to the renderer.
- The window loads a trusted local renderer only. Do not load remote URLs into the main window; do
  not enable `webviewTag`.
- **401 handling** is centralized in `api/client.ts` (logout + redirect). Do not add ad-hoc
  per-call 401 logic that could swallow it.
- **CORS**: the backend allows only explicit origins with `allow_credentials=True`. Never combine
  `allow_origins=["*"]` with credentials.
- Validate every form with its Zod schema before calling the API; treat server 422 as a backstop,
  not the first line of defence.

---

## 7. Mobile (Expo / React Native)

- **Token & studio URL storage**: `expo-secure-store` only (`agon_access_token`,
  `agon_studio_url`). **Never** `AsyncStorage` for tokens or any sensitive value.
- **Studio URL is a trust anchor**: it becomes the API base where credentials are sent. Every URL
  from a QR code or manual entry MUST pass `validateStudioUrl` (`src/lib/validateStudioUrl.ts`)
  before being persisted: parseable `http(s)` only (blocks `javascript:`/`file:`/`data:`), and plain
  `http` allowed only for localhost / private LAN ranges — never for a public host (cleartext
  credential leak).
- Deep-link payloads (`agon://…`) are untrusted input. Validate ids/shape before navigating or
  fetching; never `eval`/interpolate them into a request without checking.
- Do not log tokens or PII to the device console in release builds.

---

## 8. Secrets & configuration

- All secrets come from environment / `.env` (git-ignored). `.env.example` holds placeholders only.
- Writes to `.env` or other state files are **atomic**: write a temp file, then `os.replace`
  (see `_update_env_file`). Never leave a partially written credentials file.
- Never commit: real `.env`, `*.db`, `backups/`, private keys, live API keys. Verify with
  `git status` before committing. (The SQLite dev DB and `backups/` are already git-ignored — keep
  it that way.)
- Rotate any secret that has ever been committed or pasted into a log/PR.

---

## 9. LLM calls (litellm)

- Wrap every `completion()` in `try/except`; on failure return a graceful localized fallback, never
  the raw exception (which may leak prompt/context). Catch content-filtering explicitly.
- Treat the model's output as untrusted: the support assistant is constrained to documentation
  context and must not execute actions. Agent tool-calls are gated deterministically in the router
  (e.g. `cancel_booking` confirmation), not by trusting model intent.
- Never send secrets, full PII records, or card data into a prompt.

---

## 10. Dependencies & supply chain

- Pin versions; review lockfile changes in PRs. Avoid adding a dependency for something small and
  self-contained.
- Run `pip`/`npm audit` periodically; triage High/Critical before release.
- Do not add packages that require disabling Electron sandboxing or TypeScript strictness.

---

## Reporting a vulnerability

Found a security issue? Do **not** open a public issue. Note it in `TASK_LOG.md` under a
`Security` heading and flag it to the maintainer directly so it can be fixed before disclosure.

---

*Last reviewed: 2026-07-06. Update this file whenever a new vulnerability class is found and fixed —
add the concrete pattern so the next contributor (human or agent) cannot reintroduce it.*
