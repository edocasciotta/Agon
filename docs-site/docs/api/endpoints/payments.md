---
title: Payments endpoints
sidebar_label: Payments
---

# Payments API

> Auto-generated from the OpenAPI spec. Run `node docs-site/scripts/fetch-openapi.js` to regenerate.

## `POST /api/v1/payments/stripe/webhook`

Stripe Webhook




**Responses**

- **200** — Successful Response

---

## `POST /api/v1/payments/stripe/checkout`

Stripe Checkout




**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `POST /api/v1/payments/{payment_id}/refund`

Refund Payment


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `payment_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `GET /api/v1/payments/{payment_id}`

Get Payment


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `payment_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `GET /api/v1/payments`

List Payments


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `client_id` | query | No | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `POST /api/v1/payments`

Record Manual Payment




**Responses**

- **201** — Successful Response
- **422** — Validation Error

---
