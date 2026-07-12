---
title: Notifications endpoints
sidebar_label: Notifications
---

# Notifications API

> Auto-generated from the OpenAPI spec. Run `node docs-site/scripts/fetch-openapi.js` to regenerate.

## `POST /api/v1/notifications/send`

Send Notification

Send a manual push notification to a client (manager only).




**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `GET /api/v1/notifications`

List Notifications

List notifications for the authenticated client.




**Responses**

- **200** — Successful Response

---

## `PUT /api/v1/notifications/{notification_id}/read`

Mark Notification Read

Acknowledge a notification (client can only access their own).


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `notification_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---
