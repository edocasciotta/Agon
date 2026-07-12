---
title: Class-templates endpoints
sidebar_label: Class-templates
---

# Class-templates API

> Auto-generated from the OpenAPI spec. Run `node docs-site/scripts/fetch-openapi.js` to regenerate.

## `GET /api/v1/class-templates`

List Templates


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `include_inactive` | query | No | boolean |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `POST /api/v1/class-templates`

Create Template




**Responses**

- **201** — Successful Response
- **422** — Validation Error

---

## `GET /api/v1/class-templates/{template_id}`

Get Template


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `template_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `PUT /api/v1/class-templates/{template_id}`

Update Template


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `template_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `DELETE /api/v1/class-templates/{template_id}`

Deactivate Template


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `template_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---
