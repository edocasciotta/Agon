---
title: Calendar Sync
sidebar_label: Calendar Sync
---

# Calendar Sync

This page explains how to view, copy, and regenerate a client's personal calendar subscription link from their profile.

**Navigation label — Calendar Sync (section on Client Detail):**
EN: Calendar Sync · IT: Sincronizzazione Calendario · FR: Synchronisation du calendrier · DE: Kalendersynchronisierung · ES: Sincronización de calendario · PT: Sincronização de calendário · NL: Agendasynchronisatie

---

## Before you start

This page covers the **manager's view** of calendar sync — a card on the client's profile in the desktop backoffice. The client's own subscribe action happens on their side, in the mobile app (see [Calendar sync — client guide](../clients/calendar-sync)).

---

## Overview

Every client has a personal, secret calendar feed link. When a client (or you, on their behalf) subscribes to it from a calendar app (Google Calendar, Apple Calendar, Outlook), that calendar automatically shows the client's upcoming confirmed class bookings — no manual re-entry needed, and it updates automatically as their bookings change.

## Viewing and copying a client's calendar link

1. Go to **Clients** and open the client's profile.
2. Find the **Calendar Sync** card.
3. The client's feed link is shown. Click **Copy** to copy it to your clipboard — useful if you're helping a client subscribe in person.

## Regenerating a client's calendar link

Regenerating creates a brand-new secret link and immediately invalidates the old one.

1. On the **Calendar Sync** card, click **Regenerate Link**.
2. Confirm — the dialog explains that the current link will stop working.

After regenerating, any calendar app still using the old link will stop receiving updates (most apps show it as no longer reachable). The client must subscribe again using the new link — from their mobile app or with a link you copy for them.

**When to regenerate:** if a client suspects their link was shared or exposed, or if you're troubleshooting a subscription issue and want a clean link to start over with.

---

## What if something goes wrong?

**A client's calendar isn't updating**
Most calendar apps only poll a subscribed feed periodically (sometimes only once every several hours), not instantly — ask them to wait, or check their calendar app's manual refresh/sync option.

**I regenerated the link but the client didn't get a new one**
Regenerating only creates the new link — it does not resend or notify the client automatically. Copy the new link and share it with them, or have them view it themselves in the mobile app's Profile screen.

**The client says the subscribe link doesn't open their calendar app**
This depends on the client's device and calendar app supporting `webcal://` links. See [Calendar sync — client guide](../clients/calendar-sync) for the client-side flow.

## Related pages

- [Clients](clients)
- [Calendar sync — client guide](../clients/calendar-sync)
