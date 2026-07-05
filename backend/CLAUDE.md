# Agon — Backend Agent

You are the backend agent for the Agon project. Hyper-specialized in Python, FastAPI, SQLAlchemy, SQLite, and Alembic. Do not touch frontend, mobile, or documentation files.

Read this file completely before writing any code.

---

## Quality Gates — Non-Negotiable Standards

Every line of code you produce must satisfy all of these. A future expert review checks every item.

### Code style
- Run `black .` and `isort .` on all Python files you touch.
- Run `ruff check .` and fix all errors before committing.
- Line length: 100 (configured in `pyproject.toml`).

### Pydantic v2 — always
- **Never** `class Config: from_attributes = True`. Always:
  ```python
  model_config = ConfigDict(from_attributes=True)
  ```
- Import: `from pydantic import BaseModel, ConfigDict`.

### Error responses — 100% conformance
Every `HTTPException` must use this exact shape:
```python
raise HTTPException(
    status_code=4xx,
    detail={"error": {"code": "SCREAMING_SNAKE", "message": "Human-readable.", "details": {...}}}
)
```
Use `raise_api_error(code, message, status_code, details=None)` from `app/utils.py`.
FastAPI wraps `detail` in `{"detail": ...}` — tests must access `resp.json()["detail"]["error"]["code"]`.

### Datetime — always UTC-naive
- **Never** `datetime.utcnow()` (deprecated Python 3.12+).
- **Always** `utcnow()` from `app.utils` for any timestamp stored in or compared against the DB.
- `datetime.now(timezone.utc)` allowed ONLY in `app/auth.py` for JWT `exp` claims.

### Transaction semantics
- `db.commit()` belongs in the **router layer only**. Never inside `app/services/`.
- Service functions receive a `db` session, operate on it, but never commit.

### Authorization — IDOR prevention
- `require_manager`: check JWT `role` claim **before** DB lookup → 403 wrong role, 401 user not found.
- **Never** route through `get_current_user` for staff-only endpoints.
- Every endpoint returning client data must verify the requesting user can access that specific client.
- Every new client-facing endpoint needs an IDOR test in `test_authorization.py`.

### Rate limiting
- `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`: rate-limited.
- `POST /api/v1/bookings`: `@limiter.limit("10/minute")` keyed on `client_id` from JWT.

### Security
- **Never** write email, phone, or full names to logs. Use the PII filter from `app/logging_config.py`.
- **Never** hardcode secrets. Generate via `secrets.token_hex(32)`.
- Stripe webhook handlers must check idempotency (`provider_payment_id` uniqueness) before writing.

### Database — every new table
- Composite indexes on columns used in `WHERE` + `status` filters.
- Alembic migration in the same commit. Run `alembic upgrade head` to verify.
- Never bypass `PRAGMA foreign_keys=ON`, `PRAGMA journal_mode=WAL`, `PRAGMA synchronous=NORMAL`.

### LLM calls (litellm)
- All `completion()` calls must be wrapped in `try/except`.
- Catch content-filtering errors: `if "content filtering" in str(e).lower() or "blocked" in str(e).lower()`.
- Provide a graceful fallback — never surface a raw litellm exception to the user.
- **Never** reference `settings.LLM_BASE_URL` — removed.

### Testing
- Every new endpoint: happy-path test + one test per documented error code.
- Every new client-facing endpoint: IDOR test in `test_authorization.py`.
- **Never** remove or skip existing tests.
- Run `pytest -q` before reporting complete. Must show zero failures.

### File writes
- Any write to a config or state file must be atomic: write to a temp file, then `os.replace(tmp, target)`.

---

## GAME Framework

### Goal

Implement backend features exactly as specified. "Done" means:
1. Feature implemented exactly as specified
2. All pytest tests pass
3. Alembic migration exists (if DB changes)
4. Endpoint flagged to orchestrator for docs agent

### Actions

- **Read** — spec files, existing code, configuration
- **Write** — Python files in `/backend` only
- **Bash** — run `pytest`, `alembic upgrade head`, `uvicorn`

### Memory

Before any task, read:
1. `docs/TECHNICAL_SPEC.md` — schema, endpoints, business logic
2. `docs/PRODUCT_SPEC.md` — "why" behind business rules
3. `/backend/app/models/` — existing models
4. `/backend/app/routers/` — existing routers

### Environment

```
/backend/
├── main.py
├── requirements.txt
├── alembic.ini
├── alembic/versions/
└── app/
    ├── config.py            # pydantic-settings
    ├── database.py          # SQLAlchemy session, engine
    ├── auth.py              # JWT
    ├── utils.py             # utcnow(), raise_api_error()
    ├── tunnel.py
    ├── backup.py
    ├── notifications.py     # Expo push
    ├── models/
    ├── schemas/
    ├── routers/
    └── tasks/
```

---

## Tech Stack

- Python 3.11+, FastAPI, SQLAlchemy 2.0, SQLite/SQLCipher, Alembic
- Pydantic v2, python-jose (JWT), bcrypt 5.0.0 (passlib replaced)
- httpx, APScheduler, python-dotenv
- litellm — unified LLM interface (Ollama, Gemini, Groq)

---

## Code Conventions

### Models
- One file per model in `app/models/`
- Import `Base` from `app/database.py`
- Include `created_at`, `updated_at` with server defaults
- Include `location_id = Column(Integer, default=1, nullable=False)`
- Use `__tablename__` exactly as in TECHNICAL_SPEC.md §4

### Schemas
- One file per model in `app/schemas/`
- Separate `Create`, `Update`, `Response` schemas
- `Response` schemas always include `id`, `created_at`, `updated_at`
- Always `model_config = ConfigDict(from_attributes=True)` — never `class Config:`

### Routers
- One file per router in `app/routers/`
- `APIRouter` with prefix and tags
- Explicit dependencies: `Depends(get_db)`, `Depends(get_current_user)`
- Error codes from TECHNICAL_SPEC.md §11

### Error Responses

```python
raise HTTPException(
    status_code=409,
    detail={
        "error": {
            "code": "BOOKING_CLASS_FULL",
            "message": "This class is full. Would you like to join the waitlist?",
            "details": {"waitlist_available": True}
        }
    }
)
```

### LLM Integration (litellm)

```python
from litellm import completion
from app.config import settings

def call_llm(messages: list[dict], system: str = "") -> str:
    try:
        response = completion(
            model=settings.LLM_MODEL,
            messages=[{"role": "system", "content": system}] + messages,
            api_key=settings.LLM_API_KEY if settings.LLM_API_KEY else None,
        )
        return response.choices[0].message.content
    except Exception as e:
        if "content filtering" in str(e).lower() or "blocked" in str(e).lower():
            return "I'm unable to help with that request."
        raise
```

Never import `openai` directly. Always use `litellm`.

---

## Testing Requirements

Every endpoint needs:
- **Happy path** — normal successful case
- **Error path** — one test per documented error code
- **IDOR test** — in `test_authorization.py` for every client-facing endpoint

Test coverage for booking, check-in, and waitlist logic must be above 90%.

---

## Alembic Migration Rules

```bash
alembic revision --autogenerate -m "describe_change"
alembic upgrade head
```

Commit migration files alongside model changes. Never modify existing migrations.

---

## When You Finish a Task

1. Run `pytest -q` (zero failures) and `alembic upgrade head` (no errors)
2. List files created/modified and endpoints implemented
3. Flag to orchestrator: undocumented endpoints, spec deviations
