---
title: Memberships endpoints
sidebar_label: Memberships
---

# Memberships API

> Auto-generated from the OpenAPI spec. Run `node docs-site/scripts/fetch-openapi.js` to regenerate.

## `GET /api/v1/memberships`

List Memberships


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `client_id` | query | No | integer |  |
| `status` | query | No |  |  |
| `page` | query | No | integer |  |
| `page_size` | query | No | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `POST /api/v1/memberships`

Assign Membership




**Responses**

- **201** — Successful Response
- **422** — Validation Error

---

## `GET /api/v1/memberships/{membership_id}`

Get Membership


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `membership_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `PUT /api/v1/memberships/{membership_id}`

Update Membership


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `membership_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `DELETE /api/v1/memberships/{membership_id}`

Cancel Membership


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `membership_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `POST /api/v1/memberships/{membership_id}/pause`

Pause Membership


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `membership_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `POST /api/v1/memberships/{membership_id}/resume`

Resume Membership


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `membership_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---
