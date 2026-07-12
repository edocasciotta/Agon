---
title: Instructor-availability endpoints
sidebar_label: Instructor-availability
---

# Instructor-availability API

> Auto-generated from the OpenAPI spec. Run `node docs-site/scripts/fetch-openapi.js` to regenerate.

## `GET /api/v1/instructor-availability`

List Instructor Availability


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `instructor_id` | query | No |  |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `POST /api/v1/instructor-availability`

Create Instructor Availability




**Responses**

- **201** — Successful Response
- **422** — Validation Error

---

## `DELETE /api/v1/instructor-availability/{availability_id}`

Delete Instructor Availability


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `availability_id` | path | Yes | integer |  |



**Responses**

- **204** — Successful Response
- **422** — Validation Error

---
