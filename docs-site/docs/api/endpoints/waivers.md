---
title: Waivers endpoints
sidebar_label: Waivers
---

# Waivers API

> Auto-generated from the OpenAPI spec. Run `node docs-site/scripts/fetch-openapi.js` to regenerate.

## `POST /api/v1/waivers`

Create Waiver

Create a new waiver. Manager-only. Always starts at version=1.




**Responses**

- **201** — Successful Response
- **422** — Validation Error

---

## `GET /api/v1/waivers`

List Waivers

List all waivers. Manager-only.


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `active_only` | query | No | boolean |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `GET /api/v1/waivers/{waiver_id}`

Get Waiver

Get a waiver by ID. Manager-only.


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `waiver_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `PUT /api/v1/waivers/{waiver_id}`

Update Waiver

Update a waiver. Manager-only.

If `body` is present in the payload and differs from the current value,
`version` is incremented. title-only or requires_before_booking-only
updates do NOT bump version.


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `waiver_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `DELETE /api/v1/waivers/{waiver_id}`

Deactivate Waiver

Deactivate a waiver (set is_active=False). Manager-only.

Mirrors app/routers/promo_codes.py::deactivate_promo_code. Unlike
email/SMS templates, this never blocks on existing signatures — the
signature history is the whole point of the audit trail. Deactivating
just means the waiver stops being enforced/offered going forward.


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `waiver_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `GET /api/v1/clients/{client_id}/waivers`

List Client Waivers

List active waivers with this client's signature status against the
*current* version of each. IDOR-protected: a client may only view their
own list; managers/instructors may view any client's.


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `client_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `POST /api/v1/waivers/{waiver_id}/sign`

Sign Waiver

Record the caller's own digital signature for a waiver.

Client-self only — get_current_client already rejects manager/instructor
tokens with 403 AUTH_INSUFFICIENT_PERMISSIONS (see app/auth.py), since a
manager must never sign on a client's behalf: the whole point is the
client's own informed consent. Records waiver_version = the CURRENT
version at signing time. Never deduplicated — re-signing after a version
bump (or even the same version) always creates a new audit-trail row.


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `waiver_id` | path | Yes | integer |  |



**Responses**

- **201** — Successful Response
- **422** — Validation Error

---
