# Agon Roadmap

This roadmap describes the planned evolution of the Agon platform. Items in "Planned" and "Vision" sections are subject to change based on community feedback.

---

## V1.0 — Single-location studio management *(current)*

The complete foundation for running a fitness studio.

**Core features:**
- Booking engine with waitlist and credit deduction
- Three-method check-in (QR code, app tap, manual)
- Membership types: recurring and credit packs
- Stripe payment integration
- Client management with invite-by-email flow
- Instructor management
- Class templates and weekly scheduling
- Email marketing: templates, event assignments, smart lists
- AI support agent (powered by Groq, answers questions about Agon in 9 languages)
- GDPR tools: data export, right-to-erasure, consent log
- Migration assistant: import clients and history from CSV
- Cloudflare Tunnel for remote client access
- Nightly automated backups
- Docusaurus documentation site (EN + IT, 9-language AI assistant)

**Current test state:**
- Backend: 212 tests
- Mobile: 15 tests
- Frontend: TypeScript clean, 35 Vitest tests, Playwright e2e scaffold

---

## V1.1 — Operational hardening *(next)*

Focus: reduce setup friction and increase system reliability.

- `setup.sh` / `setup.ps1` — one-command dev environment setup ✅ *(in progress)*
- Pre-commit hooks (black, ruff, eslint, prettier)
- GitHub Actions CI pipeline (run all three test suites on every PR)
- Electron auto-update — documented and tested end-to-end
- Mobile offline-first: React Query cache + reconnect sync queue
- Mobile deep linking for notification taps
- Storybook design system for the desktop app

---

## V2.0 — Multi-location *(planned)*

`location_id` is already in every table — the schema migration will be minimal.

- Per-location class schedules and instructors
- Per-location settings (timezone, email sender, Stripe account)
- Central dashboard: cross-location attendance, revenue, and retention
- Staff roles: location manager (can manage one location) vs global manager (can manage all)
- Client membership valid across all locations (configurable)

---

## V3.0 — Marketplace *(vision)*

Open the platform for community contributions.

- Class template marketplace: share and import class formats
- Integration marketplace: connect third-party tools (Zoom for virtual classes, Zapier, calendar exports)
- Community themes for the client mobile app
- Plugin API for custom check-in hardware (NFC readers, turnstiles)

---

## Community

Feature requests and bug reports: [GitHub Issues](https://github.com/your-org/agon/issues)

To contribute: see [CONTRIBUTING.md](CONTRIBUTING.md).

To become a co-maintainer: see the "Becoming a Co-Maintainer" section in CONTRIBUTING.md.
