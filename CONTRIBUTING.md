# Contributing to Agon

Thank you for your interest in contributing. This document explains how to set up your development environment, the conventions used in this project, and how to submit changes.

---

## Development Setup

### Prerequisites

- Python 3.11+
- Node.js 20+
- Git

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn main:app --reload --port 8000
```

The backend runs at `http://localhost:8000`. The API explorer is at `http://localhost:8000/docs`.

### Frontend (desktop)

```bash
cd frontend
npm ci
npm run dev
```

The Electron dev window opens automatically. Hot reload is enabled.

### Mobile

```bash
cd mobile
npm ci
npx expo start
```

Scan the QR code with Expo Go (iOS / Android) or press `i` / `a` for simulator.

### Documentation site

```bash
cd docs-site
npm ci
npm run start
```

---

## Running Tests

```bash
# Backend
cd backend
source .venv/bin/activate
pytest tests/ -v

# Frontend
cd frontend
npm test

# Mobile
cd mobile
npm test
```

All three suites must pass before opening a pull request.

---

## Environment Variables

Copy `.env.example` to `backend/.env` if available, or create the file manually:

```
DATABASE_URL=sqlite:///./agon.db
AGON_JWT_SECRET=          # auto-generated on first run if empty
AGON_SECRET_KEY=          # auto-generated on first run if empty
LLM_PROVIDER=groq
LLM_MODEL=groq/llama-3.3-70b-versatile
LLM_API_KEY=              # optional — AI features require a Groq API key (free at console.groq.com)
STRIPE_SECRET_KEY=        # optional — payment features require Stripe
STRIPE_WEBHOOK_SECRET=    # optional
```

The backend generates random secrets for `AGON_JWT_SECRET` and `AGON_SECRET_KEY` on first startup if they are missing.

---

## Code Conventions

### Python

- Python 3.11+, type hints required
- Use `datetime.now(timezone.utc).replace(tzinfo=None)` via `app.utils.utcnow()` for all timestamps stored in the database. Do **not** use `datetime.utcnow()` (deprecated)
- `db.commit()` belongs in the router layer only — never inside service functions
- Every new endpoint needs tests for the happy path and every documented error code
- Every database schema change needs an Alembic migration

### TypeScript / React

- Strict TypeScript — no `any`
- State management: Zustand for UI/auth state, React Query for server state
- Tokens must never be stored in `localStorage` — use `sessionStorage` or in-memory store
- Electron `sandbox` must remain `true`

### Alembic

Never modify existing migration files. Always create new ones:

```bash
cd backend
alembic revision --autogenerate -m "describe_what_changed"
alembic upgrade head
```

---

## Pull Request Process

1. Fork the repository and create a branch from `main`
2. Write tests for your changes
3. Ensure all three test suites pass
4. Open a pull request with a clear description of what changed and why
5. Link any related issues

---

## Reporting Issues

Use GitHub Issues. Please include:

- Your operating system and version
- Steps to reproduce the problem
- What you expected to happen
- What actually happened
- Relevant logs (backend logs are in the terminal where you started uvicorn)

---

## Security Review Checklist

Before opening a pull request that touches auth, data access, or API endpoints, verify each item:

- [ ] No secrets, API keys, or passwords hardcoded in source or commit history
- [ ] Input validation on every new endpoint (Pydantic schema required)
- [ ] Rate limiting applied to sensitive endpoints (auth, booking creation)
- [ ] No PII (emails, phone numbers, names) written to application logs
- [ ] IDOR check: a client can only read/modify their own data — tested with a second client account
- [ ] All DB queries built via SQLAlchemy ORM — no raw string concatenation with user input
- [ ] New JWT token types include an `exp` claim with an appropriate short lifetime
- [ ] Stripe webhook handlers check idempotency (`provider_payment_id` uniqueness) before writing

If any item does not apply to your PR, write "N/A" next to it in the PR description.

---

## License

By contributing, you agree that your contributions will be licensed under the same AGPL-3.0 license as the project.
