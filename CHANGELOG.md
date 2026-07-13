# Changelog

All notable changes to Agon are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Agon uses [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Changed
- Desktop sidebar navigation reorganized into 6 logical categories with section headers (Overview, Scheduling, People, Sales, Marketing, Admin) instead of one flat 14-item list plus a separate ad-hoc Marketing block. Same 19 routes, icons, and labels — pure regrouping, `frontend/src/renderer/src/components/Layout.tsx`. New `nav.sections.*` i18n keys added to all 7 locales; the existing `marketing.sectionTitle` key is reused for the Marketing header instead of duplicating it.

### Added
- Mobile Bookings tab now shows useful class info instead of raw ids: each card's title is the class type name (falling back to "Class #{id}" only when the linked class type is unresolved, e.g. cancelled/orphaned), plus the class start date/time, "with {instructor}", and the location, all sourced from the newly-enriched `GET /api/v1/bookings` response (`class_type_name`, `class_starts_at`, `class_ends_at`, `instructor_name`, `location_name` — all optional/nullable). Tapping a card now pushes to a new booking detail screen (`app/booking/[id].tsx`, backed by a new `bookingsApi.get(id)`) showing date, time, location, instructor, status, and the existing cancel action. A new instructor profile screen (`app/instructor/[id].tsx`, backed by a new `instructorsApi.get(id)`) shows full name, bio, and email — no photo yet, since `Instructor.photo_path` has no upload/serving infrastructure. The Appointments tab's instructor name is now tappable to this same profile screen (`Appointment.instructor_id` is a direct numeric id); the booking detail screen's instructor name is plain text since the enriched booking response only exposes `instructor_name` as a string, not a numeric id to link to. Fixed the `agon://bookings/{id}` deep link, which previously pointed at a non-existent `/bookings/{id}` route, to use the new singular `/booking/{id}` screen. New `bookings.*` and `instructor.*` i18n keys added to all 7 locales.
- Profile photo upload/serving for clients and instructors: `POST /api/v1/clients/{client_id}/photo` (client's own token or manager) and `POST /api/v1/instructors/{instructor_id}/photo` (instructor's own token, resolved via `Instructor.user_id`, or manager) accept a `multipart/form-data` image (`.jpg`/`.jpeg`/`.png`/`.webp` only, 5MB cap, validated by extension + declared content-type + Pillow magic-byte/format check), store it under a new `backend/uploads/photos/` directory with a server-generated collision-proof filename, and update the entity's existing `photo_path` column (no migration — the column already existed). Replacing a photo deletes the old file best-effort. New `GET /api/v1/photos/{filename}` serving route requires any authenticated role (not owner-restricted — profile photos are visible studio-wide) and sanitizes the filename (basename + allow-list + `commonpath` containment check) before touching disk, per `docs/SECURITY_GUIDELINES.md` §4.1. `InstructorResponse` and `ClientResponse` gained a computed `photo_url` (`/api/v1/photos/{filename}` or `null`). New `backend/app/services/photo_service.py`, `backend/app/routers/photos.py`; new IDOR/validation tests in `test_authorization.py` and `test_photos.py`.
- `GET /api/v1/bookings` and `GET /api/v1/bookings/{id}` now return denormalised `class_type_name`, `location_name`, `instructor_name`, `class_starts_at`, `class_ends_at` on `BookingResponse`, populated via outerjoin (same pattern as `ScheduledClassResponse.template_name`) so mobile booking cards can show real class/location/instructor info instead of bare IDs. `GET /api/v1/appointments` and `GET /api/v1/appointments/{id}` similarly gained `service_name`, `instructor_name`, `location_name` on `AppointmentResponse`. Response-shape only — no schema/model change, no migration. `backend/app/routers/bookings.py`, `backend/app/routers/appointments.py`, `backend/app/schemas/booking.py`, `backend/app/schemas/appointment.py`.
- Mobile custom branding: the mobile app now follows the studio's brand colors set by a manager in the desktop backoffice instead of shipping a hardcoded indigo. New `mobile/src/theme/ThemeContext.tsx` (`ThemeProvider`/`useTheme()`) fetches `GET /api/v1/studio/branding` (public, works pre-login) via React Query with standard `staleTime`/`gcTime`, computes `primaryDark`/`primaryLight` shades (`mobile/src/lib/color.ts`, mirroring the desktop `darken()`/`lighten()` helpers), and falls back to the original hardcoded indigo (`#4F46E5`) whenever a studio hasn't set a custom color or the fetch fails. The last successfully fetched color is cached in `SecureStore` so an offline app restart keeps showing the studio's real colors instead of flashing back to default indigo. Applied across ~46 call sites app-wide (tab bar, buttons, spinners, links, selected states, QR scan viewfinder) via `mobile/src/api/studio.ts`. Secondary/green accents tied to semantic state (success/error, discount, appointment "completed") were deliberately left hardcoded — only genuine brand accents were rewired.
- Mobile Appointments tab: clients can now browse and book 1-on-1 appointments from the mobile app — new "Appointments" tab (`app/(tabs)/appointments.tsx`) lists upcoming/past appointments with cancel support, and a new step-by-step booking flow (`app/appointment/book.tsx`) walks service → instructor → date → available slot → notes → confirm, mirroring the desktop `BookAppointmentModal` step order. New typed API clients `mobile/src/api/appointments.ts`, `appointmentServices.ts`, `instructors.ts`. Offline-first (`OfflineBanner`, standard `staleTime`/`gcTime`), fully translated in all 7 locales, and adds an `agon://appointments/{id}` deep link (routes to the Appointments tab). Staff-only actions (availability management, marking completed/no-show) remain desktop-only.
- `POST /api/v1/agent/act`: AI Action Mode — studio managers can create scheduled classes from a natural-language request (e.g. "create a Yoga class next Wednesday at Milano with Elena, 1 hour"). The LLM only extracts slots via tool calling; class type, location, instructor, and date are resolved deterministically server-side and a class is created only once every field is unambiguous — otherwise the assistant asks a clarifying question. Manager-only, opt-in toggle in the AI Support chat panel.
- `GET /api/v1/clients` pagination: `page`/`page_size` query params, response now `{items, total, page, page_size}`
- `GET /api/v1/memberships` pagination: `page`/`page_size` query params, response now `{items, total, page, page_size}`; Memberships page "All Memberships" table now uses the shared `Pagination` component (page size 50)
- `search` query param on `GET /api/v1/instructors` and `GET /api/v1/locations`, with matching searchbars on the Instructors and Establishments pages
- `setup.sh` / `setup.ps1`: one-command dev environment setup
- `Makefile`: `test`, `lint`, `format`, `build`, `dev` targets for all workspaces
- `.editorconfig`: consistent indent and charset rules
- `.github/pull_request_template.md`: PR checklist
- `.devcontainer/devcontainer.json`: VS Code Dev Container with Python 3.11 + Node 20
- `OPERATIONS.md`: runbook for updates, backups, Cloudflare Tunnel, Stripe
- `ROADMAP.md`: V1.0 → V3.0 product evolution plan
- `CODE_OF_CONDUCT.md`: Contributor Covenant v2.1
- `ARCHITECTURE.md`: system components, startup sequence, transaction semantics, delete strategy
- `docs-site/docs/api/database-schema.md`: full 17-table Mermaid ERD
- `docs-site/docs/glossary.md`: canonical terminology reference
- Playwright e2e scaffold: `auth.spec.ts`, `clients.spec.ts`, `calendar.spec.ts`, `instructors.spec.ts`
- Mobile connectivity store (`connectivityStore.ts`) with offline/online tracking
- Mobile Stripe Checkout: purchase screen now calls `POST /api/billing/checkout-session` and opens the Stripe URL via `Linking.openURL`; only `sellable_online` membership types are shown; loading state per card; `OfflineBanner` added; `@types/jest` installed and tsconfig updated to resolve pre-existing test typecheck errors
- Backend authorization tests (IDOR checks — 12 tests)
- Backend backup tests (6 tests)
- Backend load tests: 100 concurrent bookings, capacity enforcement
- Backend validation tests: edge cases for all schemas (12 tests)
- Backend migration tests: upgrade/downgrade verification
- Late cancellation / no-show fees: studio-wide defaults (`StudioSettings.late_cancel_fee` / `no_show_fee`, editable in Settings) with an optional per-membership-type override (`MembershipType.late_cancel_fee_override` / `no_show_fee_override`). Resolution order is membership-type override → studio default → no fee. A triggered fee is recorded as a `Payment` row (`provider: "system"`, `notes: "late_cancel_fee"`/`"no_show_fee"`) rather than an automatic card charge.
- Rollover credits: `MembershipType.rollover_enabled` / `max_rollover_credits` let unused credits on a recurring membership carry into the next billing period (capped, or unlimited if no max is set) instead of being lost at renewal. Applied by `app/services/rollover_service.py::process_rollover`, called from the Stripe subscription-renewal webhook path.
- Intro offers: `MembershipType.is_intro_offer` / `intro_price` / `intro_validity_days` let a membership type offer a discounted first-purchase price, applied automatically (no code needed) the first time a client buys that type or any other intro-offer type at the studio (`app/services/intro_offer_service.py::can_use_intro_offer`).
- Promo Codes: manager-managed discount codes (`POST/GET/PUT/DELETE /api/v1/promo-codes`), percentage or fixed-amount, with optional max-uses, one-per-client, and validity window. Clients validate and apply a code at checkout via `POST /api/v1/promo-codes/validate` (desktop backoffice purchase flow and mobile purchase screen both support it); validating does not redeem — redemption is recorded only once the purchase completes.
- Tags + Auto-Tag Rules: manager-managed client tags (`POST/GET/PUT/DELETE /api/v1/tags`) assignable manually from a client's profile, plus auto-tag rules (`POST/GET/PUT/DELETE /api/v1/auto-tag-rules`) that assign a tag automatically when a trigger event occurs (`booking_created`, `booking_cancelled`, `membership_purchased`, `membership_expired`, `no_show`, `checkin`) via `evaluate_auto_tags` calls in `app/routers/bookings.py`. Manager-only; mobile shows a client's own tags read-only on their profile.
- Calendar Sync (iCal): each client gets a personal, secret calendar feed URL (`GET/POST /api/v1/clients/{client_id}/calendar-sync[/regenerate]`, public feed at `GET /api/v1/calendar/{token}.ics`) showing upcoming confirmed bookings, subscribable from any calendar app that supports feed URLs. Regenerating invalidates the old link. Desktop: view/copy/regenerate card on Client Detail. Mobile: "Add to Calendar" (swaps `https://` → `webcal://` before `Linking.openURL`) and "Copy Link" (via `expo-clipboard`) on the Profile screen.
- Desktop Gift Cards management page (`/gift-cards`): manager-only issue/list/deactivate flow against `POST/GET/DELETE /api/v1/gift-cards`, with recipient, initial value vs. remaining balance, and active/inactive/expired status shown per card
- Mobile Gift Cards: membership purchase screen (`app/membership/purchase.tsx`) now accepts an optional gift card code alongside the existing promo code — validated via `POST /api/v1/gift-cards/validate`, shown with remaining balance, removable, independent of promo codes. When a gift card fully covers the membership price, `POST /api/billing/checkout-session` grants the membership synchronously (`already_completed: true`) and the app shows a success state instead of opening a Stripe URL. New self-purchase screen (`app/gift-card/purchase.tsx`, reachable from the Membership tab via "Give a Gift Card") lets a client buy a gift card as a present via `POST /api/v1/gift-cards/checkout-session`. Translated across all 7 locales.
- Desktop SMS (Twilio) messaging, mirroring the existing Email system: a new SMS tab in Settings (`GET/PUT /api/v1/sms/settings`, masked auth token, test-send via `POST /api/v1/sms/settings/test`), SMS Templates page (`/marketing/sms-templates`, CRUD against `/api/v1/sms/templates`, with a live character/segment counter), SMS Events page (`/marketing/sms-events`, assigns a template per event type via `PUT /api/v1/sms/events/{event_type}`), and a manual one-off "Send SMS" action on the client detail page (`POST /api/v1/sms/send`, shown only when the client has a phone on file). Translated across all 7 locales.
- Desktop Waivers / Forms management page (`/waivers`, feature 1.9 — last Phase 1 item): manager-only CRUD list against `POST/GET/PUT/DELETE /api/v1/waivers`, with title, version, "requires before booking" toggle/badge, and active/inactive status per waiver. Editing the waiver body warns the manager that it bumps the version and clients must re-sign. Deactivation (soft delete, signature history preserved) uses the non-destructive indigo confirm pattern, not the red destructive-delete pattern. Client Detail page gained a read-only Waivers card (`GET /api/v1/clients/{client_id}/waivers`) showing each active waiver's signed/unsigned status and signed date, with a "Blocks booking" badge on unsigned required waivers — no sign-on-behalf-of-client action exists anywhere in the desktop app, since waiver signing is client-self-only by design. Booking creation now surfaces a plain-language error for `WAIVER_SIGNATURE_REQUIRED` (409) instead of a raw error code. Translated across all 7 locales.
- Desktop Appointments page (`/appointments`): 1-on-1 booking UI (personal training, massage, private coaching) for the appointment engine shipped in PR #18, distinct from the existing group-class Calendar. Three tabs — **Upcoming**: agenda-style list of appointments (`GET /api/v1/appointments`) with instructor/status filters and an "upcoming only" toggle, cancel (red confirm dialog) and complete/no-show staff actions (`PATCH /api/v1/appointments/{id}/cancel`, `.../complete`); **Services** (manager-only): CRUD for bookable services (`POST/GET/PATCH/DELETE /api/v1/appointment-services`), mirroring the Waivers soft-delete pattern; **Availability**: per-instructor weekly recurring schedule editor (`POST/GET/DELETE /api/v1/instructor-availability`) — a manager can manage any instructor's schedule, an instructor caller is restricted to their own (mirrors the backend's own `require_staff` + self-only check). New `BookAppointmentModal` drives the booking flow: service → instructor → date → available time slots (`GET /api/v1/appointments/available-slots`) → client typeahead search → optional notes → `POST /api/v1/appointments`. Nav entry added right after Calendar. Translated across all 7 locales.

### Changed
- `require_manager` and `require_staff` now check JWT role claim before DB lookup (403 for wrong role, not 401)
- `GET /clients` and `GET /clients/{id}` restricted to staff roles (IDOR fix)
- Mobile `package.json`: removed `--passWithNoTests` flag from test script

### Fixed
- Mobile appointment booking screen (`app/appointment/book.tsx`) no longer shows a duplicate native header (raw route name "appointment/book") above its own custom header — the route now sets `<Stack.Screen options={{ headerShown: false }} />`, matching the pattern already used by `gift-card/purchase.tsx` and `membership/purchase.tsx`. The instructor selection step also now shows a translated empty-state message (`appointments.noInstructors`, all 7 locales) instead of a blank screen when a studio has no instructors available for the selected service. Since hiding the native header removed React Navigation's automatic safe-area inset, the screen's root view now wraps in `SafeAreaView` (from `react-native-safe-area-context`, matching `onboarding/scan.tsx`) so the custom header no longer collides with the status bar/notch on notched Android phones. The app root (`app/_layout.tsx`) now wraps the tree in `SafeAreaProvider`, which was previously never mounted anywhere in the app — this makes `SafeAreaView`/`useSafeAreaInsets()` return correct, synchronous inset measurements on all devices (varied notches, punch-holes, gesture-nav bars) instead of only after a layout pass, so this screen and any future safe-area-aware screen work correctly app-wide.
- Alembic migration `086528153a55`: removed erroneous `op.drop_table('locations')` artifact
- Performance test seed: `clients[i // 4]` ensures unique `(client_id, scheduled_class_id)` pairs
- Email settings: saving the form no longer clears the configured SMTP password unless it was actually changed
- SMS settings: saving the form no longer clears the configured Twilio auth token unless it was actually changed (same bug as Email settings, mirrored onto the new SMS tab)
- Mobile Appointments tab (`app/(tabs)/appointments.tsx`): removed the redundant custom title `<Text>` above the list (the native tab header already shows "Appointments"); the "Book new appointment" button is now a full-width styled button instead of sitting under a duplicate heading.
- Mobile appointment booking wizard (`app/appointment/book.tsx`): tapping "Back" no longer leaves a stale highlighted selection on a step the user is revisiting — `goBack()` now clears every step's state from the target step through the end of the wizard (via a `stepClearers` map keyed by `Step`) instead of only resetting the single step being returned to.
- Mobile Membership tab (`app/(tabs)/membership.tsx`): root view was a bare `<>` Fragment with no safe-area handling. Now wraps in `SafeAreaView` (from `react-native-safe-area-context`), matching the pattern in `app/appointment/book.tsx`. Unlike that screen, the Membership tab keeps its native tab header (`headerShown` isn't disabled in `(tabs)/_layout.tsx`), which already insets for the status bar/notch — so `edges` is set to `['left', 'right', 'bottom']` (excluding `top`) to avoid stacking a second top inset on top of the header's.

---

## [1.0.0] — 2026-06-29

### Added

**Booking engine**
- `POST /api/v1/bookings`: create booking with membership validation, capacity check, waitlist fallback
- `DELETE /api/v1/bookings/{id}`: cancel booking with automatic credit refund
- Waitlist promotion background task: promotes next client when a spot opens
- Waitlist expiry background task: removes stale waitlist entries

**Check-in system**
- `POST /api/v1/check-in`: three methods — QR code, app tap, manual (by name/email)
- QR code generation per booking
- Check-in validation: only confirmed bookings within 30 min of class start

**Memberships and payments**
- Membership types CRUD (recurring and credit pack)
- Client membership assignment, activation, expiry
- Stripe integration: checkout, webhook handler (idempotent), subscription lifecycle
- Payment recording and history

**Notifications and background tasks**
- Expo push notification sender
- Class reminder task (24 h before class)
- Membership expiry checker (daily)
- Nightly SQLite backup task

**AI support agent**
- Groq-powered chat endpoint (`POST /api/v1/support/chat`)
- 9-language support (EN, IT, FR, DE, ES, PT, NL, PT-BR, RU)
- Out-of-scope filtering with multilingual keyword sets
- Docs-context retrieval (32 k chars, `studio-manager/` prioritized)

**Email system**
- SMTP configuration per studio (`GET/PUT /api/v1/studio/email`)
- Test email endpoint (`POST /api/v1/studio/email/test`)
- Email templates CRUD (`/api/v1/email/templates`)
- Event assignments (7 event types, custom template per event)
- `POST /api/v1/clients`: create client from backoffice, send invite email

**Marketing**
- Smart Lists: filter engine (membership status, booking recency, join date, membership type)
- Smart List preview: count matching clients before sending

**GDPR**
- Data export: full JSON dump of all client data
- Right-to-erasure: anonymizes client record, hard-deletes PII
- Consent log: records purpose and timestamp of each consent event

**Migration assistant**
- CSV upload and column mapping (`POST /api/v1/migration/upload`, `POST /api/v1/migration/map`)
- Import execution with progress tracking
- Client invitation flow post-import

**Onboarding**
- 5-step wizard: studio info, admin account, Cloudflare Tunnel, Stripe, backup
- Studio QR code generation and print

**Frontend (desktop)**
- Calendar view: weekly/monthly, drag-to-create, event hover tooltip, zoom controls
- Client management: list, search, create modal (invite email), booking history
- Instructor management: list, create, deactivate
- Membership management: types CRUD, client membership assignment
- Reports: attendance, revenue, retention charts
- Settings: studio info, email/SMTP, backup, Stripe, AI agent
- Email Templates page, Event Assignments page
- Smart Lists page with filter builder and inline preview
- 9-language UI (EN/IT/FR/DE/ES/PT/NL/PL/TR) via react-i18next
- Support chat: multi-session sidebar, auto-title, localStorage persistence

**Mobile**
- Onboarding: QR scan → register/login → welcome
- Class browser and booking
- QR check-in screen
- Membership status view
- Push notification setup (Expo)

**Documentation site**
- 9-language AI support agent
- 14 feature pages for studio managers
- 4 client guides
- Migration guides (CSV, BSport, Momence)
- GDPR guide
- API reference overview
- Database schema ERD

**Infrastructure**
- SQLite WAL mode (`PRAGMA journal_mode=WAL`)
- Composite indexes on booking, scheduled_class, membership tables
- Alembic migration chain (13 migrations)
- GitHub Actions CI placeholder

---

[Unreleased]: https://github.com/your-org/agon/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/your-org/agon/releases/tag/v1.0.0
