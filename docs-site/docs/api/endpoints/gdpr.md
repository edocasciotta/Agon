---
title: Gdpr endpoints
sidebar_label: Gdpr
---

# Gdpr API

> Auto-generated from the OpenAPI spec. Run `node docs-site/scripts/fetch-openapi.js` to regenerate.

## `GET /api/v1/gdpr/export/{client_id}`

Gdpr Export


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `client_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `POST /api/v1/gdpr/delete/{client_id}`

Gdpr Delete


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `client_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `GET /api/v1/gdpr/consent-log/{client_id}`

Get Consent Log


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `client_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `POST /api/v1/gdpr/consent`

Record Consent




**Responses**

- **201** — Successful Response
- **422** — Validation Error

---
