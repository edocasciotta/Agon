---
title: Waivers
sidebar_label: Waivers
---

# Waivers

This page explains how to create waiver documents, require signatures before booking, and check a client's signature status.

**Navigation label — Waivers:**
EN: Waivers · IT: Moduli di Consenso · FR: Décharges · DE: Haftungsausschlüsse · ES: Exenciones de Responsabilidad · PT: Termos de Responsabilidade · NL: Vrijwaringen

---

## Before you start

Waiver management (creating, editing, deactivating) is manager-only. **There is no way to sign a waiver on a client's behalf anywhere in the desktop app** — signing is client-self-only by design. If you try, the backend itself rejects manager and instructor tokens with a 403 error on the signing endpoint, because the whole point of a waiver is the client's own informed consent.

---

## Overview

A waiver is a document (for example, a liability release or studio policy) that you can optionally require clients to digitally sign before they can book a class. Each waiver has a version number — editing its body creates a new version and requires every client to re-sign, even if they'd already signed an earlier version.

## Creating a waiver

1. Go to **Waivers** in the left sidebar.
2. Click **New Waiver**.
3. Fill in:
   - **Title** — e.g. "Liability Waiver"
   - **Body** — the full text clients will read and sign
   - **Requires signature before booking** — toggle on if clients must sign this before their first booking
4. Click **Create**.

A new waiver always starts at **version 1**.

## Editing a waiver

1. Find the waiver in the list and open it for editing.
2. Change the title, body, and/or the "requires before booking" toggle.
3. If you changed the **body**, a warning explains that saving will create a new version and every client will need to re-sign — even clients who had already signed the previous version.
4. Click **Save**.

Editing only the title or the "requires before booking" toggle, without changing the body, does **not** bump the version and does not force re-signing.

## Deactivating a waiver

1. Find the waiver in the list.
2. Click **Deactivate**.
3. Confirm.

Deactivating is a soft delete — the waiver stops being enforced or shown to clients, but all existing signature history is preserved for your records. There is no hard-delete option.

---

## Checking a client's signature status

1. Go to **Clients** and open the client's profile.
2. Find the **Waivers** card.

Each active waiver shows the client's status against the **current version**:
- **Signed** — with the date they signed
- **Unsigned** — with an amber **Blocks booking** badge if the waiver is both required and unsigned

Signing an older version does not count as signed once you've edited the waiver's body — the client's status shows Unsigned until they sign the new version, even if they'd signed a previous one.

---

## What happens when a client tries to book without signing

If a waiver is marked "requires signature before booking" and the client hasn't signed the current version, booking creation is blocked with a `WAIVER_SIGNATURE_REQUIRED` error. The desktop app shows this as a plain-language message rather than a raw error code, telling you the client needs to sign the waiver before the booking can go through.

---

## What if something goes wrong?

**A client can't book and I don't know why**
Check their profile's **Waivers** card for an amber **Blocks booking** badge — this means a required waiver is unsigned (possibly because you recently edited its body, bumping the version).

**I need a client to sign right now, in person**
There is no manager-side signing action. Have the client sign from their own mobile device — waiver signing is client-self-only everywhere in Agon.

**I edited a waiver by mistake and now everyone needs to re-sign**
There's no way to undo a version bump. If the change was trivial, consider whether it was really necessary — otherwise, clients will need to re-sign once, which is expected behavior for any body change.

## Related pages

- [Clients](clients)
