---
title: Sms-templates endpoints
sidebar_label: Sms-templates
---

# Sms-templates API

> Auto-generated from the OpenAPI spec. Run `node docs-site/scripts/fetch-openapi.js` to regenerate.

## `GET /api/v1/sms/templates`

List Templates




**Responses**

- **200** — Successful Response

---

## `POST /api/v1/sms/templates`

Create Template




**Responses**

- **201** — Successful Response
- **422** — Validation Error

---

## `GET /api/v1/sms/templates/{template_id}`

Get Template


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `template_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `PUT /api/v1/sms/templates/{template_id}`

Update Template


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `template_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `DELETE /api/v1/sms/templates/{template_id}`

Delete Template


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `template_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---
