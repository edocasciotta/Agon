---
title: Checkins endpoints
sidebar_label: Checkins
---

# Checkins API

> Auto-generated from the OpenAPI spec. Run `node docs-site/scripts/fetch-openapi.js` to regenerate.

## `GET /api/v1/checkins/qr/{booking_id}`

Generate Qr Code


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `booking_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `GET /api/v1/checkins/class/{class_id}`

List Checkins For Class


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `class_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `POST /api/v1/checkins`

Create Checkin




**Responses**

- **201** — Successful Response
- **422** — Validation Error

---
