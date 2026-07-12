---
title: Appointments
sidebar_label: Appointments
---

# Appointments

This page explains how to set up bookable appointment services, define instructor availability, and book, manage, and cancel 1-on-1 appointments from the desktop app.

**Navigation label — Appointments:**
EN: Appointments · IT: Appuntamenti · FR: Rendez-vous · DE: Termine · ES: Citas · PT: Compromissos · NL: Afspraken

---

## Before you start

Appointments are Agon's system for 1-on-1 bookings — personal training, massage, private coaching, or any service where one client meets one instructor — as distinct from group **classes**. Go to **Appointments** in the left sidebar to get started. The page has three tabs:

- **Upcoming** — available to managers and instructors. Lists all appointments and lets staff cancel, complete, or mark a no-show.
- **Services** — manager-only. Define the types of appointment clients can book.
- **Availability** — available to managers (for any instructor) and instructors (for themselves only).

Before a client or manager can book an appointment, you need at least one active **appointment service** and at least one **availability window** set for the instructor who will deliver it.

Booking an appointment uses the same **membership credit** system as booking a class — a client needs an active membership with an available credit. There is no separate pricing or payment flow for appointments in this release.

---

## Setting up appointment services

An appointment service is a bookable service type — for example "Personal Training" or "60-Minute Massage" — with a fixed duration and an optional buffer time.

1. Go to **Appointments** → **Services**.
2. Click **New Service**.
3. Fill in the details:
   - **Name** — e.g. "Personal Training"
   - **Description** — optional, describes what the service includes
   - **Duration (min)** — how long each appointment of this type runs
   - **Buffer time (min)** — a gap enforced after each appointment before another one can start for the same instructor (e.g. to allow room turnover or a short break). Leave at 0 for no gap.
4. Click **Save**.

The new service appears in the list as **Active** and immediately becomes bookable.

### Editing a service

Click any service row to open it, change the details, and save. Existing appointments already booked against this service keep their original duration and buffer — only future bookings use the updated values.

### Deactivating a service

1. Find the service in the list.
2. Click **Deactivate**.
3. Confirm.

Deactivating is a soft delete: the service stops appearing for new bookings, but nothing is deleted — all existing appointments booked against it are kept in full. There is no hard-delete option.

---

## Setting instructor availability

Availability defines the weekly time windows during which an instructor can be booked for appointments. Available time slots shown to a client or manager during booking are computed from these windows, minus the instructor's existing confirmed appointments and the buffer time of the service being booked.

1. Go to **Appointments** → **Availability**.
2. If you're a manager, select the instructor from the dropdown at the top. If you're an instructor, this tab is automatically scoped to your own schedule.
3. For any day of the week, set a **Start time** and **End time** and click **Add window**.
4. Repeat for as many days and windows as needed. An instructor can have more than one window on the same day (e.g. a morning window and a separate evening window).

To remove a window, click the **×** next to it.

**A manager can manage any instructor's availability. An instructor can only manage their own** — this mirrors the same restriction the backend enforces on every request.

### A current limitation: no date-specific exceptions

Availability is **weekly-recurring only**. Agon does not yet support one-off exceptions or holiday overrides — for example, you cannot mark a specific instructor as unavailable on a single upcoming date while keeping their regular weekly schedule intact. If an instructor is going to be away, you need to remove the relevant recurring window and re-add it afterwards, or coordinate manually with the instructor to avoid new bookings landing on that date. This is a genuine gap, not a hidden setting — it's on the roadmap but not available today.

---

## Booking an appointment

A manager or instructor can book an appointment on behalf of a client from the desktop app.

1. Go to **Appointments** → **Upcoming**.
2. Click **New Appointment**.
3. Select a **Service**.
4. Select an **Instructor**.
5. Pick a **Date**.
6. Choose one of the **available time slots** shown. Slots are calculated from the instructor's availability for that weekday, minus any of their existing confirmed appointments and the service's buffer time — if nothing is shown, there are no valid slots for that combination on that date.
7. Search for and select the **Client** this appointment is for.
8. Optionally add **Notes**.
9. Click **Confirm Booking**.

The appointment is created with status **Confirmed**, and one credit is deducted from the client's active membership — exactly as it would be for a class booking.

**A manager or instructor can book on behalf of any client. A client booking from their own account can only book for themselves** — the mobile app enforces this by not exposing a client-selection field at all.

---

## Managing upcoming appointments

The **Upcoming** tab lists appointments as an agenda-style table: date & time, service, instructor, client, and status. Use the **instructor** and **status** filters, and the **Upcoming only** toggle, to narrow the list.

### Cancelling an appointment

1. Find the appointment and click **Cancel**.
2. Confirm in the dialog.

Cancelling an appointment follows the same cancellation policy as cancelling a class booking (see [Settings — cancellation policy](settings)):

- Cancelled **before** the studio's configured cancellation window: the client's credit is refunded.
- Cancelled **inside** the cancellation window by the **client themselves** (a late cancellation): the credit is refunded unless your studio's **Late cancellation deducts credit** setting is on, in which case it's kept — and if a **Late cancellation fee** is configured, it's charged.
- Cancelled by a **manager or instructor** — even inside the cancellation window — is never treated as a late cancellation. The credit is refunded and no fee is charged, since the late-cancellation policy is meant to apply to the client's own decision to cancel late, not to a staff-initiated cancellation.

### Marking an appointment completed or a no-show

Once an appointment's start time has passed, staff can update its outcome:

- Click **Complete** to mark the client attended.
- Click **No-show** to mark the client didn't attend. If a **No-show fee** is configured in Settings, it's charged automatically — the same mechanism used for class no-shows.

Only a confirmed appointment can be marked complete, no-show, or cancelled. Once an appointment has moved to any other status, these actions are no longer available for it.

---

## What if something goes wrong?

**"This service is not currently offered" when booking**
The appointment service was deactivated after the client or manager started the booking flow. Refresh the Services tab, reactivate the service if it should still be bookable, or pick an active one.

**"This instructor is not currently active" when booking**
The instructor's user account has been deactivated. Reactivate the instructor's account, or choose a different instructor.

**No available time slots show up for a service/instructor/date combination**
This usually means one of: the instructor has no availability window set for that weekday, the whole day is already booked out once buffer time is accounted for, or the date is in the past. Check the **Availability** tab for that instructor and that weekday.

**"Requested time is outside the instructor's availability"**
The requested start and end time don't fit entirely inside one of the instructor's active availability windows for that weekday. This can happen if availability was edited or removed after slots were first shown. Refresh and re-pick a slot.

**"This time slot conflicts with another appointment"**
Another appointment was booked for that instructor in the meantime (or the requested slot doesn't leave enough room for the service's buffer time before/after a neighboring appointment). Refresh the available slots and pick another one.

**A client can't be booked because they have no valid membership or credits**
Appointments use the same membership credit as classes. Check the client's membership in their profile — they need an active membership with at least one available credit.

**I need to change an instructor's availability but they already have appointments booked**
Removing an availability window does not cancel appointments that were already booked inside it — those remain confirmed. It only prevents new bookings for windows that no longer exist.

## Related pages

- [Client booking of an appointment](../clients/appointments)
- [Settings — cancellation policy](settings)
- [Classes](classes)
- [Memberships](memberships)
