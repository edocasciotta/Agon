---
title: SMS Messaging
sidebar_label: SMS Messaging
---

# SMS Messaging

This page explains how to connect Twilio, create SMS templates, assign them to events, and send a one-off SMS to a client.

**Navigation label — SMS Templates / SMS Events:**
EN: SMS Templates / SMS Events · IT: Modelli SMS / Eventi SMS · FR: Modèles SMS / Événements SMS · DE: SMS-Vorlagen / SMS-Ereignisse · ES: Plantillas SMS / Eventos SMS · PT: Modelos SMS / Eventos SMS · NL: SMS-sjablonen / SMS-gebeurtenissen

---

## Before you start

SMS messaging works the same way as the existing Email system, using [Twilio](https://www.twilio.com/) as the provider. You'll need a Twilio account with an Account SID, Auth Token, and a phone number ("From Number") before SMS can send.

**Current coverage:** SMS is currently wired into only two flows — **password reset** and **client invite** — the same two flows Email actually covers today. Other events (booking confirmations, class reminders, etc.) are not yet sending SMS, even though they appear in the SMS Events list; assigning a template to those events has no effect until that flow is built.

---

## Connecting Twilio

1. Go to **Settings** in the left sidebar.
2. Open the **SMS (Twilio)** tab.
3. Fill in:
   - **Account SID**
   - **Auth Token** — leave blank to keep the currently saved token unchanged
   - **From Number** — your Twilio phone number, e.g. `+15551234567`
   - **Enable SMS** — toggle on
4. Optionally, enter a **Test Phone Number** and click **Send Test SMS** to confirm the connection works.
5. Click **Save**.

The Auth Token is never shown in full once saved — it displays masked (e.g. `••••1234`) on reload, and saving the form again without retyping it leaves the stored token untouched.

---

## SMS Templates

Templates are reusable message bodies you can assign to events or reuse in manual sends.

1. Go to **SMS Templates** in the left sidebar (under Marketing).
2. Click **Create Template**.
3. Enter a **Name** and the **Message** body. You can use `{{variable}}` placeholders.
4. As you type, a live character count and estimated SMS segment count is shown — useful since carriers bill and split messages per 160-character segment (fewer for messages using non-GSM characters).
5. Click **Create**.

A template that's currently assigned to an event (see below) cannot be deleted — unassign it from the event first.

---

## SMS Events

Event assignments map an event type to a template, the same way Email event assignments work.

1. Go to **SMS Events** in the left sidebar (under Marketing).
2. For each event type in the list, choose the template to send when that event occurs, or leave it as **No template assigned**.

Remember: only `password_reset` and `client_invite` actually trigger a send today (see "Current coverage" above), regardless of which events show a template assigned here.

---

## Sending a one-off SMS

Use this for an ad-hoc message to a single client — no template or event required.

1. Go to **Clients** and open the client's profile.
2. Click **Send SMS**. This action only appears if the client has a phone number on file.
3. Type your message.
4. Click **Send**.

---

## What if something goes wrong?

**Send Test SMS fails**
Double-check the Account SID, Auth Token, and From Number are correct and that SMS is enabled. A Twilio-side error (invalid credentials, unverified number, etc.) is shown as a plain-language failure message, not a raw Twilio error.

**Saving Settings seems to have cleared my Twilio token**
This should not happen — saving the SMS tab only updates the Auth Token if you actually typed a new one. If you still suspect it, re-enter the token and save again, then confirm with **Send Test SMS**.

**Send SMS doesn't appear on a client's profile**
This action only shows when the client has a phone number recorded. Add a phone number to their profile first.

**I assigned a template to an event but nothing sent**
Confirm the event is one of the two currently wired-in flows (password reset, client invite) — other events don't send SMS yet even with a template assigned.

## Related pages

- [Settings](settings)
- [Clients](clients)
