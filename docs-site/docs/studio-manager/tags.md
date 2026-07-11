---
title: Tags
sidebar_label: Tags
---

# Tags

This page explains how to create client tags, assign them manually, and set up auto-tag rules that assign tags automatically when something happens.

**Navigation label — Tags:**
EN: Tags · IT: Etichette · FR: Étiquettes · DE: Tags · ES: Etiquetas · PT: Etiquetas · NL: Labels

---

## Before you start

Tags are manager-only: you create tags, assign them, and set up auto-tag rules from the desktop backoffice. Clients cannot see or edit their own tags anywhere; the mobile app shows a client's tags **read-only** on their own profile.

---

## Overview

A **tag** is a short, colored label you attach to a client — for example "VIP", "Injury risk", or "Trial". Tags help you filter and recognize clients at a glance. There are two ways a tag ends up on a client:

- **Manual** — a manager assigns it directly from the client's profile.
- **Automatic** — an **auto-tag rule** assigns it whenever a chosen event happens (for example, tagging a client "At risk" every time they no-show a class).

---

## Creating a tag

1. Go to **Tags** in the left sidebar.
2. Make sure the **Tags** tab is selected.
3. Click **Create Tag**.
4. Enter a **Name** and pick a **Color**. A live preview shows how the tag will look.
5. Click **Create**.

### Editing or deleting a tag

- Click a tag row, then **Edit** to change its name or color.
- Click **Delete** to remove a tag entirely. This removes the tag from every client it's currently assigned to, and deletes any auto-tag rules that use it — this action cannot be undone.

---

## Assigning a tag to a client manually

1. Go to **Clients** and open the client's profile.
2. Find the **Tags** section.
3. Select a tag to assign it.

To remove a manually- or automatically-assigned tag from a client, use the remove action next to the tag on their profile.

---

## Auto-tag rules

An auto-tag rule automatically assigns a tag to a client the moment a specific event happens for them. This runs entirely server-side — you don't need to do anything once the rule exists.

### Creating a rule

1. Go to **Tags** in the left sidebar.
2. Switch to the **Auto-Tag Rules** tab.
3. Click **Create Rule**.
4. Choose:
   - **Tag** — which tag to assign
   - **Trigger Event** — the event that fires the rule
   - **Active** — whether the rule is currently enabled
5. Click **Create**.

**Available trigger events:**

| Event | EN label |
|---|---|
| `booking_created` | Booking created |
| `booking_cancelled` | Booking cancelled |
| `membership_purchased` | Membership purchased |
| `membership_expired` | Membership expired |
| `no_show` | No-show |
| `checkin` | Check-in |

When a matching event occurs for a client (for example, a manager marks a booking as a no-show), every active rule for that event type is evaluated and the tag is assigned automatically. If the client already has the tag, nothing changes — a client is never tagged twice for the same tag.

### Editing or deleting a rule

Click a rule row to edit its tag, trigger event, or active status. Deleting a rule stops future auto-tagging for that event — it does not remove the tag from clients who were already tagged by it.

---

## Viewing tags on mobile

Clients see their own tags listed read-only on their **Profile** screen in the mobile app. There is no way for a client to add, remove, or edit a tag from the mobile app — tagging is manager-only.

---

## What if something goes wrong?

**A client was tagged automatically and I don't know why**
Check the **Auto-Tag Rules** tab for any active rule matching an event the client recently triggered (for example, a recent no-show or cancellation).

**I deleted a tag by mistake**
Tag deletion cannot be undone. Re-create the tag with the same name and color, then re-assign it manually to the clients who need it.

**A rule isn't tagging clients as expected**
Confirm the rule is marked **Active** and that the trigger event matches what you expect (for example, `booking_cancelled` fires on any cancellation, not just late ones).

## Related pages

- [Clients](clients)
