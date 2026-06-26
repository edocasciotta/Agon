---
title: Settings
sidebar_label: Settings
---

# Settings

This page explains every setting available in Agon and what each one does.

All settings are available from **Settings** in the left sidebar. Only studio managers can access Settings.

---

## Studio profile

| Setting | Description |
|---|---|
| **Studio name** | The name shown to clients in the mobile app |
| **Address** | Your studio's physical address |
| **Timezone** | All class times are stored and displayed in this timezone. Change only if you are relocating — this will affect the display of all existing classes |
| **Logo** | Displayed in the client app and on the onboarding QR code sheet |

---

## Booking policy

### Cancellation policy

| Setting | Default | Description |
|---|---|---|
| **Cancellation hours** | 2 | The number of hours before a class starts within which a client cannot cancel for free. Set to 0 to allow free cancellation up until class start. |
| **Late cancellation deducts credit** | Off | If enabled, a client who cancels inside the cancellation window loses the credit for that booking — it is not refunded. If disabled, credits are always refunded on cancellation. |

**Example:** With **Cancellation hours** set to 2 and **Late cancellation deducts credit** enabled, a client who cancels a 10:00 AM class at 9:30 AM will lose their credit. A client who cancels at 7:00 AM will get their credit back.

### Check-in window

| Setting | Default | Description |
|---|---|---|
| **Check-in opens (minutes before class)** | 30 | How many minutes before class start the check-in window opens. |
| **Check-in closes (minutes after class)** | 15 | How many minutes after class start the check-in window closes. After this, only manual check-in from the desktop app is possible. |

### Waitlist

| Setting | Default | Description |
|---|---|---|
| **Waitlist confirmation window (minutes)** | 30 | When a spot opens up in a full class, the first person on the waitlist has this many minutes to confirm. If they don't confirm in time, the spot is offered to the next person on the waitlist. |

---

## Client access

| Setting | Default | Description |
|---|---|---|
| **Guest bookings enabled** | Off | If enabled, clients without an active membership or credits can still book classes. Useful for trial sessions or events where you don't require a membership. |
| **Self-service purchases enabled** | On | If enabled, clients can purchase memberships directly from the mobile app using Stripe. Disable this if you prefer to assign all memberships manually. Requires Stripe to be connected. |

---

## Notifications

| Setting | Default | Description |
|---|---|---|
| **Class reminder (hours before)** | 2 | How many hours before a class starts clients receive a reminder push notification. Set to 0 to disable reminders. |

---

## Payments

See the full [Payments](payments) guide for step-by-step instructions on connecting Stripe.

| Setting | Description |
|---|---|
| **Stripe account** | Shows the connected Stripe account ID. Click **Disconnect** to remove the connection. |
| **Connect Stripe** | Opens the Stripe OAuth flow to connect your account. |

---

## Backups

Agon runs a nightly backup at **3:00 AM** (studio local time). The last 30 daily backups are kept; older backups are deleted automatically.

| Setting | Description |
|---|---|
| **Backup provider** | Google Drive, Dropbox, or Local folder only |
| **Last backup** | Timestamp of the most recent successful backup |
| **Trigger manual backup** | Click **Back up now** to run a backup immediately. Useful before making major changes or before an update. |
| **Connect / Disconnect** | Authorise or remove your cloud backup provider connection |

**Warning:** If only **Local folder** is selected, your data is not protected against hardware failure. Connect Google Drive or Dropbox for off-site backup.

---

## Connectivity

This section shows the status of your Cloudflare Tunnel — the secure connection that lets clients reach your studio from anywhere.

| Setting | Description |
|---|---|
| **Tunnel URL** | Your studio's unique public web address (read-only). Clients don't need this directly — they use the QR code instead. |
| **Tunnel status** | Shows **Active** (green) or **Inactive** (red). |
| **Restart tunnel** | If the tunnel shows as Inactive, click **Restart tunnel** to re-establish the connection. |

If the tunnel is offline, clients cannot reach the studio from the mobile app. The desktop app continues to work normally on your local network.

---

## Account

| Setting | Description |
|---|---|
| **Full name** | Your display name in the application |
| **Email address** | Your login email (changing this also changes your login) |
| **Change password** | Enter your current password and a new password (minimum 12 characters) |

---

## What if something goes wrong?

**I changed the timezone and now all my classes show wrong times**
The timezone setting affects how existing class times are displayed. If you need to correct this, change the timezone back to its previous value and contact support for guidance on migrating class times.

**Backups show "Last backup: Never"**
This means no successful backup has run yet. Click **Back up now** to run an immediate backup. If it fails, check that your cloud backup provider is connected and authorised.

**The tunnel shows as Inactive**
Click **Restart tunnel**. If it remains inactive after a minute, check your internet connection. See the [connectivity troubleshooting guide] for more help.

## Related pages

- [Payments](payments)
- [Check-in](check-in)
- [Classes](classes)
