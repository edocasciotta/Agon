---
title: Locations endpoints
sidebar_label: Locations
---

# Locations API

> Auto-generated from the OpenAPI spec. Run `node docs-site/scripts/fetch-openapi.js` to regenerate.

## `GET /api/v1/locations`

List Locations


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `include_inactive` | query | No | boolean |  |
| `search` | query | No |  |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `POST /api/v1/locations`

Create Location




**Responses**

- **201** — Successful Response
- **422** — Validation Error

---

## `PUT /api/v1/locations/{location_id}`

Update Location


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `location_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `DELETE /api/v1/locations/{location_id}`

Deactivate Location


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `location_id` | path | Yes | integer |  |



**Responses**

- **204** — Successful Response
- **422** — Validation Error

---

## `DELETE /api/v1/locations/{location_id}/remove`

Remove Location


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `location_id` | path | Yes | integer |  |



**Responses**

- **204** — Successful Response
- **422** — Validation Error

---
