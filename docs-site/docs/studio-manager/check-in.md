---
title: Client Check-In
sidebar_label: Check-In
---

# Client check-in

This page explains the three ways to check in a client when they arrive for a class, how the check-in window works, and how to view the check-in roster.

---

## Before you start

A client can only check in if they have a **confirmed booking** for that class. Without a booking, check-in will be rejected. If you need to add a client to a class at the door, book them manually from the class roster first (see [Managing Classes](classes)).

---

## The three check-in methods

### Method 1 — App check-in (client self-checks)

The client opens the Agon mobile app and taps **Check In** on their upcoming class. The app sends the check-in request to your studio server. If the booking is valid and the check-in window is open, the client sees a confirmation screen immediately.

This is the simplest method and requires no action from staff.

### Method 2 — QR code check-in

The client opens the Agon mobile app and navigates to their upcoming booking. The app displays a unique QR code for that booking. A staff member or a self-service kiosk scans the QR code.

To scan a QR code at reception:
1. Go to **Calendar** and open the class.
2. Click **Check-in mode**.
3. Your device's camera activates and waits for a QR code.
4. The client holds their phone screen in front of the camera.
5. The check-in is confirmed and the client's name appears on screen.

This method works well at a busy reception desk or as a kiosk on a tablet.

### Method 3 — Manual check-in

If a client doesn't have their phone, or if the other methods are not working, you can mark them as checked in manually.

1. Go to **Calendar** and click the class.
2. Click **View roster**.
3. Find the client in the list.
4. Click **Check in** next to their name.

Instructors can also check in clients manually from their class roster view.

---

## The check-in window

Check-in is only available within a specific time window around the class start time. The defaults are:

- **Opens:** 30 minutes before class start
- **Closes:** 15 minutes after class start

For example, for a class starting at 10:00 AM, the check-in window is open from 9:30 AM to 10:15 AM.

Outside this window, app check-in and QR check-in are rejected. Manual check-in from the desktop app works at any time.

You can adjust the check-in window in [Settings](settings) under **Check-in window**.

---

## What happens when a client checks in

When a check-in is validated, the server confirms:
1. The client has a confirmed booking for this class
2. The current time is within the check-in window
3. The client has a valid membership

If all three checks pass, the check-in is recorded and the client's status on the roster changes to **Checked in**.

If a check fails, the client receives a clear message explaining why:
- **Outside check-in window** — "Check-in opens at [time]" or "Check-in has closed for this class"
- **No valid booking** — "You don't have a booking for this class"
- **No valid membership** — "Your membership has expired"

---

## Viewing the check-in roster

To see who has checked in during or after a class:

1. Click on the class in the **Calendar**.
2. Click **View roster**.

The roster shows all clients with bookings and their check-in status. You can see:
- **Checked in** — arrived and confirmed
- **Confirmed** (not yet checked in) — booked but not yet arrived
- **No-show** — did not attend (this can be set manually for reporting purposes)

---

## What if something goes wrong?

**A client's app check-in is rejected**
Check that their booking status is **Confirmed** (not Cancelled) in the roster. Also check the time — the check-in window may not have opened yet or may have closed. Use manual check-in as a fallback.

**The QR code scanner isn't working**
Make sure you are in **Check-in mode** in the class view. If the camera doesn't activate, check that the Agon app has camera permission on your device (go to your device's Settings → Agon → Camera). Use manual check-in as a fallback.

**A client arrived but I forgot to check them in**
Use manual check-in from the class roster at any time — it works outside the check-in window.

**A client says they checked in but the roster doesn't show it**
This may be a sync issue. Refresh the roster view. If it still doesn't appear, check in the client manually — duplicate check-ins are ignored.

## Related pages

- [Managing Classes](classes)
- [Settings — check-in window](settings)
- [Client check-in guide](../clients/check-in)
