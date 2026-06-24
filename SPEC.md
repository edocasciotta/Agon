# Agon — Specification Entry Point

This file is the entry point for all agents. Read it first, then read the files it references.

## Project Summary

Agon is a free, open-source, local-first fitness studio management platform. It replaces paid SaaS tools like BSport and Momence. Studio managers install it on their own computer or VPS. Clients connect via a mobile app.

## Key Documents

| Document | Purpose | Who reads it |
|---|---|---|
| `docs/agon_project_bible.md` | Vision, principles, ethics, governance | Everyone |
| `docs/PRODUCT_SPEC.md` | What the system does (user flows, business rules) | All agents |
| `docs/TECHNICAL_SPEC.md` | How the system is built (schema, endpoints, conventions) | Backend, Frontend, Mobile |
| `TASK_LOG.md` | Current state and next tasks | Orchestrator |

## Agent Instructions

| Agent | CLAUDE.md location | Responsibility |
|---|---|---|
| Orchestrator | `/CLAUDE.md` | Coordinates all agents, reads spec, delegates tasks |
| Backend | `/backend/CLAUDE.md` | FastAPI, SQLAlchemy, SQLite, Alembic, pytest |
| Frontend | `/frontend/CLAUDE.md` | Electron, React, TypeScript, Zustand |
| Mobile | `/mobile/CLAUDE.md` | React Native, Expo, push notifications |
| Docs | `/docs-site/CLAUDE.md` | Docusaurus, technical writing, troubleshooting |

## Tech Stack Summary

- Desktop app: Electron + React + TypeScript
- Backend: FastAPI + Python + SQLite
- Mobile: React Native + Expo
- LLM (dev): Ollama (local, free)
- LLM (prod): Google Gemini Flash (free tier) or Groq
- License: AGPL v3

## Non-Negotiable Rules

1. No OpenAI API. Use litellm with Ollama (dev) or Gemini/Groq (prod).
2. No code without tests.
3. No endpoint without documentation.
4. No database change without an Alembic migration.
5. All data stays on the studio's machine. Agon never sends studio data to external servers.
