---
title: Gift Cards
sidebar_label: Gift Cards
---

# Gift Cards

This page explains how to issue, list, and deactivate gift cards for phone or in-person sales, and how clients redeem or buy them themselves.

**Navigation label — Gift Cards:**
EN: Gift Cards · IT: Carte Regalo · FR: Cartes Cadeaux · DE: Geschenkkarten · ES: Tarjetas Regalo · PT: Cartões-Presente · NL: Cadeaubonnen

---

## Before you start

Only studio managers can issue, view, or deactivate gift cards from the desktop backoffice. Clients can also buy a gift card themselves as a present, from the mobile app — see below.

---

## Overview

A gift card is a prepaid balance identified by a code in the format `GC-XXXXXXXX`. It has an **initial value** and a **remaining balance** that goes down as it's redeemed against membership purchases. Gift cards can carry a recipient name, email, personal message, and an optional expiry date.

## Issuing a gift card

Use this for gift cards sold over the phone or in person, where you're recording the sale manually rather than a client self-purchasing online.

1. Go to **Gift Cards** in the left sidebar.
2. Click **Issue Gift Card**.
3. Fill in:
   - **Initial Value** — the balance the card starts with
   - **Recipient Name** (optional)
   - **Recipient Email** (optional)
   - **Personal Message** (optional) — shown to the recipient
   - **Expires On** (optional) — leave empty for no expiry
4. Click **Issue**.

The gift card appears in the list with a system-generated code (`GC-XXXXXXXX`), its initial value, and remaining balance (equal to the initial value until it's redeemed).

### Deactivating a gift card

1. Find the gift card in the list.
2. Click **Deactivate**.
3. Confirm.

Deactivating stops the card from being redeemed further. It does not delete the card or its history — any remaining balance simply becomes unusable.

---

## How clients redeem a gift card

A client enters a gift card code at membership checkout, alongside (and independently of) a promo code. The balance is capped at the membership's price — it's never redeemed for more than the purchase costs — and is only actually deducted once the payment completes:

- **Partial coverage**: the gift card balance is deducted from the price, and the client pays the remainder via Stripe as usual.
- **Full coverage**: if the gift card balance fully covers the price, the purchase bypasses Stripe entirely (Stripe Checkout can't process a $0 charge) — the membership is granted instantly and the gift card is redeemed immediately. This only applies to one-time purchases, not recurring/subscription memberships.

Because redemption happens on payment completion (not on validation), an abandoned or incomplete checkout never burns down a gift card's balance.

---

## Clients buying a gift card as a present

A client can also buy a gift card themselves, as a gift for someone else, directly from the mobile app's self-purchase flow. This opens a separate Stripe checkout (a one-off payment, not tied to any membership) for the amount they choose, with the same recipient name/email/message fields available to personalize it. Once payment completes, a new gift card is issued with that balance — it then works exactly like a manager-issued card at checkout.

---

## What if something goes wrong?

**A client's gift card code isn't accepted**
Check the card's status in the list — it may be Inactive, expired, or have a remaining balance of zero.

**A client wants a refund on a gift card purchase**
Gift card purchases are one-off Stripe payments; process any refund directly in your Stripe dashboard. Deactivate the corresponding gift card afterward so its balance can no longer be used.

**The remaining balance looks wrong after a purchase**
Remaining balance only updates once a Stripe payment actually completes (via webhook) — if a client's checkout session was abandoned, the balance is untouched, which is expected.

## Related pages

- [Memberships](memberships)
- [Promo Codes](promo-codes)
- [Client view of memberships](../clients/memberships)
