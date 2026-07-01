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

A specific occurrence of a class template on a specific date and time, at a specific location, with a confirmed instructor and capacity. Clients book scheduled classes, not templates.

> **Not:** class session, event, appointment, slot.

---

## Booking

A client's confirmed reservation for a specific scheduled class. A booking deducts one credit from the client's active membership (if applicable) and grants the client access to check in.

> **Not:** reservation, appointment, registration, sign-up.

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

A configuration that maps an Agon event (e.g. "new client invited", "booking confirmed") to a specific email template. When the event occurs, the assigned template is sent automatically.

---

## Migration Assistant

The built-in tool for importing client data and booking history from other fitness management platforms (CSV export, BSport, Momence). Accessed from Settings → Import Data.
