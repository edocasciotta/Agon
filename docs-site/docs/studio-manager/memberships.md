---
title: Memberships
sidebar_label: Memberships
---

# Memberships

This page explains how to create membership types, assign them to clients, and manage the full membership lifecycle including pausing, resuming, and cancelling.

---

## Overview

Memberships in Agon come in two forms:

- **Recurring subscription** — the client pays on a regular billing interval (weekly, monthly, or annual). Each interval grants a set number of credits, or unlimited access.
- **Credit pack** — the client pays once and receives a fixed number of credits that expire after a set period.

A credit is used when a client books a class. If a client cancels early enough, the credit is refunded to their membership.

---

## Creating a membership type

Before assigning memberships to clients, you need to define the membership types your studio offers.

1. Go to **Memberships → Types** in the left sidebar.
2. Click **New membership type**.
3. Fill in the details:

**Basic information**
- **Name** — shown to clients (e.g. "Monthly Unlimited", "10-Class Pack", "Drop-In")
- **Description** — optional details shown to clients when browsing available memberships
- **Type** — choose **Recurring subscription** or **Credit pack**
- **Price** — the amount charged (in your studio's currency)

**For recurring subscriptions**
- **Billing interval** — Weekly, Monthly, or Annual
- **Credits per interval** — number of class credits granted on each renewal (leave blank for unlimited)
- **Unlimited** — toggle on for unlimited class access with no credit limit

**For credit packs**
- **Credits included** — total number of credits in the pack
- **Validity days** — how many days after purchase the credits are valid (e.g. 90 days)

**Additional options**
- **Applicable class types** — restrict this membership to specific class types, or leave blank to apply to all classes
- **Allow pausing** — whether clients on this membership can request a pause
- **Maximum pause days** — if pausing is allowed, the maximum number of days a pause can last

4. Click **Save**.

### Deactivating a membership type

If you stop offering a particular membership, click **Deactivate** on the membership type. Existing clients with this membership are not affected — their memberships continue until they expire. New clients will no longer see this option.

---

## Assigning a membership to a client

You can assign a membership to a client manually from their profile (for example, when a client pays in person).

1. Go to **Clients** and open the client's profile.
2. Click **Add membership**.
3. Select the **membership type**.
4. Set the **start date** (defaults to today).
5. If applicable, the **expiry date** and **credits** are calculated automatically. You can adjust them if needed.
6. Click **Save**.

If [self-service purchases are enabled](settings) in Settings, clients can also purchase memberships directly from the mobile app using Stripe.

---

## How credits work

Each time a client **books a class**, one credit is deducted from their active membership.

If a client **cancels a booking** before the cancellation window (configured in [Settings](settings)):
- The credit is **refunded** to their membership

If a client **cancels inside the cancellation window** (late cancellation):
- If your cancellation policy is set to **deduct a credit on late cancellation**, the credit is **not refunded**
- If your policy does not deduct a credit, the credit is refunded even for late cancellations

When a client's credits reach zero:
- They cannot book new classes until their membership renews (for recurring subscriptions) or they purchase a new pack

When a recurring subscription renews:
- The credits_remaining counter resets to the credits_per_interval value

---

## Late cancellation policy

You configure the cancellation policy in [Settings](settings):

- **Cancellation hours** — the minimum number of hours before a class when cancellation is no longer free (e.g. 2 hours)
- **Late cancellation deducts credit** — if enabled, cancelling inside the window consumes the credit

This policy applies to client-initiated cancellations only. If you cancel a class from the studio side, all clients are always refunded their credits regardless of timing.

---

## Pausing a membership

If a membership type allows pausing, a client can request a pause from the mobile app. The pause request appears in your **Memberships → Pause requests** queue.

To approve or reject a pause:
1. Go to **Memberships → Pause requests**.
2. Click the request.
3. Click **Approve** or **Reject**.

**When a pause is approved:**
- The membership status changes to **Paused**
- The expiry date is extended by the pause duration
- For Stripe subscriptions, billing is suspended for the pause period
- The client is notified via push notification

**When the pause period ends:**
- The membership resumes automatically
- The client receives a reminder push notification

You can also manually resume a paused membership at any time by opening the client's membership and clicking **Resume membership**.

---

## Cancelling a membership

To cancel a client's membership:

1. Open the client's profile.
2. Find their active membership and click **Cancel membership**.
3. Confirm the cancellation.

The membership is immediately marked as **Cancelled**. The client can no longer book classes. For Stripe subscriptions, the subscription is cancelled in Stripe and no further charges are made.

Credits that have already been deducted for future bookings are not automatically refunded — you will need to handle those manually if appropriate.

---

## Membership statuses

| Status | Meaning |
|---|---|
| **Active** | Client can book classes normally |
| **Paused** | Client requested a pause; cannot book until resumed |
| **Expired** | Expiry date has passed or all credits used |
| **Cancelled** | Cancelled by studio manager; no further access |
| **Payment overdue** | Stripe payment failed; access may be restricted |

---

## What if something goes wrong?

**A client says they can't book even though they have an active membership**
Check the membership in their profile. Common causes: the membership has expired, all credits are used, or the membership type doesn't apply to the class type they're trying to book.

**A Stripe subscription payment failed**
The client's membership is marked **Payment overdue**. Stripe will retry the payment automatically. You can see the payment status in the client's payment history. If Stripe cannot collect after several retries, you will receive a notification.

**I assigned the wrong membership type to a client**
Cancel the incorrect membership and assign the correct one. If a payment was recorded, you may need to issue a refund separately.

## Related pages

- [Payments](payments)
- [Settings — cancellation policy](settings)
- [Client view of memberships](../clients/memberships)
