---
title: Migration endpoints
sidebar_label: Migration
---

# Migration API

> Auto-generated from the OpenAPI spec. Run `node docs-site/scripts/fetch-openapi.js` to regenerate.

## `GET /api/v1/migration/templates/{type}`

Download Template


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `type` | path | Yes | string |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `POST /api/v1/migration/analyse`

Analyse File


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `entity` | query | No | string |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `POST /api/v1/migration/confirm`

Confirm Import




**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `GET /api/v1/migration/status`

Get Status


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `job_id` | query | No |  |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `GET /api/v1/migration/summary`

Get Summary




**Responses**

- **200** — Successful Response

---

## `POST /api/v1/migration/invitations/send`

Send Invitations




**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `GET /api/v1/migration/invitations/export`

Export Invitations Csv


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `job_id` | query | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---
