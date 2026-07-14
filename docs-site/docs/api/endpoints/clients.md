---
title: Clients endpoints
sidebar_label: Clients
---

# Clients API

> Auto-generated from the OpenAPI spec. Run `node docs-site/scripts/fetch-openapi.js` to regenerate.

## `GET /api/v1/clients/me`

Get Own Profile




**Responses**

- **200** — Successful Response

---

## `PUT /api/v1/clients/me`

Update Own Profile




**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `PUT /api/v1/clients/me/push-token`

Update Push Token




**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `GET /api/v1/clients`

List Clients


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `search` | query | No |  |  |
| `active_only` | query | No | boolean |  |
| `page` | query | No | integer |  |
| `page_size` | query | No | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `POST /api/v1/clients`

Create Client

Create a client from the backoffice (no password yet). Sends invitation email.




**Responses**

- **201** — Successful Response
- **422** — Validation Error

---

## `GET /api/v1/clients/{client_id}`

Get Client


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `client_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `PUT /api/v1/clients/{client_id}`

Update Client


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `client_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `DELETE /api/v1/clients/{client_id}`

Anonymize Client


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `client_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `POST /api/v1/clients/{client_id}/photo`

Upload Client Photo


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `client_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `GET /api/v1/clients/{client_id}/bookings`

Get Client Bookings


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `client_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `GET /api/v1/clients/{client_id}/memberships`

Get Client Memberships


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `client_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---
