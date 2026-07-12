---
title: Calendar-sync endpoints
sidebar_label: Calendar-sync
---

# Calendar-sync API

> Auto-generated from the OpenAPI spec. Run `node docs-site/scripts/fetch-openapi.js` to regenerate.

## `GET /api/v1/clients/{client_id}/calendar-sync`

Get Calendar Sync

Return the client's personal iCal feed URL, generating a token if needed.


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `client_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `POST /api/v1/clients/{client_id}/calendar-sync/regenerate`

Regenerate Calendar Sync

Regenerate the client's iCal feed token, invalidating the old one.


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `client_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `GET /api/v1/calendar/{token}.ics`

Get Calendar Feed

Public iCal feed of a client's upcoming confirmed bookings.

Deliberately has NO JWT auth dependency — calendar apps (Google/Apple/
Outlook) subscribe to this URL and poll it periodically, and cannot do
OAuth/JWT login. The token embedded in the path is itself the credential,
so it is never logged (see docs/SECURITY_GUIDELINES.md §5) and this
endpoint is rate-limited per docs/SECURITY_GUIDELINES.md §1.5 / §0.


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `token` | path | Yes | string |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---
