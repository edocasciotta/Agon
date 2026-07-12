---
title: Glossary
sidebar_label: Glossary
---

# Glossary

This page defines the canonical terms used throughout Agon and its documentation. When in doubt, use these exact terms — not synonyms.

---

## Studio Manager

The owner or administrator of an Agon installation. The studio manager creates classes, manages clients and instructors, configures memberships, and has full access to all settings and reports.

> **Not:** admin, owner, operator.

---

## Client

A person who attends classes at the studio. Clients use the Agon mobile app to browse the schedule, book classes, and check in.

> **Not:** member, student, user, customer.

---

## Instructor

A staff member who teaches classes. Instructors are separate from studio managers — they can see the class schedule and roster but cannot change studio settings or access financial data.

> **Not:** teacher, coach, trainer, staff member.

---

## Class Template

A reusable definition of a class type — its name, default duration, default capacity, and associated instructor. Think of it as the "type" of class, not a specific occurrence.

*Example: "Yoga Flow" is a class template. Every Tuesday at 9 am is a separate **scheduled class** based on that template.*

> **Not:** class type, class definition, activity.

---

## Scheduled Class

A specific occurrence of a class template on a specific date and time, at a specific location, with a confirmed instructor and capacity. Clients book scheduled classes, not templates. A scheduled class is a group activity with shared capacity — see **Appointment** for the 1-on-1 equivalent.

> **Not:** class session, event, slot.

---

## Booking

A client's confirmed reservation for a specific scheduled class. A booking deducts one credit from the client's active membership (if applicable) and grants the client access to check in.

> **Not:** reservation, registration, sign-up.

---

## Appointment

A client's confirmed 1-on-1 booking with a specific instructor for a specific appointment service (for example, personal training, massage, or private coaching) at a specific date and time. Unlike a scheduled class, an appointment has exactly one client and no shared capacity. Booking an appointment deducts one credit from the client's active membership, the same mechanism as booking a class — there is no separate payment path for appointments. A studio manager or instructor can mark a confirmed appointment as completed or a no-show afterwards, and the same late-cancellation-fee / no-show-fee policy as class bookings applies.

> **Not:** session, private lesson, 1-on-1 session, reservation, class.

---

## Appointment Service

A studio manager-defined type of appointment that clients can book (for example, "Personal Training" or "60-Minute Massage"), with a fixed **duration** and an optional **buffer time** — a gap enforced after each appointment before the next one for the same instructor can start. Deactivating a service is a soft delete: it stops appearing for new bookings, but appointment history that references it is preserved. There is no hard-delete option.

> **Not:** service type, session type, treatment.

---

## Instructor Availability

The recurring weekly time windows during which an instructor can be booked for appointments (for example, "Tuesdays 09:00–13:00"). Availability is **weekly-recurring only** — Agon does not yet support date-specific exceptions or holiday overrides. Available appointment time slots are computed from these windows, minus the instructor's existing confirmed appointments and the buffer time of the service being booked.

> **Not:** working hours, schedule, shift.

---

## Waitlist

If a scheduled class is full, clients can join the waitlist. When a booking is cancelled, the first client on the waitlist is automatically promoted to a confirmed booking and notified.

---

## Check-in

Confirmation that a client physically attended a class. Check-in can be done by the client (via QR code in the mobile app), by the instructor (scanning the client's code), or manually by the studio manager.

> **Not:** sign-in, attendance, clock-in.

---

## Membership

A package that gives a client access to classes over a period of time. There are two types:

- **Recurring membership** — active for a set number of days (e.g. 30 days) and renewed automatically via Stripe.
- **Credit pack** — a fixed number of credits consumed one-per-booking, with no time limit.

> **Not:** subscription, plan, package, pass.

---

## Credit

A single unit of access to one class, included in a credit-pack membership. Each booking deducts one credit. Credits do not expire unless the membership itself has an expiry date.

> **Not:** token, point, session credit, class pass.

---

## Rollover Credit

An unused credit that carries over into a client's next billing period instead of being lost, when a recurring membership type has credit rollover enabled. A membership type can optionally cap how many credits can roll over per period.

> **Not:** carryover credit, banked credit.

---

## Intro Offer

A discounted first-purchase price and/or validity window on a membership type, shown automatically to a client the first time they buy that membership type (or any other intro-offer membership type at the same studio). Regular pricing applies to all later purchases.

> **Not:** trial offer, welcome discount, first-time discount.

---

## Late Cancellation Fee / No-Show Fee

A charge recorded against a client when they cancel a booking inside the cancellation window (a late cancellation, only if "cancellation deducts credit" is enabled) or are marked as a no-show at check-in. Resolved per client as: the client's membership type override, then the studio-wide default, then no fee. Recorded as a `Payment` row rather than an automatic card charge — the studio still has to collect it through its own process.

> **Not:** penalty, cancellation charge (as a distinct concept from the fee itself).

---

## Promo Code

A code a client enters at membership checkout to receive a percentage or fixed-amount discount. Configured by the studio manager with an optional usage limit, a one-per-client restriction, and a validity window.

> **Not:** discount code, coupon.

---

## Gift Card

A prepaid balance identified by a code (format `GC-XXXXXXXX`) that a client can redeem against a membership purchase, or that a studio manager issues manually for a phone/in-person sale. A client can also buy a gift card themselves as a present for someone else.

> **Not:** voucher, credit note.

---

## Tag

A short, colored label a studio manager attaches to a client to organize and filter the client list (e.g. "VIP", "Injury risk"). Tags can be assigned manually or automatically via an auto-tag rule. Clients see their own tags read-only in the mobile app.

> **Not:** label (as a distinct concept), category.

---

## Auto-Tag Rule

A rule that automatically assigns a tag to a client whenever a chosen trigger event happens for them (for example, a no-show or a cancelled booking). Configured by the studio manager; runs automatically with no manual action needed once created.

---

## Waiver

A document (for example, a liability release or studio policy) that a studio manager authors and can require clients to digitally sign before booking. Editing a waiver's body creates a new version and requires every client to re-sign, even those who signed an earlier version. Signing is always client-self — there is no way for a studio manager or instructor to sign on a client's behalf.

> **Not:** consent form (use only when referring to the separate GDPR consent log), release, agreement.

---

## Calendar Sync Token

A long-lived secret embedded in a client's personal calendar feed URL, used because calendar apps (Google, Apple, Outlook) poll a static URL and cannot perform an app login. The token in the URL is itself the credential. A client or studio manager can regenerate it, which invalidates the old link and requires re-subscribing.

---

## Location

A physical place where classes are held. In V1, Agon supports one location. Multi-location support is planned for V2. The `location_id` field is already in the database schema.

> **Not:** branch, venue, studio (use "studio" only to refer to the whole business, not a specific room or building).

---

## Tunnel

A secure public HTTPS URL created via Cloudflare Tunnel that allows your clients to connect the mobile app to your Agon instance from anywhere, without exposing your local network.

> **Not:** URL, connection, link, proxy.

---

## Studio QR Code

A QR code shown in Settings → Connectivity that encodes the Tunnel URL. Clients scan this code once when setting up the mobile app to connect to your studio.

---

## Invitation Token

A time-limited token sent by email to a newly created client. The client follows the link to set their password and activate their account. Expires after 7 days.

---

## Reset Token

A time-limited token sent by email when a client requests a password reset. Expires after 2 hours.

---

## Smart List

A saved filter that identifies a subset of clients based on membership status, booking recency, join date, or membership type. Used to send targeted emails.

---

## Event Assignment

A configuration that maps an Agon event (e.g. "new client invited", "booking confirmed") to a specific email or SMS template. When the event occurs, the assigned template is sent automatically — provided that event is actually wired to send messages (currently only "new client invited" and "password reset" trigger a send, for both email and SMS).

---

## Migration Assistant

The built-in tool for importing client data and booking history from other fitness management platforms (CSV export, BSport, Momence). Accessed from Settings → Import Data.
