---
title: Gift-cards endpoints
sidebar_label: Gift-cards
---

# Gift-cards API

> Auto-generated from the OpenAPI spec. Run `node docs-site/scripts/fetch-openapi.js` to regenerate.

## `POST /api/v1/gift-cards`

Issue Gift Card

Manually issue a gift card (e.g. for phone/in-person sales). Manager-only.




**Responses**

- **201** — Successful Response
- **422** — Validation Error

---

## `GET /api/v1/gift-cards`

List Gift Cards

List all gift cards. Manager-only.


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `active_only` | query | No | boolean |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `GET /api/v1/gift-cards/{gift_card_id}`

Get Gift Card

Get a gift card by ID. Manager-only.


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `gift_card_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `DELETE /api/v1/gift-cards/{gift_card_id}`

Deactivate Gift Card

Deactivate a gift card (set is_active=False). Manager-only.


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `gift_card_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `POST /api/v1/gift-cards/validate`

Validate Gift Card Endpoint

Validate a gift card code and return its remaining balance.

Does NOT redeem/deduct anything — read-only check.
Accessible by authenticated clients and managers (codes are not
client-scoped, so no ownership check is required beyond authentication).




**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `POST /api/v1/gift-cards/checkout-session`

Create Gift Card Checkout Session

Create a Stripe Checkout Session for a client to purchase a gift card
as a present for someone else.

A client purchases using their own account (their JWT `sub` becomes
`purchaser_client_id`). A manager purchasing does not have a membership
of their own to attribute the purchase to, so `purchaser_client_id` is
left null in that case.

This is a separate, one-off (mode="payment") Checkout Session flow — it
does not reuse or overload the membership checkout-session endpoint.




**Responses**

- **200** — Successful Response
- **422** — Validation Error

---
