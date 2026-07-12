---
title: Promo-codes endpoints
sidebar_label: Promo-codes
---

# Promo-codes API

> Auto-generated from the OpenAPI spec. Run `node docs-site/scripts/fetch-openapi.js` to regenerate.

## `GET /api/v1/promo-codes`

List Promo Codes

List all promo codes. Manager-only.


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `active_only` | query | No | boolean |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `POST /api/v1/promo-codes`

Create Promo Code

Create a new promo code. Manager-only.




**Responses**

- **201** — Successful Response
- **422** — Validation Error

---

## `GET /api/v1/promo-codes/{promo_code_id}`

Get Promo Code

Get a promo code by ID. Manager-only.


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `promo_code_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `PUT /api/v1/promo-codes/{promo_code_id}`

Update Promo Code

Update a promo code. Manager-only.


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `promo_code_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `DELETE /api/v1/promo-codes/{promo_code_id}`

Deactivate Promo Code

Deactivate a promo code (set is_active=False). Manager-only.


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `promo_code_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `POST /api/v1/promo-codes/validate`

Validate Promo Code Endpoint

Validate a promo code and return discount info. Does NOT record usage.

Accessible by authenticated clients and managers.




**Responses**

- **200** — Successful Response
- **422** — Validation Error

---
