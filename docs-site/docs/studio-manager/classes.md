---
title: Managing Classes
sidebar_label: Classes
---

# Managing classes

This page explains how to create class templates, schedule classes on your calendar, manage the roster, and cancel classes when needed.

## How class scheduling works

Agon uses a two-step system:

1. **Class templates** — define a reusable class type (e.g. "Vinyasa Flow") with its default settings
2. **Scheduled classes** — place that template on your calendar on specific dates and times

This means you set up each class type once, then schedule as many instances as you need without re-entering all the details each time.

---

## Creating a class template

Before you can schedule a class, you need a template for it.

1. Go to **Classes → Templates** in the left sidebar.
2. Click **New template**.
3. Fill in the template details:
   - **Name** — the class name your clients will see (e.g. "Pilates Mat", "HIIT", "Vinyasa Flow")
   - **Description** — a short description shown to clients in the mobile app
   - **Duration** — how long the class runs, in minutes (e.g. 60)
   - **Default capacity** — maximum number of spots available (you can override this per session)
   - **Default instructor** — pre-selects an instructor when scheduling; can be changed per session
   - **Colour** — choose a colour for this class type on the calendar view
4. Click **Save template**.

The template is now available to use when scheduling classes.

### Editing a template

Go to **Classes → Templates**, find the template, and click **Edit**. Changes to a template only affect future classes you schedule from it — they do not update existing scheduled classes.

### Deactivating a template

If you no longer run a particular class type, click **Deactivate** on the template. It will no longer appear in the list when scheduling new classes. Existing scheduled classes are not affected.

---

## Scheduling a single class

1. Go to the **Calendar** view.
2. Click on the date and time where you want to schedule the class, or click the **+ New class** button.
3. Select a **class template** from the dropdown. The fields are pre-filled from the template.
4. Adjust any details for this specific session:
   - **Date and time** — set the exact start time
   - **Capacity** — override the default if needed (e.g. if the studio is smaller that day)
   - **Instructor** — change the instructor for this session
   - **Notes** — internal notes visible only to you and instructors (not shown to clients)
5. Click **Schedule class**.

The class immediately appears on the calendar and becomes visible and bookable to your clients in the mobile app.

---

## Scheduling a recurring class

If you run the same class regularly — for example, every Monday and Wednesday at 7:00 PM — you can schedule all sessions at once.

1. Click **+ New class** on the calendar.
2. Select a class template and set the time and instructor as usual.
3. Toggle on **Recurring class**.
4. Choose the **days of the week** the class runs (e.g. Monday, Wednesday).
5. Set the end condition:
   - **End date** — the last date to schedule classes up to
   - **Number of occurrences** — e.g. schedule the next 12 sessions
6. Review the preview showing all sessions that will be created.
7. Click **Schedule recurring classes**.

Each session is created individually in the database. This means you can later edit or cancel any single session without affecting the rest of the series.

---

## Editing a scheduled class

1. Click on the class in the **Calendar** view.
2. Click **Edit class**.
3. You can change the **capacity**, **instructor**, **start time**, and **notes** for this specific session.
4. Click **Save changes**.

Editing a class does not affect other sessions in the same recurring series.

---

## Cancelling a class

If you need to cancel a class (the instructor is ill, the studio is closed, etc.):

1. Click on the class in the **Calendar** view.
2. Click **Cancel class**.
3. Confirm by clicking **Yes, cancel this class**.

**What happens immediately:**
- The class status changes to **Cancelled**
- Every client who had a booking for this class has their booking automatically cancelled
- Credits that were deducted for those bookings are refunded to each client's membership
- Every affected client receives a push notification: *"[Class name] on [date] has been cancelled."*
- The waitlist for the class is cleared

Cancelled classes remain visible on the calendar (shown in grey) so you have a complete record.

---

## Viewing the class roster

To see who has booked a class:

1. Click on the class in the **Calendar** view.
2. Click **View roster**.

The roster shows:
- Each client's name and booking status (**Confirmed** or **Cancelled**)
- Check-in status (**Checked in** or not yet checked in)
- Their membership type

From the roster, you can also [check in a client manually](check-in).

---

## Marking a class as completed

After a class has finished, you can mark it as completed to finalise the attendance record.

1. Click on the class in the **Calendar** view.
2. Click **Mark as completed**.

Completed classes are shown with a checkmark on the calendar. Classes that have passed but haven't been marked completed are shown as past scheduled classes until you mark them.

---

## What if something goes wrong?

**I scheduled a class at the wrong time**
Click on the class in the calendar and click **Edit class**. Change the time and save.

**I cancelled a class by mistake**
Cancellation cannot be undone. If the class should still happen, schedule a new class with the same template and time.

**Clients are not seeing a new class in the app**
Check that the class status is **Scheduled** (not Cancelled or Completed). Also make sure the class date is in the future — past classes are not shown to clients.

**I need to change the instructor for all future sessions in a recurring series**
At the moment, each session must be edited individually. Click each session in the calendar and update the instructor. A bulk edit feature is planned for a future version.

## Related pages

- [Check-in](check-in)
- [Settings — cancellation policy](settings)
- [Client booking flow](../clients/booking-a-class)
