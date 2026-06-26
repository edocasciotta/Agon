---
title: Studio Setup Wizard
sidebar_label: Studio Setup
---

# Studio Setup Wizard

When you open Agon for the first time, a five-step wizard guides you through configuring your studio. This page explains what each step does and what to expect.

The wizard takes about 10 minutes to complete. You can change all settings again later from **Settings**.

---

## Step 1 — Studio profile

Enter your studio's basic information:

- **Studio name** — the name shown to your clients in the mobile app (required)
- **Address** — your physical studio address (required)
- **Timezone** — the timezone for all class scheduling (required)
- **Logo** — upload a logo image (optional, but recommended — it appears in the client app)

The timezone is the most important setting here. All class times are stored and displayed in this timezone. Choose the timezone where your studio is physically located.

Click **Continue** when done.

---

## Step 2 — Your manager account

Your manager account is created automatically during installation. This step confirms the account details:

- Your **full name**
- Your **email address** — used to log in
- Your **password** — must be at least 12 characters

This is the only account with full access to everything in Agon: client data, financial reports, settings. Keep your password safe.

Click **Create Account** to proceed.

---

## Step 3 — Connectivity

Agon automatically sets up a secure internet connection so your clients can reach your studio from anywhere. You do not need to do anything technical — this happens entirely in the background.

You will see a progress indicator while the connection is established. This usually takes 30–60 seconds.

When complete, your studio receives a unique web address (for example: `your-studio.trycloudflare.com`). Agon uses this address internally — you do not need to write it down or share it. Your clients will use your QR code instead.

**If connectivity setup fails:** the error is shown in plain language with a link to the relevant help page. The most common cause is a firewall or corporate network blocking outgoing connections. Check your internet connection and try again.

---

## Step 4 — Payment setup

Choose how you handle payments:

**Connect Stripe (recommended)**
If you want clients to be able to purchase memberships directly from the mobile app, connect your Stripe account. Agon uses Stripe to process payments — money goes directly to your bank account, and Agon is never involved in the transaction.

You will be redirected to Stripe to connect your existing account or create a new one. The process takes about 5 minutes.

**Handle payments manually**
If you prefer to handle all payments in person — cash, bank transfer, or a physical card reader — choose this option. You can still record payments in Agon for your records. You can connect Stripe later from **Settings → Payments**.

---

## Step 5 — Backup setup

Agon runs a daily automatic backup of your database at 3:00 AM. Choose where to save it:

**Google Drive**
Click **Connect Google Drive** and sign in to your Google account. Agon will save backups to a folder called **Agon Backups** in your Drive. You will need to authorise access.

**Dropbox**
Click **Connect Dropbox** and sign in. Agon will save backups to an **Agon Backups** folder in your Dropbox.

**Local folder only**
Saves backups only on this computer. This option is shown with a warning — if your computer is lost, stolen, or damaged, you will lose your data. Use cloud backup whenever possible.

You can change your backup location later from **Settings → Backups**.

---

## Finishing setup

At the end of the wizard, Agon shows a summary screen and generates your **studio onboarding sheet** — a printable page with:

- Your studio name and QR code
- Instructions for clients on how to download the app

Print this sheet and put it at your reception desk. When clients scan the QR code with their phone camera, they are taken directly to download the Agon Studio app, pre-configured to connect to your studio.

You can also save the sheet as a PDF to share digitally.

---

## What if something goes wrong?

**Step 3 stays on "Connecting..." for more than 2 minutes**
Check your internet connection. Make sure your computer can reach the internet. If you are on a corporate or school network, a firewall may be blocking the connection. Try connecting from a home network.

**I made a mistake in my studio details**
You can change all studio information after setup. Go to **Settings → Studio Profile**.

**I accidentally skipped Stripe — can I connect it later?**
Yes. Go to **Settings → Payments → Connect Stripe** at any time.

**The backup didn't authorise — can I set it up later?**
Yes. Go to **Settings → Backups**. Until cloud backup is configured, a yellow banner appears at the top of the app as a reminder.

## Related pages

- [Setting up the client app](client-setup)
- [Studio Settings](../studio-manager/settings)
- [Payments](../studio-manager/payments)
