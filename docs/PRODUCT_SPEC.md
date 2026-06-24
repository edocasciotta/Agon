# Agon — Product Specification
*Version 1.0 — June 2026*
*Covers: V1 (Fitness Studio, single location) with V2 forward-looking notes*

---

## 1. Overview

This document describes what Agon does from a product perspective. It defines user flows, business rules, and expected behaviors for every feature in V1. It is the reference document that all development agents read before writing any code.

A parallel document — `TECHNICAL_SPEC.md` — describes how the system is built internally.

---

## 2. Users and Roles

Agon has three distinct user types. Each has a different interface and a different set of permissions.

### 2.1 Studio Manager
The person who owns or manages the studio. They install the desktop application and are responsible for configuring and running it. They have full access to everything: schedule management, client management, financial reports, settings.

There is only one Studio Manager account per installation. This is intentional — the Studio Manager is the owner of the system.

### 2.2 Instructor
A staff member who teaches classes. Instructors have a limited view of the system: they can see their own schedule, view the roster for their classes, and mark attendance. They cannot access financial data, modify other instructors' schedules, or change system settings.

Instructors access the system via the same desktop application as the Studio Manager, but with a restricted interface after logging in with their own credentials.

### 2.3 Client
A person who attends classes at the studio. Clients interact exclusively through the mobile app. They never have access to the desktop application.

**V2 note:** Multi-location support will introduce a Studio Chain Manager role with visibility across multiple locations.

---

## 3. Onboarding

### 3.1 Studio Manager Onboarding

When a Studio Manager installs Agon for the first time, they are taken through a five-step setup wizard before accessing the main application.

**Step 1 — Studio Profile**
The Studio Manager enters the studio name, address, timezone, and uploads a logo. All fields except the logo are required. The timezone is used for all scheduling throughout the system.

**Step 2 — Account Creation**
The Studio Manager creates their personal admin account: full name, email address, and password. The password must be at least 12 characters. This is the only account with full system access.

**Step 3 — Connectivity Setup**
Agon automatically configures a Cloudflare Tunnel in the background. The Studio Manager sees a progress indicator and a plain-language status message. If configuration fails, the error is described in plain language with a link to the relevant documentation page. The Studio Manager does not need to know what a tunnel is.

At the end of this step, the studio has a unique public URL. This URL is displayed and can be copied, but the Studio Manager does not need to interact with it directly.

**Step 4 — Payment Setup**
The Studio Manager chooses how they handle payments:
- Connect a Stripe account (recommended for online payments)
- Handle payments manually (cash, bank transfer, or physical POS)

If they choose Stripe, a guided flow walks them through connecting their existing Stripe account or creating a new one. If they choose manual, they can connect Stripe later from the Settings screen.

**Step 5 — Backup Setup**
The Studio Manager chooses where automatic backups are saved:
- Google Drive (requires OAuth authorization)
- Dropbox (requires OAuth authorization)
- Local folder only (not recommended — displayed with a warning)

If they choose cloud backup, the OAuth flow opens and the connection is established before they proceed. If they skip cloud backup, a persistent banner appears in the main application until they configure it.

At the end of the wizard, the application generates a printed onboarding sheet: a QR code that clients can scan to download the mobile app, pre-configured to connect to this studio. The Studio Manager can print this sheet or save it as a PDF.

### 3.2 Client Onboarding

A client downloads the Agon mobile app from the App Store or Google Play. The app name in the stores is "Agon Studio".

On first launch, the client is prompted to scan the studio's QR code or enter a studio code manually. Once connected, they create an account with their name, email address, and password.

A client account is scoped to a single studio. If a client attends two studios that both use Agon, they have two separate accounts in two separate app configurations. Switching between studios is done via a studio selector in the app settings.

**V2 note:** Multi-location will allow a single client account to book classes across all locations of the same studio chain.

---

## 4. Class Management

### 4.1 Class Templates

Before scheduling classes, the Studio Manager defines class templates. A class template contains:
- Class name (e.g. "Vinyasa Flow", "HIIT", "Pilates Mat")
- Description
- Default duration in minutes
- Default capacity (maximum number of spots)
- Default instructor
- Color (used in the calendar view)

Templates are reusable. When scheduling a class, the Studio Manager selects a template and the fields are pre-filled. They can be overridden for any specific instance.

### 4.2 Scheduling Classes

Classes are scheduled from the calendar view. The Studio Manager can:
- Schedule a single class on a specific date and time
- Schedule a recurring class (daily, weekly, or custom days of the week) with a defined end date or indefinitely

When scheduling a recurring class, every instance is created individually in the database. This means individual instances can be modified or cancelled without affecting the rest of the series.

A class has the following states:
- **Scheduled** — visible to clients, bookings open
- **Cancelled** — visible to clients as cancelled, no new bookings accepted, existing bookings are automatically cancelled and clients are notified
- **Completed** — class has passed, attendance has been marked

### 4.3 Capacity and Waitlist

Each class has a maximum capacity. When a class is full, clients can join a waitlist. Waitlist positions are numbered and shown to the client.

When a client cancels their booking, the first person on the waitlist is automatically notified via push notification and has 30 minutes to confirm their spot. If they don't confirm within 30 minutes, the spot is offered to the next person on the waitlist. If nobody on the waitlist confirms, the spot becomes available for general booking again.

The 30-minute confirmation window is configurable by the Studio Manager in Settings.

### 4.4 Cancellation Policy

The Studio Manager defines a cancellation policy in Settings:
- Minimum hours before class start within which cancellations are not allowed (e.g. no cancellations within 2 hours of class start)
- Whether late cancellations consume a credit from the client's membership or not

If a client tries to cancel inside the cancellation window, the app displays the policy and asks them to confirm. If the policy deducts a credit, this is shown clearly before confirmation.

---

## 5. Booking

### 5.1 How Clients Book

From the mobile app, clients see a weekly calendar view of all scheduled classes. They can filter by class type or instructor. Tapping a class shows its details: description, instructor, duration, available spots, and their current membership status.

To book, the client taps "Book" and confirms. The booking is immediately confirmed if spots are available. If the class is full, the client is offered the option to join the waitlist.

A client cannot book the same class twice. A client cannot book a class if they have no valid membership or credits, unless the Studio Manager has enabled guest bookings.

### 5.2 Booking Rules

- A client can have at most one booking per class
- A client can cancel a booking up to the cancellation window defined in Settings
- A Studio Manager can book on behalf of a client from the desktop application
- A Studio Manager can remove a client from a class from the desktop application
- Guest bookings (without a membership) can be enabled or disabled globally in Settings

### 5.3 Booking Notifications

When a booking is confirmed, the client receives a push notification confirmation. 2 hours before the class (configurable in Settings), the client receives a reminder push notification. When a booking is cancelled — by the client or by the Studio Manager — the client receives a push notification.

---

## 6. Check-In

### 6.1 Check-In Methods

There are three ways for a client to check in to a class. All three require that the client has an active booking for that class on that day.

**App-based check-in**
The client opens the mobile app and taps "Check In" on their upcoming class. The app sends a check-in request to the studio server. The server validates the booking and returns a confirmation. The client sees a confirmation screen.

**QR code check-in**
The studio has a tablet or phone at reception running the Agon check-in screen. The client opens the mobile app, which displays a unique QR code for their upcoming class. The reception device scans the QR code. The server validates the booking and marks the client as checked in.

**Manual check-in**
From the desktop application, the Studio Manager or Instructor opens the class roster and marks a client as checked in manually. This is the fallback for any scenario where the other methods are unavailable.

### 6.2 Check-In Validation

Before confirming a check-in, the server checks:
1. The client has an active booking for this specific class
2. The check-in is within the allowed time window (configurable: default is 30 minutes before class start to 15 minutes after class start)
3. The client has a valid membership or credit

If any check fails, the check-in is rejected and the reason is shown clearly.

### 6.3 Check-In Window

The check-in time window is configurable per studio in Settings. The defaults are:
- Opens: 30 minutes before class start
- Closes: 15 minutes after class start

Outside this window, check-in is only possible via manual check-in from the desktop application.

---

## 7. Memberships and Subscriptions

### 7.1 Membership Types

The Studio Manager can create membership types from the desktop application. Each membership type has:

- Name (e.g. "Monthly Unlimited", "10-Class Pack", "Drop-In")
- Type: **Recurring subscription** or **Credit pack**
- For recurring subscriptions: billing interval (weekly, monthly, annual), price, and whether it allows unlimited classes or a fixed number per interval
- For credit packs: number of credits included, price, and expiry duration (e.g. credits expire 3 months after purchase)
- Which class types the membership applies to (all classes, or specific types only)
- Whether the membership can be paused and for how long

### 7.2 Assigning Memberships

A Studio Manager can assign a membership to a client from the client's profile in the desktop application. The client can also purchase a membership directly from the mobile app if the Studio Manager has enabled self-service purchases in Settings.

### 7.3 Membership Lifecycle

A recurring subscription renews automatically on the billing date. If payment fails, the Studio Manager is notified and the client's membership is flagged as payment overdue. The Studio Manager decides whether to suspend the client's booking ability while payment is overdue.

A credit pack membership is active from the date of purchase until the expiry date, or until all credits are consumed, whichever comes first.

When a membership expires or is cancelled, the client can no longer book classes until a new membership is assigned.

### 7.4 Pausing a Membership

If the membership type allows pausing, a client can request a pause from the mobile app. The Studio Manager approves or rejects the pause request from the desktop application. While paused, the membership expiry date is extended by the pause duration. Billing is suspended for the pause period.

**V2 note:** Multi-location memberships will allow a single membership to be valid across all locations of a studio chain.

---

## 8. Payments

### 8.1 Payment Model

Agon does not process payments. It integrates with the Studio Manager's own payment provider account. All money flows directly between the client and the studio. Agon is never in the middle of a transaction.

### 8.2 Stripe Integration

In V1, Stripe is the supported payment provider. The Studio Manager connects their own Stripe account during onboarding or from Settings. Stripe handles all card processing, recurring billing, and payment failure retries.

When a client purchases a membership from the mobile app, the payment is processed by Stripe directly. Agon receives a webhook confirmation from Stripe and activates the membership.

When a recurring subscription renews, Stripe handles the charge and sends a webhook. Agon updates the membership accordingly.

### 8.3 Manual Payments

If the Studio Manager handles payments outside of Agon (cash, bank transfer, physical POS), they can record manual payments from the client's profile in the desktop application. This does not involve Stripe.

### 8.4 Refunds

Refunds are initiated from the desktop application. For Stripe payments, the refund is processed via the Stripe API. For manual payments, the Studio Manager records the refund manually. Agon does not determine refund policy — that is up to the Studio Manager.

---

## 9. Notifications

### 9.1 Push Notifications

Push notifications are sent to clients via Expo Push Notifications. The studio server sends notifications directly to the Expo push service, which delivers them to client devices. No Agon infrastructure is involved in this process beyond the initial send request.

Notifications sent in V1:
- Booking confirmed
- Booking cancelled (by client or studio)
- Class reminder (configurable time before class, default 2 hours)
- Waitlist spot offered
- Waitlist spot confirmed
- Membership expiring soon (7 days before expiry)
- Membership payment failed

### 9.2 In-App Notifications

In addition to push notifications, clients see a notification inbox in the mobile app with the history of all notifications received.

### 9.3 Email Notifications

In V1, email notifications are not included. Push notifications cover the essential communication needs. Email support is planned for V2.

**V2 note:** Email notifications will be added for clients who have disabled push notifications or prefer email communication.

---

## 10. Client Management

### 10.1 Client Profiles

Each client has a profile visible to the Studio Manager in the desktop application. The profile contains:
- Personal information: name, email, phone number, date of birth (optional), profile photo (optional)
- Current membership status
- Booking history
- Attendance history (classes attended vs. booked)
- Payment history
- Notes (free text field, only visible to Studio Manager and Instructors)
- GDPR consent log

### 10.2 Client Search and Filtering

From the Clients section of the desktop application, the Studio Manager can search clients by name or email, and filter by membership status (active, expired, no membership).

### 10.3 Instructor Access to Client Data

Instructors can see the roster for their classes, including client names and check-in status. They cannot see client payment information, full booking history, or personal contact details beyond what is needed to run the class.

---

## 11. Instructor Management

### 11.1 Instructor Profiles

The Studio Manager creates instructor accounts from the desktop application. Each instructor has:
- Full name
- Email address (used as login)
- Profile photo (optional)
- Bio (displayed to clients in the mobile app)
- List of class types they are qualified to teach

### 11.2 Instructor Schedule

The Studio Manager assigns instructors to classes when scheduling. An instructor can see their own upcoming schedule from the desktop application. They can also see the roster for each of their classes.

### 11.3 Substitute Instructors

When a Studio Manager needs to assign a substitute instructor to a class, they can change the instructor from the class detail view. Clients who have booked the class are notified of the change via push notification.

---

## 12. Reporting

### 12.1 Reports Available in V1

**Attendance Report**
Shows attendance per class over a selected date range. Includes number of bookings, number of check-ins, and no-show rate.

**Revenue Report**
Shows revenue over a selected date range, broken down by membership type. Only shows revenue recorded in Agon — manual payments and Stripe payments both included.

**Membership Report**
Shows active memberships by type, new memberships in a date range, and expired memberships.

**Client Retention Report**
Shows clients who have not attended a class in the last 30 days (configurable). Useful for re-engagement.

### 12.2 Export

All reports can be exported as CSV. This is sufficient for V1.

**V2 note:** PDF export and more advanced analytics (revenue forecasting, class popularity trends) are planned for V2.

---

## 13. GDPR Tools

### 13.1 Data Export

A client can request a full export of their personal data from the mobile app. The request is sent to the studio server, which generates a JSON file containing all data held about that client. The file is sent to the client's registered email address within 24 hours of the request.

The Studio Manager can also trigger a data export for any client from the desktop application.

### 13.2 Account Deletion

A client can request account deletion from the mobile app. Account deletion anonymizes all personal data associated with the client. Their booking and attendance history is retained in anonymized form for statistical purposes — only the personal identifiers (name, email, phone) are removed.

Financial records (invoices, payment history) are retained for the legally required period regardless of deletion request. This is explained clearly to the client before they confirm deletion.

### 13.3 Consent Log

Every time a client accepts the privacy policy or terms of service, the event is logged with a timestamp and the version of the document they accepted. This log is visible to the Studio Manager in the client's profile and is included in the data export.

### 13.4 Privacy Policy Template

Agon provides a template privacy policy that Studio Managers must customize with their studio's details before going live. The template is available in the onboarding wizard and in Settings. Agon is not responsible for the legal adequacy of the Studio Manager's privacy policy — the template is provided as a starting point only.

---

## 14. Settings

### 14.1 Studio Settings
- Studio name, address, timezone, logo
- Cancellation policy (minimum hours, credit deduction on late cancellation)
- Check-in window (minutes before and after class start)
- Waitlist confirmation window (minutes to confirm a waitlist spot)
- Guest bookings (enabled/disabled)
- Self-service membership purchases (enabled/disabled)
- Notification timing (hours before class for reminder notification)

### 14.2 Payment Settings
- Connected payment provider (Stripe)
- Stripe account details (read-only display)
- Disconnect and reconnect Stripe

### 14.3 Backup Settings
- Connected cloud backup provider (Google Drive / Dropbox)
- Last backup timestamp
- Manual backup trigger
- Disconnect and reconnect cloud backup

### 14.4 Connectivity Settings
- Current tunnel URL (read-only display)
- Tunnel status indicator (active / inactive)
- Restart tunnel button

### 14.5 Account Settings
- Studio Manager personal information
- Password change
- Two-factor authentication (optional, V1)

---

## 15. AI Support Agent

### 15.1 What It Does

The AI support agent is a conversational interface embedded in the bottom-right corner of the desktop application. It is available from the moment the software is installed.

It answers questions about Agon in natural language. It knows the complete Agon documentation and can guide the Studio Manager through any feature or configuration step. It responds in the language the Studio Manager writes in.

### 15.2 What It Does Not Do

The AI support agent does not make changes to the studio's data. It cannot book a class, modify a membership, or change settings on behalf of the user. It answers questions and provides guidance only.

### 15.3 How It Works

The agent is powered by an LLM with the Agon documentation as its knowledge base. The documentation is kept in sync with the software — the documentation agent ensures that every feature has a corresponding documentation page, which the support agent can reference.

---

## 16. Error Handling and Edge Cases

### 16.1 Server Offline

If the studio's server is offline when a client tries to use the mobile app:
- The app displays the last cached schedule with a timestamp
- Bookings made while offline are queued and sent when connectivity is restored
- A clear banner informs the client that they are viewing cached data

### 16.2 Double Booking Prevention

When two clients attempt to book the last available spot in a class simultaneously, the server uses optimistic locking to ensure only one booking succeeds. The second client is informed that the class is now full and offered the waitlist.

### 16.3 Payment Webhook Failure

If a Stripe webhook fails to reach the studio's server (e.g. the server was offline), Stripe retries the webhook automatically for up to 72 hours. If the webhook is never delivered, the Studio Manager receives an alert in the desktop application to manually verify the payment status in their Stripe dashboard.

### 16.4 Tunnel Interruption

If the Cloudflare Tunnel connection drops, the desktop application detects this and automatically attempts to re-establish the connection. The Studio Manager sees a status indicator in the top bar of the application. If the tunnel cannot be re-established within 5 minutes, a notification prompts them to check their internet connection.

---

## 17. V2 Forward-Looking Notes (Summary)

The following features are explicitly out of scope for V1 but are planned for V2. They are listed here so that V1 architecture decisions account for them.

**Multi-location support**
A Studio Chain Manager role with visibility across all locations. Clients with a single account able to book across locations. Memberships valid at multiple locations. The database schema already includes `location_id` on all relevant tables to support this without schema migration.

**Email notifications**
Full email notification system as a complement to push notifications.

**Advanced reporting**
PDF export, revenue forecasting, class popularity trends, client lifetime value.

**Additional payment providers**
GoCardless (SEPA direct debit, strong for European markets), Satispay (Italian market), PayPal.

**Multi-language client app**
V1 supports Italian and English. V2 will expand to French, Spanish, German, and Portuguese as a minimum.

**Instructor mobile app**
A lightweight mobile view for instructors to see their schedule and manage check-ins from their phone without needing access to the full desktop application.

---

*This document describes what Agon does. For how it is built, see `TECHNICAL_SPEC.md`.*

---

## 17. Migration from Another Platform

### 17.1 Philosophy

Migrating from an existing platform to Agon is a process, not a button. Most fitness SaaS platforms do not offer a clean self-service data export. Some offer partial exports, others require a formal request to their support team, and some make the process deliberately difficult to reduce churn.

Agon does not work around this by asking studio managers for their credentials to the old platform and scraping data on their behalf. That approach creates legal risk (most SaaS ToS prohibit automated credential-based access), security concerns (Agon should never handle third-party credentials), and technical fragility (platform UIs change without notice).

Instead, Agon provides an AI migration assistant that guides the studio manager through obtaining their own data from the old platform and importing it into Agon.

### 17.2 The Migration Assistant

The migration assistant is available inside the onboarding wizard and as a standalone entry point from Settings after initial setup.

**Phase 1 — Data retrieval guidance**

The assistant asks which platform the studio is migrating from. Based on the answer, it provides step-by-step instructions for requesting a data export. This includes:

- Where to find the export function in the platform's UI, if one exists
- A template email to send to the platform's support team requesting a GDPR data portability export, which they are legally obligated to fulfil
- What to expect in terms of format and timeline
- Which data to prioritise (clients first, then active memberships, then scheduled classes)

Instructions are maintained as documentation pages and kept up to date by the community as platforms change.

**Phase 2 — File analysis and mapping**

The studio manager uploads the files received from the old platform — CSV, Excel, JSON, or any other format. The AI assistant analyses the file structure, identifies columns, and maps them to Agon's data model. It shows a preview of what will be imported and asks for confirmation before proceeding.

If the mapping is ambiguous (e.g. a column could be a phone number or a client ID), the assistant asks the studio manager to clarify.

**Phase 3 — Import and verification**

After confirmation, the assistant imports the data and shows a summary:
- Number of clients imported
- Number of active memberships imported
- Number of scheduled classes imported
- Number of records skipped and why (missing required fields, duplicate emails)

For skipped records, the assistant explains what is missing and offers options: skip permanently, fill in manually, or retry after editing the source file.

**Phase 4 — Client invitation**

Client passwords cannot be migrated — they are hashed by the old platform and never exported. After import, the assistant generates invitation emails for all imported clients. Each email contains a personal link for the client to create their Agon account, where they will find their membership and booking history already loaded.

The studio manager can send invitations directly from the assistant or download them as a CSV to send through their own email tool.

### 17.3 Data Priority

The assistant guides the studio manager in this order:

1. **Client profiles** (name, email, phone) — critical, without this everything else is lost
2. **Active memberships** (type, expiry, credits remaining) — critical, determines who can book
3. **Upcoming scheduled classes** — important, avoids disruption in the first weeks
4. **Historical attendance and payments** — useful but not blocking, can be kept as archive in the old system

### 17.4 Standard Import Format

For studio managers who want to prepare data manually or whose old platform provides a non-standard export, Agon publishes a standard CSV template for each data type (clients, memberships, classes). Templates are available in the documentation and downloadable from the migration assistant.

### 17.5 Legal Note

Under GDPR Article 20 (Right to Data Portability), every studio manager has the legal right to receive their data in a structured, commonly used, machine-readable format. If a platform refuses or delays a legitimate data portability request, the studio manager can escalate to their national data protection authority. The migration assistant documentation includes guidance on this process.
