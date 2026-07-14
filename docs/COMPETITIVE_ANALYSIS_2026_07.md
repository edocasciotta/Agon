# Agon Competitive Analysis — July 2026

**Competitors:** bsport · Momence · Mindbody
**Date:** 2026-07-06 (original analysis) · **Status refreshed 2026-07-14**

---

## Status Update — 2026-07-14 (orchestrator re-check against live code)

Since the original analysis, Agon shipped **Competitive Gap Phase 1** (9 quick wins, PRs #12 and
follow-ons) and **Phase 2.1 Appointments** (PRs #18/#19/#22/#23), verified directly against the
codebase (models/routers), not just against status claims in `TASK_LOG.md`:

**Closed:**
- ✅ Appointments (1-on-1 booking) — `backend/app/routers/appointments.py`,
  `appointment_services.py`, `instructor_availability.py`. Covers 1-on-1 booking, availability
  management, buffer time (`buffer_minutes` on `AppointmentService`), service/instructor/location
  scoping. **Not** covered: recurring appointments, duo/group appointments, room/resource booking,
  intake forms, SOAP notes, add-on services — see updated Appointments matrix below.
- ✅ SMS messaging — `backend/app/services/sms_service.py`, `sms_settings.py` (Twilio).
- ✅ Gift cards — `backend/app/models/gift_card.py`, `gift_card_redemption.py`.
- ✅ Promo codes / discounts — `backend/app/models/promo_code.py`, `promo_code_usage.py`.
- ✅ Rollover credits, intro offers/trials — `backend/app/models/membership.py`,
  `membership_type.py`.
- ✅ Late-cancel / no-show fees — shipped as part of the "fees" item in Phase 1.
- ✅ Calendar sync (iCal) — `backend/app/routers/calendar_sync.py`.
- ✅ Tags (manual, client-facing) — `backend/app/models/tag.py`.
- ✅ Forms / waivers / digital signatures — **now fully shipped across all surfaces**
  (`backend/app/models/waiver.py`, `waiver_signature.py`, `backend/app/routers/waivers.py`, desktop,
  and as of [PR #48](https://github.com/edocasciotta/Agon/pull/48) mobile too — `mobile/app/waivers/`
  list+sign screens, booking-flow `WAIVER_SIGNATURE_REQUIRED` handling).

**Still open (unchanged since original analysis):**
- ❌ Online / virtual classes (Zoom / livestream)
- ❌ POS / retail sales
- ❌ Marketing automations / sequences
- ❌ Advanced staff payroll & scheduling
- ❌ Invoicing (EU-compliant)
- ❌ Web customer portal / embeddable booking widgets
- ❌ Custom roles / permissions, franchise dashboard, aggregator integrations, public API/webhooks,
  branded white-label app, AI sales agent (client-facing) — all lower-priority items, unchanged.

**Net effect on the original Top 10 list:** 2 of 10 fully closed (Appointments, SMS), 1 partially
closed (Forms/Waivers — backend+desktop done, mobile signing UI missing), 7 unchanged.

---

## Executive Summary — Top 10 Product Gaps (original, 2026-07-06)

| # | Gap | Competitors with it | Impact | Status (2026-07-14) |
|---|-----|---------------------|--------|----------------------|
| 1 | **Appointments (1-on-1 booking)** | All three | Blocks entire personal training / wellness vertical | ✅ Closed |
| 2 | **SMS messaging** | All three | Standard client communication channel missing | ✅ Closed |
| 3 | **Online / virtual classes (Zoom / livestream)** | All three | Hybrid studios cannot use Agon | ❌ Open |
| 4 | **POS / retail sales** | All three | Revenue leakage — studios can't sell merchandise | ❌ Open |
| 5 | **Forms, waivers, digital signatures** | All three | Legal/compliance risk for studios | ✅ Closed (PR #48) |
| 6 | **Gift cards** | All three | Marketing and revenue tool missing | ✅ Closed |
| 7 | **Marketing automations / sequences** | All three | No drip campaigns, milestone triggers, or win-back flows | ❌ Open |
| 8 | **Advanced staff payroll & scheduling** | All three | Pay rates, commissions, time clock absent | ❌ Open |
| 9 | **Invoicing** | bsport, Momence | EU studios need proper sequential invoices with VAT | ❌ Open |
| 10 | **Web customer portal** | All three | Clients forced to use mobile app only | ❌ Open |

---

## Phase 1 — Agon Platform Inventory

### Implemented Features (22 areas, all at full status)

| Category | Key Capabilities | Backend | Desktop UI | Mobile UI |
|----------|-----------------|---------|------------|-----------|
| **Authentication** | JWT, two-entity (User + Client), invitation tokens, password reset, QR onboarding | ✅ | ✅ | ✅ |
| **Class Management** | Templates, recurrence, instructor assignment, capacity, color coding, booking windows | ✅ | ✅ | ✅ |
| **Bookings** | Create/cancel, credit deduction/refund, cancellation window enforcement, no-show tracking | ✅ | ✅ | ✅ |
| **Waitlist** | Position tracking, timed offer window, auto-promotion when spots open | ✅ | ✅ | ✅ |
| **Check-in** | QR, app, manual; time-window enforcement; audit trail | ✅ | ✅ | ✅ |
| **Memberships** | Recurring + credit packs, pause/resume, online purchase via Stripe, class-type restrictions | ✅ | ✅ | ✅ |
| **Payments / Stripe** | Stripe Connect, recurring billing, webhooks with idempotency, manual payments, refunds | ✅ | ✅ | ✅ |
| **Clients / CRM** | Profiles, history, notes, self-service editing | ✅ | ✅ | ✅ |
| **Smart Lists** | Dynamic client segmentation with JSON filter builder and preview | ✅ | ✅ | ❌ |
| **Email System** | Custom HTML templates, event-driven automation, SMTP config, test send | ✅ | ✅ | ❌ |
| **Push Notifications** | Expo push with delivery tracking, read status | ✅ | — | ✅ |
| **AI Agent** | Natural language studio management via LLM (Groq/Llama 3.3 70B), 20+ tools, confirmation flows | ✅ | ✅ | ❌ |
| **AI Support Chat** | Docs-grounded support chatbot, language detection, scope filtering | ✅ | ✅ | ❌ |
| **Reporting** | Attendance, revenue, memberships, retention; CSV export; dashboard KPIs | ✅ | ✅ | ❌ |
| **Instructors** | Profiles with bio/photo, linked to user accounts | ✅ | ✅ | ❌ |
| **Multi-Location** | Every entity scoped to location_id, location CRUD, calendar filtering | ✅ | ✅ | ❌ |
| **Studio Settings** | Branding, business rules, cancellation policies, check-in windows, Stripe config, backup | ✅ | ✅ | ✅ |
| **Data Migration** | CSV import with column mapping, platform-specific templates, batch invitations | ✅ | ✅ | ❌ |
| **GDPR / Privacy** | Data export, erasure, consent tracking | ✅ | — | ❌ |
| **Mobile App** | Browse classes, book, memberships, purchase, profile, offline-aware, 7 languages | — | — | ✅ |
| **Onboarding Wizard** | 6-step guided setup for new studios | ✅ | ✅ | ❌ |
| **Internationalization** | 7 languages (en, it, fr, de, es, pt, nl), full coverage mobile + desktop + AI | ✅ | ✅ | ✅ |

### Features NOT Present in Agon (updated 2026-07-14 — see Status Update above)

- ~~Appointments / 1-on-1 booking~~ — ✅ shipped (buffer time, availability mgmt; no recurring/duo/room-booking/intake-forms yet)
- POS / retail product sales
- Invoicing (formal sequential invoices)
- ~~Gift cards~~ — ✅ shipped
- Loyalty / rewards
- Referral program
- Reviews / ratings
- Online / video classes / livestream
- ~~Forms / waivers / digital signatures~~ — ✅ shipped, all surfaces (PR #48 closed the mobile gap)
- ~~SMS messaging~~ — ✅ shipped (Twilio)
- Marketing automations / drip campaigns / sequences
- Staff scheduling / payroll (pay rates, commissions, time clock)
- Web customer portal
- ~~Promo codes / discounts~~ — ✅ shipped
- Room / resource management
- Family / household accounts
- Workshops / events / courses (multi-session)
- Waitlist priority by membership tier
- Revenue forecasting / advanced analytics
- Contracts / agreements
- Webshop / retail inventory
- ~~Calendar sync (iCal / Google)~~ — ✅ shipped (iCal export)
- Access control / door hardware
- Aggregator integrations (ClassPass, Wellhub)

---

## Phase 2 — Competitor Feature Inventories

*(Detailed inventories captured during research — see Phase 3 matrix for side-by-side comparison)*

---

## Phase 3 — Feature Matrix

### Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Full support |
| 🟡 | Partial support |
| ❌ | Missing |
| ⚠️ | Unknown / unconfirmed |

---

### Booking & Scheduling

| Feature | Agon | bsport | Momence | Mindbody |
|---------|------|--------|---------|----------|
| Group class scheduling | ✅ | ✅ | ✅ | ✅ |
| Recurring classes | ✅ | ✅ | ✅ | ✅ |
| Booking windows (open/close) | ✅ | ✅ | ✅ | ✅ |
| Capacity limits | ✅ | ✅ | ✅ | ✅ |
| Instructor assignment | ✅ | ✅ | ✅ | ✅ |
| Spot/mat selection (Pick-a-Spot) | ❌ | ✅ | ❌ | ✅ (Accelerate+) |
| Hybrid sessions (in-person + online) | ❌ | ✅ | ✅ (via Zoom) | ✅ |
| Class levels / tags | 🟡 (color only) | ✅ | ✅ | ✅ |
| Visibility restrictions (member-only classes) | ❌ | ✅ | ✅ | ✅ |
| Overlapping scheduling | ✅ | ✅ | ✅ | ✅ |
| Aggregator spot capping (ClassPass) | ❌ | ✅ | ✅ | ✅ |

**Notes:** Agon has solid group class scheduling but lacks spot selection, hybrid mode, and aggregator integration.

---

### Appointments (1-on-1)

| Feature | Agon | bsport | Momence | Mindbody |
|---------|------|--------|---------|----------|
| 1-on-1 appointment booking | ✅ | ✅ | ✅ | ✅ |
| Availability management | ✅ | ✅ | ✅ | ✅ |
| Buffer/prep time | ✅ | ✅ | ✅ | ✅ |
| Recurring appointments | ❌ | ✅ | ✅ | ✅ |
| Duo/group appointments | ❌ | ✅ | ✅ | ❌ |
| Room/resource booking | ❌ | ✅ | ❌ | ✅ (Accelerate+) |
| Intake forms | ❌ | ❌ | ✅ | ❌ |
| SOAP notes | ❌ | ❌ | ✅ | ❌ |
| Add-on services | ❌ | ❌ | ✅ | ❌ |

**Notes (updated 2026-07-14):** Shipped 2026-07-12 (Phase 2.1, PRs #18/#19/#22/#23) — core booking,
availability, and buffer time across backend/desktop/mobile/docs. Remaining sub-gaps (recurring,
duo/group, room booking, intake forms, SOAP notes) are smaller follow-on items, not blockers to
adoption the way the original zero-support gap was.

---

### Courses / Workshops / Events

| Feature | Agon | bsport | Momence | Mindbody |
|---------|------|--------|---------|----------|
| Multi-session courses | ❌ | ✅ | ✅ | ✅ |
| One-off workshops | ❌ | ✅ | ✅ | ✅ |
| Retreats | ❌ | ❌ | ✅ | ❌ |
| Payment plans for courses | ❌ | ❌ | ❌ | ✅ |

---

### Waitlist

| Feature | Agon | bsport | Momence | Mindbody |
|---------|------|--------|---------|----------|
| Waitlist join/cancel | ✅ | ✅ | ✅ | ✅ |
| Auto-promotion when spot opens | ✅ | ✅ | ✅ | ✅ |
| Timed offer window | ✅ | ✅ | ⚠️ | ⚠️ |
| Bulk waitlist management | ❌ | ✅ | ✅ | ❌ |
| Priority by membership | ❌ | ❌ | ❌ | ❌ |

**Notes:** Agon's waitlist is competitive. Timed offer window is a nice differentiator.

---

### Check-in

| Feature | Agon | bsport | Momence | Mindbody |
|---------|------|--------|---------|----------|
| QR code check-in | ✅ | ❌ | ✅ | ✅ |
| Barcode scanner | ❌ | ✅ | ✅ | ✅ |
| Manual check-in | ✅ | ✅ | ✅ | ✅ |
| Self check-in kiosk/tablet | ❌ | ❌ | ✅ | ✅ |
| Time-window enforcement | ✅ | ⚠️ | ✅ | ✅ |
| Badge printing | ❌ | ❌ | ✅ | ❌ |

---

### Memberships & Subscriptions

| Feature | Agon | bsport | Momence | Mindbody |
|---------|------|--------|---------|----------|
| Recurring memberships | ✅ | ✅ | ✅ | ✅ |
| Credit packs | ✅ | ✅ | ✅ | ✅ |
| Pause/resume | ✅ | ✅ | ✅ | ⚠️ |
| Online purchase | ✅ | ✅ | ✅ | ✅ |
| Class-type restrictions | ✅ | ✅ | ✅ | ✅ |
| Rollover credits | ✅ | ✅ | ✅ | ⚠️ |
| Guest passes | ❌ | ❌ | ✅ | ❌ |
| Intro offers / trials | ✅ | ✅ | ✅ | ✅ |
| Cross-location memberships | ❌ | ✅ (universal passes) | ❌ | ✅ |
| Transfer between members | ❌ | ❌ | ✅ | ❌ |
| Commitment periods / contracts | ❌ | ✅ | ✅ | ✅ |
| Card Updater (auto-update expired cards) | ❌ | ❌ | ❌ | ✅ |
| Promo codes / discounts | ✅ | ✅ | ✅ | ✅ (Accelerate+) |

**Notes (updated 2026-07-14):** Rollover credits, intro offers, and promo codes shipped in Phase 1.
Remaining gap: cross-location memberships, transfer between members, commitment periods/contracts,
card updater.

---

### Payments & Billing

| Feature | Agon | bsport | Momence | Mindbody |
|---------|------|--------|---------|----------|
| Stripe integration | ✅ | ✅ | ✅ | ✅ |
| Recurring billing | ✅ | ✅ | ✅ | ✅ |
| Manual payments | ✅ | ✅ | ⚠️ | ✅ |
| Refunds | ✅ | ✅ | ✅ | ✅ |
| SEPA / bank transfer | ❌ | ✅ | ❌ | ❌ |
| Apple Pay / Google Pay | ❌ | ✅ | ❌ | ✅ |
| Installment / payment plans | ❌ | ✅ | ✅ | ✅ |
| HSA/FSA card acceptance | ❌ | ❌ | ✅ | ❌ |
| Payment retry on failure | ❌ | ✅ | ✅ | ✅ |
| Direct payment links | ❌ | ✅ | ❌ | ❌ |
| Late cancel / no-show fees | ✅ | ✅ | ✅ | ✅ |
| Tap to Pay (mobile terminal) | ❌ | ❌ | ❌ | ✅ |

---

### POS / Retail

| Feature | Agon | bsport | Momence | Mindbody |
|---------|------|--------|---------|----------|
| Point of sale system | ❌ | ✅ | ✅ | ✅ |
| Product catalog | ❌ | ✅ (Webshop) | ✅ | ✅ |
| Inventory management | ❌ | ✅ | ❌ | ✅ |
| Barcode scanning | ❌ | ✅ | ✅ | ✅ |
| Card reader hardware | ❌ | ✅ (Stripe Terminal) | ✅ (WisePOS E) | ✅ (M2, WisePad 3) |
| Receipt printing | ❌ | ❌ | ❌ | ✅ |

---

### Invoicing

| Feature | Agon | bsport | Momence | Mindbody |
|---------|------|--------|---------|----------|
| Sequential invoice numbering | ❌ | ✅ | ❌ | ❌ |
| PDF generation | ❌ | ✅ | ❌ | ❌ |
| VAT / tax handling | ❌ | ✅ (EU, Italy, Spain, Germany) | 🟡 | ❌ |
| Bulk export | ❌ | ✅ | ❌ | ❌ |
| B2B invoicing | ❌ | ✅ | ❌ | ❌ |
| Insurance invoicing | ❌ | ❌ | ✅ | ❌ |

**Notes:** bsport has by far the best invoicing — critical for EU compliance. This matters hugely for Agon's European target market.

---

### Staff Management & Payroll

| Feature | Agon | bsport | Momence | Mindbody |
|---------|------|--------|---------|----------|
| Instructor profiles | ✅ | ✅ | ✅ | ✅ |
| Pay rates (per class, per hour) | ❌ | ✅ | ✅ | ✅ |
| Commissions | ❌ | ✅ | ✅ | ✅ |
| Time clock (clock in/out) | ❌ | ✅ | ✅ | ✅ |
| Payroll reports | ❌ | ✅ | ✅ | ✅ |
| Teacher invoice generation | ❌ | ✅ | ❌ | ❌ |
| Substitute management | ❌ | ❌ | ❌ | ✅ |
| Custom permission roles | ❌ | ✅ | ✅ | ✅ |

**Notes:** Agon only has basic instructor profiles with no payroll capability.

---

### CRM & Client Management

| Feature | Agon | bsport | Momence | Mindbody |
|---------|------|--------|---------|----------|
| Client profiles | ✅ | ✅ | ✅ | ✅ |
| Notes | ✅ | ✅ | ✅ | ✅ |
| Booking history | ✅ | ✅ | ✅ | ✅ |
| Smart lists / segmentation | ✅ | ✅ | ✅ | 🟡 |
| Tags (manual + auto) | ✅ (manual) | ✅ | ✅ | ❌ |
| Family / child accounts | ❌ | ✅ | ✅ | ❌ |
| Document storage | ❌ | ✅ | ❌ | ❌ |
| Lead management pipeline | ❌ | ❌ | ✅ | ✅ (Ultimate) |
| Account merge | ❌ | ✅ | ❌ | ⚠️ |
| HIPAA compliance | ❌ | ❌ | ✅ | ❌ |

**Notes (updated 2026-07-14):** Agon's Smart Lists remain a genuine strength; manual tags shipped in
Phase 1 (auto-tagging rules not yet built). Still missing: family accounts, lead pipeline, document
storage.

---

### Marketing & Automations

| Feature | Agon | bsport | Momence | Mindbody |
|---------|------|--------|---------|----------|
| Event-triggered emails | ✅ | ✅ | ✅ | ✅ |
| Custom email templates | ✅ | ✅ | ✅ | ✅ |
| Drip campaigns / sequences | ❌ | ✅ (Smartlists) | ✅ (Sequences) | ✅ (Journeys) |
| Multi-step automations | ❌ | ✅ | ✅ | ✅ |
| Behavioral triggers (inactivity, milestones) | ❌ | ✅ | ✅ | ✅ |
| A/B testing | ❌ | ❌ | ❌ | ✅ |
| Newsletter builder | ❌ | ✅ (CoachMail + Canva) | 🟡 | ✅ |
| Win-back / re-engagement | ❌ | ✅ | ✅ | ✅ |
| Birthday automations | ❌ | ✅ | ✅ | ✅ |
| Tag-based targeting | ❌ | ✅ | ✅ | ❌ |
| Promo codes | ❌ | ✅ | ✅ | ✅ (Accelerate+) |

---

### Communication Channels

| Feature | Agon | bsport | Momence | Mindbody |
|---------|------|--------|---------|----------|
| Email (transactional) | ✅ | ✅ | ✅ | ✅ |
| Email (marketing) | 🟡 (basic) | ✅ | ✅ | ✅ |
| Push notifications | ✅ | ⚠️ | ✅ | ✅ |
| SMS | ✅ (Twilio) | ✅ | ✅ | ✅ |
| WhatsApp | ❌ | ❌ | ✅ | ❌ |
| In-app messaging / inbox | ❌ | ✅ | ✅ | ✅ |
| Webchat widget | ❌ | ❌ | ✅ | ✅ (Messenger[ai]) |
| Outbound calling | ❌ | ❌ | ✅ | ❌ |

---

### Mobile App

| Feature | Agon | bsport | Momence | Mindbody |
|---------|------|--------|---------|----------|
| Client-facing mobile app | ✅ | ✅ (branded) | ✅ (branded) | ✅ (branded) |
| Class browsing & booking | ✅ | ✅ | ✅ | ✅ |
| Membership purchase | ✅ | ✅ | ✅ | ✅ |
| Profile management | ✅ | ✅ | ✅ | ✅ |
| QR check-in | ✅ | ❌ | ✅ | ✅ |
| Offline support | ✅ | ⚠️ | ❌ | ❌ |
| Branded white-label app | ❌ | ✅ (App Store/Play Store) | ✅ | ✅ |
| Staff mobile app | ❌ | ❌ | ❌ (PWA) | ✅ |
| On-demand video access | ❌ | ✅ | ✅ | ✅ |
| Marketplace / discovery | ❌ | ✅ | ❌ | ✅ (3M+ users) |

**Notes:** Agon's offline support is a differentiator. But lack of branded white-label and marketplace listing are gaps.

---

### Customer Portal / Web Widgets

| Feature | Agon | bsport | Momence | Mindbody |
|---------|------|--------|---------|----------|
| Embeddable schedule widget | ❌ | ✅ | ✅ | ✅ |
| Embeddable booking widget | ❌ | ✅ | ✅ | ✅ |
| Web customer portal | ❌ | ✅ | ✅ | ✅ |
| Gift card widget | ❌ | ✅ | ✅ | ✅ |
| Custom CSS styling | ❌ | ✅ | ✅ | ✅ |

**Notes:** Agon forces all client interaction through the mobile app. All competitors offer embeddable web widgets.

---

### Online / Virtual Classes

| Feature | Agon | bsport | Momence | Mindbody |
|---------|------|--------|---------|----------|
| Zoom integration | ❌ | ✅ | ✅ | ❌ |
| Native livestream | ❌ | ❌ | ❌ | ✅ ($49/mo add-on) |
| Video on demand | ❌ | ✅ | ✅ | ✅ ($99/mo add-on) |
| Course content dripping | ❌ | ❌ | ✅ | ❌ |
| Hybrid (in-person + online) | ❌ | ✅ | ✅ | ✅ |

---

### Forms / Waivers / Contracts

| Feature | Agon | bsport | Momence | Mindbody |
|---------|------|--------|---------|----------|
| Custom forms | ✅ (desktop+backend) | ✅ | ✅ | ✅ |
| Liability waivers | ✅ (desktop+backend) | ✅ | ✅ | ✅ |
| Digital signatures | ✅ | ❌ | ✅ | ✅ |
| Contracts / agreements | ❌ | ✅ | ✅ | ✅ |
| GDPR consent tracking | ✅ | ⚠️ | ✅ | ✅ |

**Notes (updated 2026-07-14):** Backend + desktop shipped in Phase 1 (1.9); mobile signing UI shipped
[PR #48](https://github.com/edocasciotta/Agon/pull/48). Only remaining gap in this table: contracts/agreements.

---

### Gift Cards / Loyalty / Referrals

| Feature | Agon | bsport | Momence | Mindbody |
|---------|------|--------|---------|----------|
| Gift cards | ✅ | ✅ | ✅ | ✅ |
| Loyalty / rewards program | ❌ | ❌ | ✅ (perks) | ✅ |
| Referral program | ❌ | 🟡 | ✅ | ✅ |
| Reviews / ratings | ❌ | ❌ | ✅ | ✅ |

---

### Reporting & Analytics

| Feature | Agon | bsport | Momence | Mindbody |
|---------|------|--------|---------|----------|
| Attendance reports | ✅ | ✅ | ✅ | ✅ |
| Revenue reports | ✅ | ✅ | ✅ | ✅ |
| Membership reports | ✅ | ✅ | ✅ | ✅ |
| Retention / churn | ✅ | ✅ | ✅ | ✅ |
| CSV export | ✅ | ✅ | ✅ | ✅ |
| Dashboard KPIs | ✅ | ✅ | ✅ | ✅ |
| Class profitability | ❌ | ❌ | ✅ | ✅ |
| Custom report views | ❌ | ✅ (Reports 2.0) | ✅ (Insights) | ✅ (Analytics 2.0) |
| Deferred revenue | ❌ | ✅ | ❌ | ❌ |
| BI tool integration | ❌ | ❌ | ❌ | ✅ (Snowflake/Tableau) |
| Cross-location comparison | ❌ | ❌ | ❌ | ✅ |

---

### Multi-Location / Franchise

| Feature | Agon | bsport | Momence | Mindbody |
|---------|------|--------|---------|----------|
| Location-scoped data | ✅ | ✅ | ✅ | ✅ |
| Location CRUD | ✅ | ✅ | ✅ | ✅ |
| Franchise dashboard | ❌ | ✅ (Master Account) | ✅ (Corporate) | ✅ |
| Royalty tracking | ❌ | ✅ | ✅ | ✅ |
| Centralized marketing | ❌ | ✅ | ✅ | ✅ |
| Cross-location passes | ❌ | ✅ | ❌ | ✅ |
| Template rollout to new locations | ❌ | ❌ | ❌ | ✅ |

---

### Integrations & API

| Feature | Agon | bsport | Momence | Mindbody |
|---------|------|--------|---------|----------|
| Public REST API | ❌ | ❌ | ❌ | ✅ (V6.0) |
| Webhooks | ❌ | ✅ | ❌ | ✅ |
| Zapier | ❌ | ❌ | ✅ | ✅ |
| ClassPass | ❌ | ✅ | ✅ | ✅ |
| Wellhub / Gympass | ❌ | ✅ | ✅ | ❌ |
| QuickBooks / Xero | ❌ | ✅ | ✅ | ❌ |
| Google Analytics / Pixels | ❌ | ✅ | ✅ | ⚠️ |
| Mailchimp | ❌ | ❌ | ✅ | ❌ |
| Calendar sync (iCal/Google) | ✅ (iCal export) | ✅ | ✅ | ✅ |

---

### Access Control / Hardware

| Feature | Agon | bsport | Momence | Mindbody |
|---------|------|--------|---------|----------|
| Door access system | ❌ | ✅ | ✅ (Kisi, Passport) | ✅ (Gym Access) |
| Barcode scanner check-in | ❌ | ✅ | ✅ | ✅ |
| Mobile credentials (Apple/Google Wallet) | ❌ | ❌ | ❌ | ✅ |

---

### AI Features

| Feature | Agon | bsport | Momence | Mindbody |
|---------|------|--------|---------|----------|
| AI studio management agent | ✅ (20+ tools) | ❌ | ❌ | ❌ |
| AI support chatbot | ✅ (docs-grounded) | ❌ | ❌ | ❌ |
| AI sales agent / inbox | ❌ | ❌ | ✅ | ✅ (Messenger[ai]) |
| AI auto-responses (24/7) | ❌ | ❌ | ✅ | ✅ |

**Notes:** Agon's AI agent is genuinely unique — no competitor has a natural-language studio operations tool. However, Momence and Mindbody have AI for customer-facing sales/support, which Agon lacks.

---

### Other Notable Features

| Feature | Agon | bsport | Momence | Mindbody |
|---------|------|--------|---------|----------|
| Data migration / import | ✅ | ⚠️ | ⚠️ | ✅ |
| Onboarding wizard | ✅ | ⚠️ | ⚠️ | ✅ |
| i18n (7+ languages) | ✅ | ✅ | ⚠️ | ✅ (22 languages) |
| Community posts | ❌ | ❌ | ✅ | ❌ |
| Workout tracking | ❌ | ❌ | ✅ | ❌ |
| Business financing / capital | ❌ | ❌ | ❌ | ✅ (Mindbody Capital) |
| Branded white-label app publishing | ❌ | ✅ | ✅ | ✅ |
| Custom domain | ❌ | ⚠️ | ✅ | ❌ |

---

## Phase 4 — Gap Analysis

### Missing Features (Critical Gaps)

#### 1. Appointments / 1-on-1 Booking
**All competitors have it.** This is the #1 blocker. Personal trainers, massage therapists, aestheticians, and private coaches cannot use Agon without appointment scheduling. bsport offers room/resource booking, Momence adds SOAP notes and intake forms. Mindbody supports recurring client appointments with buffer times.

#### 2. SMS Messaging
**All competitors have it.** SMS is the primary communication channel for time-sensitive messages (class reminders, waitlist offers, late-cancel warnings). Email open rates average 20%; SMS averages 98%. Agon relies solely on push notifications (requires app install) and email.

#### 3. Online / Virtual Classes
**All competitors have it.** Post-pandemic, hybrid is table-stakes. bsport and Momence integrate with Zoom; Mindbody has its own livestream platform. Studios offering online classes cannot use Agon.

#### 4. POS / Retail
**All competitors have it.** Studios sell water, protein bars, branded merchandise, and supplements. Mindbody has the richest POS (hardware terminals, inventory, reorder alerts). bsport has a full webshop with barcode/label printing.

#### 5. Forms / Waivers / Digital Signatures
**All competitors have it.** Liability waivers are legally required in most jurisdictions. Studios currently need a separate tool (Smartwaiver, etc.) alongside Agon.

#### 6. Gift Cards
**All competitors have it.** Gift cards are a significant revenue driver, especially during holidays. All competitors offer digital gift cards with online purchase and custom branding.

#### 7. Marketing Automations / Sequences
**All competitors have it.** Momence's "Sequences" and bsport's "Smartlists" allow multi-step automations triggered by booking behavior, membership events, milestones, and inactivity. Agon only has basic event-triggered single emails.

#### 8. Staff Payroll & Time Clock
**All competitors have it.** Pay rates per class, commissions, time clock, and payroll reports are standard. Studios currently need separate payroll tracking.

#### 9. Invoicing (EU Compliance)
**bsport excels here.** Sequential numbering, VAT handling, Italian e-invoicing, Spanish VeriFactu, German fiskaly/TSE. For Agon's European market, this is near-mandatory.

#### 10. Web Customer Portal / Widgets
**All competitors have it.** Embeddable schedule and booking widgets let studios drive bookings from their website. Agon forces all client interaction through the mobile app, which increases friction.

---

### Weak Features (Partial Implementation)

#### 1. Marketing Email
Agon has event-triggered emails and custom templates, but lacks newsletter builders, Canva integration, drip sequences, and behavioral triggers. Competitors offer full marketing suites.

#### 2. Multi-Location / Franchise
Agon has location-scoped data but no franchise dashboard, royalty tracking, centralized marketing, or cross-location pass management.

#### 3. Staff Roles / Permissions
Agon has a basic User + Client model with instructor profiles, but no granular custom roles (front desk, manager, teacher-only view, etc.) like all three competitors.

#### 4. Membership Features
Missing: rollover credits, intro offers/trials, promo codes, contracts, commitment periods. These are standard acquisition and retention tools.

#### 5. Reporting
Basic reports (4 types + CSV) vs. competitors' custom views, cross-location comparison, deferred revenue, class profitability, and BI tool integration.

---

### Competitive Advantages (Where Agon Leads)

#### 1. AI Studio Management Agent (Unique)
No competitor has a natural-language agent that can create classes, book clients, manage rosters, and generate reports through conversation. This is a genuine first-mover advantage and the strongest differentiator. bsport and Momence have nothing comparable. Mindbody's Messenger[ai] is client-facing only.

#### 2. AI Support Chatbot (Unique)
Docs-grounded support bot that answers studio owner questions. No competitor has this for the business operator side.

#### 3. Offline-Capable Mobile App
Agon's mobile app has pending queue and connectivity monitoring. No competitor documents offline support.

#### 4. Data Migration with Column Mapping
CSV import with platform-specific templates and visual column mapping is more polished than competitors' documented import flows.

#### 5. Onboarding Wizard
6-step guided setup is well-designed. Competitors have onboarding but it's less documented/visible.

#### 6. i18n Coverage (7 Languages, Full Stack)
Translations across mobile, desktop, and AI responses. bsport is comparable; Momence appears weaker; Mindbody leads with 22 languages.

#### 7. GDPR / Privacy (API-Level)
Data export, erasure, and consent tracking built in. bsport and Momence mention GDPR but Agon's implementation is more structured.

---

### Unique Opportunities (None of the Competitors Offer)

#### 1. AI-Powered Revenue Optimization
Extend the AI agent to proactively suggest: optimal class times based on attendance patterns, pricing recommendations, churn risk alerts, and membership upsell opportunities. No competitor does predictive studio analytics via AI.

#### 2. AI-Powered Client Communication
Combine the AI agent with SMS/email to auto-generate and send personalized re-engagement messages, class recommendations, and milestone celebrations. Momence and Mindbody have basic automation; none use LLM-generated personalized content.

#### 3. Natural Language Reporting
"How did last week compare to the same week last year?" — leverage the AI agent for conversational analytics. No competitor offers this.

#### 4. AI-Assisted Scheduling
Auto-suggest optimal class schedules based on historical demand, instructor availability, and capacity utilization. No competitor has this.

#### 5. White-Label AI for Studio Brands
Let studios configure the AI's personality and knowledge base so it feels like their own assistant. No competitor offers customizable AI.

---

## Phase 5 — Prioritization

| # | Feature | Customer Value | Business Impact | Implementation Complexity | Competitive Pressure | Score | Priority | Status (07-14) |
|---|---------|---------------|----------------|--------------------------|---------------------|-------|----------|----------|
| 1 | Appointments (1-on-1) | 5 | 5 | 4 | 5 | **19** | **Critical** | ✅ Shipped |
| 2 | SMS Messaging | 5 | 4 | 2 | 5 | **16** | **Critical** | ✅ Shipped |
| 3 | Forms / Waivers | 5 | 4 | 2 | 5 | **16** | **Critical** | ✅ Shipped (PR #48) |
| 4 | Web Booking Widgets | 4 | 5 | 3 | 5 | **17** | **Critical** | ❌ Open |
| 5 | Marketing Automations | 4 | 5 | 4 | 5 | **18** | **Critical** | ❌ Open |
| 6 | Gift Cards | 4 | 4 | 2 | 5 | **15** | **High** | ✅ Shipped |
| 7 | POS / Retail | 4 | 4 | 4 | 5 | **17** | **High** | ❌ Open |
| 8 | Staff Payroll | 4 | 3 | 3 | 5 | **15** | **High** | ❌ Open |
| 9 | Online / Virtual Classes | 4 | 4 | 3 | 5 | **16** | **High** | ❌ Open |
| 10 | Invoicing (EU) | 5 | 4 | 3 | 3 | **15** | **High** | ❌ Open |
| 11 | Promo Codes / Discounts | 4 | 4 | 2 | 5 | **15** | **High** | ✅ Shipped |
| 12 | Intro Offers / Trials | 4 | 4 | 2 | 4 | **14** | **High** | ✅ Shipped |
| 13 | Rollover Credits | 3 | 3 | 2 | 4 | **12** | **High** | ✅ Shipped |
| 14 | Late Cancel / No-Show Fees | 4 | 3 | 2 | 5 | **14** | **High** | ✅ Shipped |
| 15 | Custom Roles / Permissions | 3 | 3 | 3 | 5 | **14** | **Medium** | ❌ Open |
| 16 | Calendar Sync (iCal/Google) | 3 | 2 | 2 | 4 | **11** | **Medium** | ✅ Shipped |
| 17 | Contracts / Commitments | 3 | 3 | 2 | 4 | **12** | **Medium** | ❌ Open |
| 18 | Tags (manual + auto) | 3 | 3 | 2 | 4 | **12** | **Medium** | ✅ Shipped (manual) |
| 19 | Family / Child Accounts | 3 | 2 | 3 | 3 | **11** | **Medium** | ❌ Open |
| 20 | Workshops / Events | 3 | 3 | 3 | 4 | **13** | **Medium** | ❌ Open |
| 21 | Franchise Dashboard | 3 | 4 | 4 | 4 | **15** | **Medium** | ❌ Open |
| 22 | Door Access Control | 2 | 2 | 3 | 3 | **10** | **Medium** | ❌ Open |
| 23 | Aggregator Integrations | 3 | 3 | 3 | 4 | **13** | **Medium** | ❌ Open |
| 24 | Webhooks / API | 3 | 3 | 3 | 3 | **12** | **Medium** | ❌ Open |
| 25 | Branded White-Label App | 3 | 3 | 5 | 4 | **15** | **Medium** | ❌ Open |
| 26 | Loyalty / Rewards | 2 | 3 | 3 | 3 | **11** | **Low** | ❌ Open |
| 27 | Referral Program | 2 | 3 | 2 | 3 | **10** | **Low** | ❌ Open |
| 28 | Reviews / Ratings | 2 | 2 | 2 | 2 | **8** | **Low** | ❌ Open |
| 29 | Video on Demand | 2 | 3 | 4 | 3 | **12** | **Low** | ❌ Open |
| 30 | Community Features | 2 | 2 | 3 | 1 | **8** | **Low** | ❌ Open |
| 31 | BI Tool Integration | 2 | 2 | 3 | 1 | **8** | **Low** | ❌ Open |
| 32 | AI Sales Agent (Client-Facing) | 3 | 4 | 4 | 2 | **13** | **Low** | ❌ Open |

### Scoring Methodology

- **Customer Value (1-5):** How much does the target customer (boutique fitness studio owner) need this?
- **Business Impact (1-5):** Revenue potential, churn prevention, market expansion
- **Implementation Complexity (1-5):** Higher = harder (inverted for scoring: a "2" complexity is easier and thus better)
- **Competitive Pressure (1-5):** How many competitors have it and how well?
- **Score:** Sum of all four dimensions. Higher = higher priority.
- **Priority bands:** Critical (16+), High (13-15), Medium (10-12), Low (<10) — adjusted for strategic importance.

### Reasoning for Top Priorities

**Appointments (Critical, Score 19):** Without 1-on-1 booking, Agon cannot serve personal trainers, wellness practitioners, or beauty studios. This locks out ~40% of the addressable market. Every competitor has it. This is the single feature most likely to lose a deal.

**SMS (Critical, Score 16):** Low complexity (Twilio integration), massive engagement uplift. Studios expect SMS reminders. Push notifications require app installation; SMS works universally.

**Forms/Waivers (Critical, Score 16):** Low complexity, high legal necessity. Studios cannot operate without liability waivers in most markets. Currently requires a third-party tool.

**Web Booking Widgets (Critical, Score 17):** Every competitor offers embeddable widgets. Studios need bookings from their website. Mobile-app-only creates unacceptable friction for new clients who haven't installed the app.

**Marketing Automations (Critical, Score 18):** The difference between a scheduling tool and a business platform. Drip campaigns, win-back sequences, and milestone triggers directly drive revenue and retention.

---

## Phase 6 — Evidence Summary

### bsport Evidence

| Feature | Source URL | Key Evidence |
|---------|-----------|-------------|
| Appointments | `/en/collections/3868465-schedule` | 6 schedule articles + 15 appointment articles; room rental, duo appointments, recurring private sessions |
| POS | Settings > Payment Methods | "How to Configure the POS," "POS Staff Cheat Sheet," Stripe Terminal integration |
| Invoicing | `/en/collections/3868505-transactions` | Sequential numbering, PDF, VAT, Italian e-invoicing, Spanish VeriFactu, German fiskaly |
| Branded App | `/en/collections/8575557-branded-app` | 15 articles on publishing branded iOS/Android apps with custom descriptions, screenshots, logos |
| Marketing | `/en/collections/3868518-marketing` | 91 articles; Smartlists (29 articles), CoachMail, newsletters, Canva integration |
| Access Control | `/en/collections/11843931-access-control` | 9 articles; barcode scanner check-in, automatic door control, per-pass access grants |
| Webshop | Products > Webshop | Product variants, stock management, supplier management, barcode/label printing |
| Gift Cards | Products > Giftcards | 10 articles; custom images, widgets, inter-customer gifting |
| Payroll | Settings > Payroll | Per-session/appointment rates, remuneration groups, teacher invoice generation, commissions |
| Time Clock | `/en/articles/6132256` | Arrival/departure logging, Excel export, absence marking |
| VOD | Marketing > Digital Offer | 18+ articles on Videos & eBooks, playlists, VOD-specific passes |
| Forms/Waivers | Marketing > Forms | Custom forms, automatic forms, liability waiver at signup |

### Momence Evidence

| Feature | Source URL | Key Evidence |
|---------|-----------|-------------|
| Appointments | `/collections/3292040-appointments` | Board setup, service variants, buffer times, intake forms, SOAP notes, digital signatures, no-show fees |
| Sequences (Automations) | `/articles/12030801` | Trigger-based automation; triggers include bookings, milestones, membership events, birthdays, tags, leads |
| AI Sales Agent | `/collections/18269558-ai-sales-agent` | Setup checklist, FAQ management, performance reporting, "Agent Thinking" visibility, inbox escalation |
| WhatsApp | `/articles/11564884` | WhatsApp templates sent from Sequences as automated actions |
| POS | `/articles/6998085` | Dedicated POS with barcode scanner, drop-in-to-class, Stripe card reader |
| Gift Cards | `/articles/12029899` | Gift card sales via embedded plugin and storefront |
| Reviews | `/articles/12030807`, `/articles/7047158` | Review collection, reviews plugin for website embedding |
| Franchise | `/collections/11446563-franchise-corporate` | Corporate dashboard, royalty fees, centralized templates, entity management |
| VOD | `/collections/3292052-on-demand-content` | Video upload, rental pricing, content dripping for courses, quizzes |
| Waivers | `/articles/custom-waivers`, `/articles/12007139` | Custom waivers, subscription contracts, intake forms, child waivers, digital signatures |
| Leads Pipeline | Under marketing collection | Visual pipeline stages, drag-and-drop, funnels, webchat widget |
| Perks/Loyalty | `/articles/9830509` | Purchase-based perks/incentives to drive customer buying behavior |
| Community | `/articles/8441192` | Community posts for announcements, access tiers for content gating |

### Mindbody Evidence

| Feature | Source URL | Key Evidence |
|---------|-----------|-------------|
| Pick-a-Spot | `mindbodyonline.com/business/scheduling` | "Clients select preferred numbered spots in room layouts during booking" (Accelerate+) |
| Messenger[ai] | `mindbodyonline.com/business/messenger-ai` | "AI assistant trained in brand voice. 24/7 auto-responses. Multi-channel: text, webchat, Facebook Messenger" |
| Marketplace | `mindbodyonline.com/business/mindbody-app` | "3M+ active users. Business discovery by category/location. Dynamic pricing." |
| Public API | `developers.mindbodyonline.com` | REST API V6.0, sandbox environment, webhooks API, consumer activity API |
| Capital | `mindbodyonline.com/business/capital` | "Pre-approved offers based on Mindbody data. Flat fee, no interest. Sales-based repayment." |
| Multi-Location | `mindbodyonline.com/business/multi-location-management` | "Network-wide dashboard. Royalty calculator. Template-based settings rollout." |
| Loyalty | `support.mindbodyonline.com/s/article/General-Setup-Options-screen-Client-Rewards-Program-Settings` | "Points earned for attending, referrals, social media posts, spending. Configurable expiration." |
| Branded App | `mindbodyonline.com/business/branded-app` | "Custom-branded app with business logo, colors, identity. Track visit streaks and milestones." |
| Branded Web Tools | `mindbodyonline.com/business/branded-web-tools` | "Embeddable widgets: class calendar, appointment booking, staff profiles. 22 languages." |
| POS | `mindbodyonline.com/business/point-of-sale` | "Hardware: cash registers, card readers, mobile readers, barcode scanners, receipt printers." |
| Staff Substitution | `mindbodyonline.com/business/staff-management` | "Automated substitution system. Text notifications for sub requests." |
| Gift Cards | `support.mindbodyonline.com/s/article/Gift-cards-FAQ` | "Assignable and prepaid. Online and in-person sales. Custom branding. Digital delivery." |
| Referrals | `mindbodyonline.com/business/customer-referral-program` | "Referral tracking with reward points. Escalating rewards for multiple referrals." |
| Door Access | `integrations.mindbodyonline.com/partners/gym-access` | "Mobile credentials (Apple/Google Wallet). Automated onboarding. Door events → attendance." |

---

## Phase 7 — Final Report

### Quick Wins (High Value, Low Complexity) — ✅ 9/9 DELIVERED (Competitive Gap Phase 1, PR #12 + follow-ons)

These can be built in 1-3 weeks each and immediately close competitive gaps. **Status 2026-07-14:
all nine shipped.** Forms/Waivers is backend+desktop only — mobile signing UI is still open, see
Status Update at the top of this document.

| Feature | Estimated Effort | Why Quick |
|---------|-----------------|-----------|
| **SMS Messaging (Twilio)** | 1-2 weeks | Add Twilio provider alongside existing push/email. Reuse notification templates and event triggers. |
| **Forms / Waivers** | 1-2 weeks | New model + CRUD API + frontend builder + mobile signature capture. No third-party dependency. |
| **Gift Cards** | 1-2 weeks | New model, Stripe one-time payment, redemption as account credit. Widget can come later. |
| **Promo Codes / Discounts** | 1 week | New model, apply at checkout, validate on booking/purchase. |
| **Intro Offers / Trials** | 1 week | Flag on MembershipType + time-limited pricing logic. |
| **Late Cancel / No-Show Fees** | 1 week | Extend existing cancellation window logic with fee amount on StudioSettings. |
| **Rollover Credits** | 3-5 days | Add rollover_credits field to Membership, carry forward on billing cycle. |
| **Calendar Sync (iCal export)** | 3-5 days | Generate .ics feed URL per instructor/client. Read-only. |
| **Tags (manual + auto)** | 1 week | New Tag model, M2M with Client, auto-tag rules on booking/membership events. |

### Strategic Investments (Large, Worth Planning)

| Feature | Estimated Effort | Strategic Value | Status (07-14) |
|---------|-----------------|----------------|----------|
| **Appointments System** | 6-8 weeks | Opens personal training, wellness, and beauty verticals. Requires: availability engine, buffer times, service types, appointment passes, recurring appointments. | ✅ Shipped (2026-07-12, Phase 2.1) — recurring appointments/duo/room-booking still open |
| **Marketing Automation Engine** | 4-6 weeks | Transforms Agon from scheduling tool to business platform. Requires: trigger system, action pipeline, sequence builder UI, behavioral event bus. | ❌ Open — highest-scoring remaining gap (18) |
| **Web Booking Widgets** | 3-4 weeks | Embeddable React components served via CDN. Schedule, booking, pricing widgets. Critical for studio websites. | ❌ Open |
| **POS / Retail** | 4-6 weeks | Product catalog, inventory, Stripe Terminal integration, barcode scanning. Revenue diversification. | ❌ Open |
| **Invoicing (EU Compliant)** | 3-4 weeks | Sequential numbering, PDF generation, VAT handling, Italian e-invoicing. Required for EU market. | ❌ Open |
| **Staff Payroll** | 3-4 weeks | Pay rates, commissions, time clock, payroll reports. Every competitor has this. | ❌ Open |
| **Online Classes (Zoom)** | 2-3 weeks | Zoom OAuth integration, meeting creation on class schedule, join links in booking confirmation. | ❌ Open |
| **Branded White-Label App** | 8-12 weeks | Configurable Expo build pipeline. App Store/Play Store publishing service. Major differentiator but complex. | ❌ Open |

### Competitive Risks

| Risk | Severity | Details |
|------|----------|---------|
| **No appointments = blocked vertical** | 🔴 Critical | Personal trainers, wellness studios, and beauty businesses cannot adopt Agon. This is ~40% of the addressable market. |
| **No SMS = engagement gap** | 🔴 Critical | 98% open rate vs. 20% for email. Competitors use SMS for reminders, waitlist offers, and marketing. |
| **No web widgets = acquisition friction** | 🟠 High | New clients discovering a studio via its website cannot book without installing the mobile app. Every competitor has embeddable booking. |
| **No marketing automation = churn risk** | 🟠 High | Studios cannot run win-back campaigns, milestone celebrations, or drip sequences. They'll use Momence or Mindbody for the marketing suite alone. |
| **No invoicing = EU compliance risk** | 🟠 High | Italian, Spanish, and German tax authorities require compliant sequential invoicing. bsport has deep EU tax support. |
| **No POS = revenue leakage** | 🟡 Medium | Studios selling retail products need a separate system. Not a deal-breaker but reduces stickiness. |
| **No branded app = perception gap** | 🟡 Medium | Competitors offer white-label App Store apps. Studios see this as premium/professional. |

### Roadmap Proposal

#### Next Month (Quick Wins — Close Critical Gaps)

| Week | Deliverable | Rationale |
|------|-------------|-----------|
| Week 1 | SMS messaging (Twilio integration) | Highest-ROI, lowest-effort gap closure. Immediately improves engagement. |
| Week 2 | Forms & waivers with digital signatures | Legal necessity. Removes need for third-party waiver tools. |
| Week 3 | Late cancel/no-show fees + promo codes + intro offers | Three small features that collectively close big membership acquisition gaps. |
| Week 4 | Gift cards + rollover credits + tags | Revenue tool + retention tool + CRM foundation. All low-complexity. |

**Outcome:** 9 competitive gaps closed. Agon becomes viable for studios that previously needed supplementary tools.

#### Next Quarter (Strategic Features — Expand Addressable Market)

| Month | Deliverable | Rationale |
|-------|-------------|-----------|
| Month 2 | **Appointments system** (availability, services, buffer times, booking) | Unlocks personal training and wellness verticals. The single highest-impact feature. |
| Month 2-3 | **Web booking widgets** (schedule + booking + pricing embeds) | Removes mobile-app-only friction. Studios can drive bookings from their website. |
| Month 3 | **Marketing automation engine** (triggers, sequences, behavioral events) | Transforms Agon from scheduling tool to business platform. Retention and revenue driver. |
| Month 3-4 | **Online classes — Zoom integration** | Enables hybrid studios. Low complexity relative to impact. |

**Outcome:** Agon serves 90%+ of boutique fitness use cases. Addressable market doubles with appointments.

#### Next 6-12 Months (Platform Maturity — Compete at Scale)

| Quarter | Deliverable | Rationale |
|---------|-------------|-----------|
| Q3 | Staff payroll + custom roles/permissions | Operational completeness. Every competitor has this. |
| Q3 | EU invoicing (sequential numbering, VAT, Italian/Spanish compliance) | Required for European market expansion. bsport's strongest advantage. |
| Q3 | POS / retail (product catalog, Stripe Terminal, inventory) | Revenue diversification. Increases stickiness. |
| Q4 | Franchise dashboard (royalty tracking, centralized marketing, template rollout) | Multi-location studios are highest-ARPU customers. |
| Q4 | Aggregator integrations (ClassPass, Wellhub) | Fill empty spots via marketplace. Standard expectation. |
| Q4 | Public API + webhooks | Enable third-party integrations. Required for enterprise customers. |
| Q4-Q1 | Branded white-label app publishing | Premium differentiator. Complex but high perceived value. |
| Q1 | AI sales agent (client-facing, 24/7 auto-responses) | Leverage existing AI infrastructure for customer-facing use. Unique in market. |

**Outcome:** Feature parity with bsport and Momence. AI capabilities create clear differentiation vs. all competitors including Mindbody.

---

## Next Up — proposed as of 2026-07-14

With Quick Wins (9/9) and Appointments both delivered, the three remaining **Critical**-priority
gaps from Phase 5 are: **Marketing Automations** (score 18, highest of all open items), **Web
Booking Widgets** (17), and **Online / Virtual Classes** (16) — plus the small residual **mobile
waiver-signing UI** gap (backend/desktop already done, mobile is the only missing surface).
Recommended sequencing, to be confirmed with the user before delegating:

1. **Mobile waiver-signing UI** (days, not weeks) — closes out an already-95%-done feature; cheap
   to finish before starting a new multi-week investment.
2. **Web Booking Widgets** (3-4 weeks) — directly reduces client-acquisition friction (the #1
   competitive risk flagged below) and is a prerequisite for studios embedding booking on their own
   sites, which several Quick Win features (gift cards, promo codes) also benefit from once exposed
   publicly.
3. **Marketing Automation Engine** (4-6 weeks) — highest strategic score; builds on existing Smart
   Lists + Email Events infrastructure rather than starting from zero.
4. **Online Classes (Zoom)** (2-3 weeks) — lowest effort of the three remaining Critical gaps.

---

## Summary

**Agon's position:** A solid group-class management platform with genuinely unique AI capabilities (studio management agent, support chatbot) and strong technical foundations (offline mobile, i18n, GDPR, data migration). However, it has significant functional gaps that prevent it from serving large segments of the fitness and wellness market.

**Biggest strength:** The AI agent is a first-mover advantage that no competitor has replicated. This should be the centerpiece of Agon's positioning.

**Biggest weakness:** No appointment booking. This single gap blocks ~40% of potential customers.

**Strategic recommendation:** Execute the quick wins immediately (SMS, waivers, gift cards, promo codes) to close embarrassing gaps, then invest in appointments and marketing automation as the two highest-impact strategic features. The AI advantage buys time, but the functional gaps will lose deals if left unaddressed.
