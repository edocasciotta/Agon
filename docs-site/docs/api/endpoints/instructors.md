---
title: Instructors endpoints
sidebar_label: Instructors
---

# Instructors API

> Auto-generated from the OpenAPI spec. Run `node docs-site/scripts/fetch-openapi.js` to regenerate.

## `GET /api/v1/instructors`

List Instructors


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `search` | query | No |  |  |
| `include_inactive` | query | No | boolean |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `POST /api/v1/instructors`

Create Instructor




**Responses**

- **201** — Successful Response
- **422** — Validation Error

---

## `PATCH /api/v1/instructors/{instructor_id}/reactivate`

Reactivate Instructor


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `instructor_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `GET /api/v1/instructors/{instructor_id}`

Get Instructor


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `instructor_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `PUT /api/v1/instructors/{instructor_id}`

Update Instructor


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `instructor_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `DELETE /api/v1/instructors/{instructor_id}`

Deactivate Instructor


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `instructor_id` | path | Yes | integer |  |



**Responses**

- **204** — Successful Response
- **422** — Validation Error

---

## `DELETE /api/v1/instructors/{instructor_id}/remove`

Remove Instructor


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `instructor_id` | path | Yes | integer |  |



**Responses**

- **204** — Successful Response
- **422** — Validation Error

---
