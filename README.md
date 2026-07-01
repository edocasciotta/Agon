# Agon

Free, open-source fitness studio management software. Install it on your own computer or server — your data stays on your machine, always.

---

## What is Agon?

A self-hosted platform that costs nothing to run. Studio managers get a full-featured desktop app; clients connect via a mobile app.

**No subscriptions. No data sharing. No vendor lock-in.**

---

## Features

- **Class scheduling** — calendar view, recurring classes, class types
- **Client management** — profiles, booking history, membership tracking
- **Booking engine** — validation, waitlist, automatic credit deduction
- **Check-in system** — QR code, manual, and app-based check-in
- **Memberships and payments** — membership types, Stripe integration, payment history
- **Reports** — attendance, revenue, retention, CSV export
- **Migration assistant** — import clients from CSV with AI-assisted column mapping
- **AI support agent** — embedded assistant trained on Agon documentation
- **Mobile app** — iOS and Android client app (React Native / Expo)
- **GDPR tools** — data export and right-to-erasure

---

## Architecture

```
Desktop app (Electron + React)
    └── Embeds backend (FastAPI + SQLite)
            └── Exposed via Cloudflare Tunnel
                    └── Connected to Mobile app (React Native + Expo)
```

- **Backend:** FastAPI · Python 3.11 · SQLite · Alembic
- **Desktop:** Electron · React 18 · TypeScript · Tailwind
- **Mobile:** React Native · Expo SDK 51 · Expo Router
- **AI:** Google Gemini Flash (free tier) via litellm
- **Docs:** Docusaurus · GitHub Pages

---

## Getting Started

### Requirements

- macOS 12+, Windows 10 (64-bit), or Ubuntu 20.04+
- Python 3.11+
- Node.js 20+
- 4 GB RAM · 500 MB disk

### Installation (Development)

```bash
git clone https://github.com/edocasciotta/Agon.git
cd agon

# Backend
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm ci
npm run dev
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for a full development setup guide.

---

## Documentation

Full documentation is in the [`docs-site/`](docs-site/) directory and can be run locally:

```bash
cd docs-site
npm ci
npm run start
```

Topics include:
- Onboarding wizard walkthrough
- Class and membership management
- Check-in flows
- Reports and CSV export
- GDPR compliance tools
- Migration from other platforms

---

## License

Agon is released under the **GNU Affero General Public License v3** (AGPL-3.0).

This means:
- You can use, study, modify, and distribute Agon freely
- If you run a modified version as a network service, you must release your modifications under the same license
- You cannot take this code, close the source, and sell it as a proprietary product

See [LICENSE](LICENSE) for the full license text.

---

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

---

## Project Philosophy

Read the [Project Bible](docs/agon_project_bible.md) for the vision, principles, and governance model behind Agon.
