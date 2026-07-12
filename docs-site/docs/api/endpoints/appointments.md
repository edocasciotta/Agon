---
title: Appointments endpoints
sidebar_label: Appointments
---

# Appointments API

> Auto-generated from the OpenAPI spec. Run `node docs-site/scripts/fetch-openapi.js` to regenerate.

## `GET /api/v1/appointments/available-slots`

Get Available Slots


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `service_id` | query | Yes | integer |  |
| `instructor_id` | query | Yes | integer |  |
| `date` | query | Yes | string |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `GET /api/v1/appointments`

List Appointments


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `instructor_id` | query | No |  |  |
| `client_id` | query | No |  |  |
| `start_date` | query | No |  |  |
| `end_date` | query | No |  |  |
| `status` | query | No |  |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `POST /api/v1/appointments`

Create Appointment




**Responses**

- **201** — Successful Response
- **422** — Validation Error

---

## `GET /api/v1/appointments/{appointment_id}`

Get Appointment


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `appointment_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `PATCH /api/v1/appointments/{appointment_id}/cancel`

Cancel Appointment


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `appointment_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `PATCH /api/v1/appointments/{appointment_id}/complete`

Complete Appointment


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `appointment_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---
