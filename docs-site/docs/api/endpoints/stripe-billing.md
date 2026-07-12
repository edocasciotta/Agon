---
title: Stripe-billing endpoints
sidebar_label: Stripe-billing
---

# Stripe-billing API

> Auto-generated from the OpenAPI spec. Run `node docs-site/scripts/fetch-openapi.js` to regenerate.

## `GET /api/billing/settings`

Get Billing Settings

Return current Stripe connection status. Never returns the secret key.




**Responses**

- **200** — Successful Response

---

## `POST /api/billing/settings`

Post Billing Settings

Validate a Stripe secret key and persist all Stripe credentials.




**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `POST /api/billing/checkout-session`

Create Checkout Session

Create a Stripe Checkout Session for a membership purchase.

Supports both one-off (mode="payment") and recurring (mode="subscription")
purchases depending on the membership type.

Accessible by authenticated clients (who may only purchase for themselves)
and by managers (who may initiate on behalf of any client).




**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `POST /api/billing/webhook`

Stripe Webhook

Stripe webhook receiver. No auth — Stripe signs the payload.




**Responses**

- **200** — Successful Response

---

## `GET /api/billing/members/{client_id}/subscription`

Get Subscription Status

Return the most recent Stripe subscription for a client.

Accessible by managers or the client themselves.


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `client_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `POST /api/billing/members/{client_id}/subscription/cancel`

Cancel Subscription

Cancel a client's active subscription at period end. Manager-only.


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `client_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `POST /api/billing/members/{client_id}/subscription/cancel/override`

Cancel Subscription Override

Cancel a client's subscription locally in the DB without calling Stripe.

Safety valve for when Stripe is unreachable or webhooks fail.
Manager-only. Does NOT make any network calls to Stripe.


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `client_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---
