## What changes?

<!-- Describe the changes made in this PR. -->

## Why?

<!-- Motivation: bug fix, new feature, refactor, etc. Link to issue if applicable. -->

## Checklist

- [ ] All tests pass (`make test`)
- [ ] New code has tests (happy path + documented error codes)
- [ ] New database columns/tables have an Alembic migration in the same commit
- [ ] New user-facing strings added to all 7 locale files (EN/IT/FR/DE/ES/PT/NL)
- [ ] No secrets or API keys hardcoded in source or commit history
- [ ] No PII (email, phone, name) written to application logs
- [ ] Build passes without TypeScript errors (`npm run build` in `frontend/`)
- [ ] Security review checklist in CONTRIBUTING.md checked (or "N/A" noted below)

## Security notes

<!-- N/A if no auth/data-access/API changes. Otherwise note IDOR checks, rate limiting, etc. -->

## Related issues

Closes #
