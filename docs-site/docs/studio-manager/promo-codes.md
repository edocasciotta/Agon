---
title: Promo Codes
sidebar_label: Promo Codes
---

# Promo Codes

This page explains how to create and manage discount codes that clients can apply when purchasing a membership.

**Navigation label — Promo Codes:**
EN: Promo Codes · IT: Codici Promo · FR: Codes Promo · DE: Rabattcodes · ES: Códigos Promocionales · PT: Códigos Promocionais · NL: Kortingscodes

---

## Before you start

Only studio managers can create and manage promo codes. Clients apply codes themselves at checkout — you don't need to do anything on their behalf.

---

## Overview

A promo code gives a client a discount on a membership purchase, either as a **percentage** (e.g. 20% off) or a **fixed amount** (e.g. €10 off). You control:

- How many times the code can be used in total
- Whether each client can only use it once
- A validity window (start and/or end date)
- Which membership types it applies to

## Steps

1. Go to **Promo Codes** in the left sidebar.
2. Click **Create Promo Code**.
3. Fill in the details:
   - **Code** — the text clients type in (e.g. `SUMMER20`)
   - **Discount Type** — Percentage or Fixed Amount
   - **Discount Value** — the percentage or amount
   - **Max Uses** — total number of redemptions allowed across all clients (leave empty for unlimited)
   - **One per client** — toggle to restrict each client to a single use of this code
   - **Valid From** / **Valid Until** — the window during which the code can be redeemed (leave "Valid Until" empty for no expiry)
4. Click **Create**.

The new code appears in the list as **Active**, with a running count of how many times it's been used.

### Deactivating a code

1. Find the code in the list.
2. Click **Deactivate**.
3. Confirm.

Deactivating a code is non-destructive — the code's usage history is kept, but clients can no longer apply it. There is no separate delete action.

---

## How clients apply a code

Clients enter a promo code themselves at checkout, on both the desktop backoffice purchase flow (when a manager processes a purchase for them) and the mobile purchase screen. The app validates the code live — showing the discount amount and final price — before the client confirms payment. Validating a code does not redeem it; the redemption (and the use count going up) only happens once the purchase actually completes.

A promo code and a gift card can both be applied to the same purchase.

---

## What if something goes wrong?

**A client says their code doesn't work**
Check the code's status in the list — it may be Inactive, expired (past "Valid Until"), or have hit its Max Uses. If "One per client" is enabled, the client may have already used it once before.

**I need to reuse a deactivated code's text**
Codes must be unique while active. If you deactivate a code, its text is freed up, but for a clean audit trail it's usually better to create a new code with a new name.

**The discount didn't apply to a specific membership type**
If the code was created with specific membership types selected, it will only validate for purchases of those types.

## Related pages

- [Memberships](memberships)
- [Gift Cards](gift-cards)
- [Client view of memberships](../clients/memberships)
