---
title: Email-events endpoints
sidebar_label: Email-events
---

# Email-events API

> Auto-generated from the OpenAPI spec. Run `node docs-site/scripts/fetch-openapi.js` to regenerate.

## `GET /api/v1/email/events`

List Event Assignments




**Responses**

- **200** — Successful Response

---

## `PUT /api/v1/email/events/{event_type}`

Assign Template To Event


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `event_type` | path | Yes | string |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---
