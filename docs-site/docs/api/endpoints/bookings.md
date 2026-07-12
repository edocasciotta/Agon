---
title: Bookings endpoints
sidebar_label: Bookings
---

# Bookings API

> Auto-generated from the OpenAPI spec. Run `node docs-site/scripts/fetch-openapi.js` to regenerate.

## `GET /api/v1/bookings`

List Bookings


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `client_id` | query | No |  |  |
| `class_id` | query | No |  |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `POST /api/v1/bookings`

Create Booking




**Responses**

- **201** — Successful Response
- **422** — Validation Error

---

## `POST /api/v1/bookings/waitlist`

Join Waitlist




**Responses**

- **201** — Successful Response
- **422** — Validation Error

---

## `DELETE /api/v1/bookings/waitlist/{waitlist_id}`

Leave Waitlist


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `waitlist_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `POST /api/v1/bookings/waitlist/{waitlist_id}/confirm`

Confirm Waitlist


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `waitlist_id` | path | Yes | integer |  |



**Responses**

- **201** — Successful Response
- **422** — Validation Error

---

## `POST /api/v1/bookings/{booking_id}/no-show`

Mark No Show


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `booking_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `GET /api/v1/bookings/{booking_id}`

Get Booking


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `booking_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `DELETE /api/v1/bookings/{booking_id}`

Cancel Booking


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `booking_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---
