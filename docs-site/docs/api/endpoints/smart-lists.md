---
title: Smart-lists endpoints
sidebar_label: Smart-lists
---

# Smart-lists API

> Auto-generated from the OpenAPI spec. Run `node docs-site/scripts/fetch-openapi.js` to regenerate.

## `GET /api/v1/smartlists`

List Smart Lists




**Responses**

- **200** — Successful Response

---

## `POST /api/v1/smartlists`

Create Smart List




**Responses**

- **201** — Successful Response
- **422** — Validation Error

---

## `GET /api/v1/smartlists/{list_id}`

Get Smart List


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `list_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `PUT /api/v1/smartlists/{list_id}`

Update Smart List


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `list_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `DELETE /api/v1/smartlists/{list_id}`

Delete Smart List


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `list_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `GET /api/v1/smartlists/{list_id}/preview`

Preview Smart List


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `list_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---
