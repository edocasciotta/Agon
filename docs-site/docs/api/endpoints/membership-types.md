---
title: Membership-types endpoints
sidebar_label: Membership-types
---

# Membership-types API

> Auto-generated from the OpenAPI spec. Run `node docs-site/scripts/fetch-openapi.js` to regenerate.

## `GET /api/v1/membership-types`

List Membership Types


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `include_inactive` | query | No | boolean |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `POST /api/v1/membership-types`

Create Membership Type




**Responses**

- **201** — Successful Response
- **422** — Validation Error

---

## `GET /api/v1/membership-types/{membership_type_id}`

Get Membership Type


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `membership_type_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `PUT /api/v1/membership-types/{membership_type_id}`

Update Membership Type


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `membership_type_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `DELETE /api/v1/membership-types/{membership_type_id}`

Deactivate Membership Type


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `membership_type_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `PATCH /api/v1/membership-types/{membership_type_id}/reactivate`

Reactivate Membership Type


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `membership_type_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `DELETE /api/v1/membership-types/{membership_type_id}/remove`

Remove Membership Type

Hard-delete a membership type. Blocked if any memberships reference it.


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `membership_type_id` | path | Yes | integer |  |



**Responses**

- **204** — Successful Response
- **422** — Validation Error

---
