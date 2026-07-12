---
title: Classes endpoints
sidebar_label: Classes
---

# Classes API

> Auto-generated from the OpenAPI spec. Run `node docs-site/scripts/fetch-openapi.js` to regenerate.

## `POST /api/v1/classes/recurring`

Schedule Recurring Classes




**Responses**

- **201** — Successful Response
- **422** — Validation Error

---

## `GET /api/v1/classes`

List Classes


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `start_date` | query | No |  |  |
| `end_date` | query | No |  |  |
| `instructor_id` | query | No |  |  |
| `template_id` | query | No |  |  |
| `location_id` | query | No |  |  |
| `status` | query | No |  |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `POST /api/v1/classes`

Schedule Single Class




**Responses**

- **201** — Successful Response
- **422** — Validation Error

---

## `GET /api/v1/classes/{class_id}`

Get Class


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `class_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `PUT /api/v1/classes/{class_id}`

Update Class


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `class_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `DELETE /api/v1/classes/{class_id}`

Cancel Class


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `class_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `GET /api/v1/classes/{class_id}/roster`

Get Roster


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `class_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `GET /api/v1/classes/{class_id}/waitlist`

Get Waitlist


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `class_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `POST /api/v1/classes/{class_id}/complete`

Complete Class


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `class_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `DELETE /api/v1/classes/{class_id}/remove`

Remove Class

Permanently delete a scheduled class. Only allowed when there are no confirmed bookings.


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `class_id` | path | Yes | integer |  |



**Responses**

- **204** — Successful Response
- **422** — Validation Error

---
