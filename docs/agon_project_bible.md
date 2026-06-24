# Agon — Project Bible
*Version 1.0 — June 2026*

---

## 1. The Name

Agon (ἀγών) is the ancient Greek word for athletic contest and public gathering. In ancient Greece, the agōn happened in open spaces, accessible to everyone. No gates, no entry fees, no exclusion based on who could afford it.

That's the idea.

---

## 2. Vision

I've worked in the fitness studio industry. At some point I started wondering why the tools studio managers use every day cost so much, and whether it was actually necessary for them to cost anything at all.

I don't think it is.

Agon is a free, open-source studio management platform that any fitness studio in the world can install, own, and run without paying a subscription to anyone. The plan is to start with fitness and yoga studios, build something genuinely good, and then expand to other sectors — physiotherapy, dance schools, martial arts, anywhere the same need exists.

One vertical at a time. No rush.

---

## 3. Mission

Build the best studio management software available and give it away completely for free.

That's it. No hidden agenda, no "free tier" that exists only to push you toward a paid plan. Free means free.

---

## 4. Core Principles

### Local-First

Studio data lives on the studio's own machine. Not on our servers, not on anyone else's cloud. The studio owns its data completely. If Agon disappeared tomorrow, every studio would still have every byte of their data, fully accessible, with no migration needed.

### Zero Cost by Default

The core software is free forever. A studio with no budget gets exactly the same software as one with a large one. This is non-negotiable and will not change.

### Privacy by Architecture

This one is important to understand correctly: Agon can't access studio data not because of a privacy policy, but because the architecture makes it technically impossible. Data never leaves the studio's machine. There's nothing to promise because there's nothing to breach.

### Fully Open Source

Every line of code is public, auditable, and forkable under AGPL v3. No closed modules, no proprietary components hiding inside the core product.

### Obsessive Documentation

Bad documentation is a form of gatekeeping. If a studio manager can't figure out how to use the software, the software has failed them — not the other way around. Every feature, every configuration option, every error message will have a corresponding documentation page. The embedded AI support agent makes that documentation conversational for people who don't read technical docs.

### Ethical by Design

This project exists because I believe software infrastructure for small businesses should be a commons. The AGPL v3 license is a direct expression of that belief — it makes it legally very difficult for someone to take this work, close the source, and sell it back to the people it was built to help.

---

## 5. What Agon Is Not

Agon is not a SaaS. There's no hosted version that I manage on behalf of anyone.

Agon is not a business. There are no investors, no growth targets, no revenue obligations.

Agon is not a service. Installing Agon doesn't create any kind of support contract or obligation from my side.

See Section 10 for why this matters and what it means for people who use it.

---

## 6. Architecture

### The Core Idea

The studio manager installs a single application on their own computer or a VPS they rent themselves. That application contains everything: the management interface, the backend server, and the database. Nothing is hosted externally by the Agon project.

When clients open the mobile app, they're connecting directly to their studio's own server — not to any central Agon infrastructure. Every studio is a self-contained system.

### How It Works in Practice

**What the studio manager installs**

A single executable for Windows, macOS, or Linux. Inside it:

Electron with React for the management interface. FastAPI running in Python as a backend server, launched automatically in the background. SQLite as the database — all studio data lives in a single file on their machine. Cloudflare Tunnel, which runs silently and creates a secure public URL for the studio's server so that clients can connect from anywhere, without the studio manager needing to touch their router or know what an IP address is. An auto-updater that handles new versions silently in the background.

The studio manager opens the app. Everything else happens automatically.

**What clients download**

A single React Native app on the App Store and Google Play. When a client opens it for the first time, they scan a QR code that the studio's management software generates. The app saves the studio's URL and connects directly to that studio's server from that point on. One app serves any number of studios — each client connects to their own studio's instance.

**The discovery service**

There's one small piece of centralized infrastructure: a Cloudflare Worker that acts as a directory, mapping studio identifiers to their current tunnel URLs. The studio's server updates this directory when it starts up. Client apps query it once during setup and then cache the result locally.

This directory never sees studio data. It only stores public URLs — roughly equivalent to a phone book entry.

**On connectivity and what happens if Cloudflare changes things**

The tunnel provider is abstracted in the codebase. Cloudflare Tunnel is the default because it requires zero configuration from the studio manager, but if Cloudflare ever changes its terms in a way that breaks this, the underlying code can be pointed at a different provider without touching anything else. A self-hosted VPS relay is documented as a fallback for studios or forks that want complete independence from any third party.

### Data

Every database record includes a `location_id` field from day one. This is forward-thinking: when multi-location support is added in a later release, there will be no need to rewrite the schema.

The SQLite database is encrypted at rest. All traffic between client apps and the studio server uses HTTPS.

Nightly automatic backups save a copy of the database locally, keeping 30 days of history. Cloud backup to Google Drive or Dropbox is available as an opt-in step during onboarding — strongly recommended, never forced.

### When the Server Is Offline

The mobile app shows the last cached schedule with a timestamp. Bookings made while the server is unreachable are queued and synced when it comes back online. Check-in requires a live connection, so the manual check-in option in the management interface covers that scenario.

---

## 7. What V1 Includes

**For studio managers**

Class scheduling, including recurring classes. Instructor and room management. Capacity limits and waitlists. Check-in via the client app, QR code, or manual entry. Membership and subscription management. Client profiles with attendance history. A basic set of GDPR tools: data export, account deletion, and a consent log.

**For clients (mobile app)**

Browse and book classes. Manage their membership. Check in via app or QR code. Receive push notifications for reminders, confirmations, and waitlist updates. View their booking history.

**Payments**

Studios connect their own Stripe account. Agon is never in the middle of any transaction. Additional providers will come in later releases. Studios that handle payments in cash or through a physical POS can record those payments manually.

**Onboarding**

A five-step setup wizard that requires zero technical knowledge. Tunnel configuration happens in the background while the studio manager fills in their details. At the end of setup, the app generates a QR code for studio managers to print and put at their reception desk. Any setup errors appear as plain-language messages with links to the relevant documentation page.

**AI support agent**

A conversational interface built into the management software, trained on the complete Agon documentation. It answers questions in natural language across multiple languages. It's available from the moment the software is installed.

**AI migration assistant**
Guides studio managers through the process of migrating from any existing platform. Phase 1 retrieves step-by-step instructions for obtaining data from the old platform via GDPR data portability requests. Phase 2 analyses uploaded files (CSV, Excel, JSON), maps columns to Agon's schema, and previews the import. Phase 3 executes the import and generates invitation emails for all imported clients. Agon never handles credentials from third-party platforms.

---

## 8. Technical Stack

| Layer | Technology | Why |
|---|---|---|
| Desktop UI | Electron + React | Single runtime, huge ecosystem, proven at scale |
| Backend | FastAPI + Python | Fast to develop, readable, strong community |
| Database | SQLite | Zero setup, single file, ideal for local-first |
| Mobile | React Native + Expo | Shared code with web, one build for iOS and Android |
| Connectivity | Cloudflare Tunnel | Invisible to studio managers, abstracted in code |
| Discovery | Cloudflare Workers | Free at any realistic scale, fully replaceable |
| Documentation | Docusaurus | Markdown, versioned, free hosting via GitHub Pages |
| Backend testing | Pytest | Python standard, no configuration needed |
| Frontend testing | Vitest + Playwright | Fast unit tests plus end-to-end coverage |
| CI/CD | GitHub Actions | Free for open source projects |
| License | AGPL v3 | Prevents closed-source commercialization |

---

## 9. License

Agon is licensed under the GNU Affero General Public License v3.0 (AGPL v3).

In plain terms: anyone can use, study, modify, and distribute Agon freely. Anyone who runs a modified version of Agon as a network service must publish their complete source code under the same license. No one can take this code, close it, and sell it as a proprietary product.

I chose AGPL v3 specifically because I've watched what happens when permissive licenses meet well-funded companies. The result is always the same: a company takes the open-source work, wraps it in a subscription model, and becomes exactly the kind of business the original project was trying to provide an alternative to. AGPL v3 doesn't make that impossible, but it makes it economically unattractive enough to matter.

---

## 10. How I Work on This Project

I want to be direct about this, because I've seen open-source projects collapse under the weight of community expectations that were never explicitly set.

I work on Agon because I find it meaningful and because I want to learn. I don't work on it because anyone expects me to. There are no SLAs, no guaranteed response times on issues, no committed release schedule. Features get built when I find them interesting or important, not on demand.

If you're using Agon and something is broken, open an issue. I'll look at it when I can. If you need it fixed urgently, submit a pull request. If the project doesn't do something you need, you have the full source code, the complete history of every change, and the legal right to fork it and build what you need.

This isn't a dismissal of the people who use Agon. It's the opposite: it's an honest framing that protects both sides. Studios that choose Agon know exactly what they're signing up for. And the project doesn't slowly die under the pressure of obligations it was never designed to carry.

---

## 11. Governance

Right now, I make all final decisions on architecture, roadmap, and what gets merged. This is the BDFL model — Benevolent Dictator For Life — and it's the honest description of how solo open-source projects actually work.

If a stable community of contributors develops over time, governance can evolve. If that happens, it will be documented publicly. Until then, the decision-making process is simple: I decide.

Contributing guidelines live in `CONTRIBUTING.md`. The code of conduct is in `CODE_OF_CONDUCT.md`, based on the Contributor Covenant. The public roadmap is in `ROADMAP.md`.

---

## 12. Roadmap

**Phase 0 — Foundation**
Define architecture, principles, and stack. Write the project bible. Build a proof of concept: Electron wrapping FastAPI on Windows, with Cloudflare Tunnel auto-configured on first launch. Validate that the installer works for a non-technical user.

**Phase 1 — V1 Fitness Studio**
Core booking and class management. Membership and subscriptions. Client mobile app. Stripe payment integration. Check-in system. GDPR tools. Onboarding wizard. Documentation site. AI support agent. AI migration assistant (guided import from any platform with GDPR data portability support).

**Phase 2 — Consolidation**
Multi-location support. Additional payment providers. Better analytics and reporting. Performance work. Start building the community.

**Phase 3 — Second Vertical**
Pick the next target sector, adapt the V1 codebase, release. Each subsequent vertical follows the same pattern.

---

## 13. How the Code Gets Built

Agon is developed using a hierarchical multi-agent system with Claude Code. This is worth explaining because it shapes how the codebase is organized.

There is an orchestrator agent at the root of the repository, defined by a `CLAUDE.md` file. It reads the project spec, delegates work to specialized agents, and is responsible for ensuring that what different agents produce actually fits together.

Below it, there are four specialized agents. The backend agent handles FastAPI, the database schema, and business logic. The frontend agent handles the Electron shell and the React interface. The mobile agent handles the React Native app. The documentation agent reads code as it's produced and writes the corresponding Docusaurus pages.

Every agent follows two rules without exception: no code without tests, and no endpoint without documentation. These rules are in every `CLAUDE.md` file in the project.

---

## 14. Open Questions

These are things that aren't resolved yet. I'm putting them here because pretending they don't exist would be dishonest.

**Market validation.** I haven't formally validated whether non-technical studio managers will actually install and maintain desktop software. I'm accepting this risk consciously. I'll seek informal feedback at the earliest opportunity.

**Apple App Store.** The review process is unpredictable. A contingency plan using TestFlight for early adopters should be in place before the first mobile release.

**Premium features.** If any features are eventually offered as paid upgrades, they need to be defined before the first public release — not after. Changing the model post-launch damages trust.

**A second maintainer.** The project currently has one. Finding someone to share the documentation or testing load would make it significantly more resilient.

---

*This document is the source of truth for everything about Agon. If a decision isn't in here, it hasn't been made yet.*
