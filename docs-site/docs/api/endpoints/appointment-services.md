---
title: Appointment-services endpoints
sidebar_label: Appointment-services
---

# Appointment-services API

> Auto-generated from the OpenAPI spec. Run `node docs-site/scripts/fetch-openapi.js` to regenerate.

## `GET /api/v1/appointment-services`

List Appointment Services


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `include_inactive` | query | No | boolean |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `POST /api/v1/appointment-services`

Create Appointment Service




**Responses**

- **201** — Successful Response
- **422** — Validation Error

---

## `GET /api/v1/appointment-services/{service_id}`

Get Appointment Service


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `service_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `PATCH /api/v1/appointment-services/{service_id}`

Update Appointment Service


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `service_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `DELETE /api/v1/appointment-services/{service_id}`

Deactivate Appointment Service

Soft-delete: deactivate the service (reversible via PATCH is_active=true).

This endpoint never hard-deletes — appointment history referencing the
service must be preserved, consistent with the "deactivate = reversible"
convention established for membership types. There is no companion
hard-delete route for appointment services in this round.


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `service_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---
