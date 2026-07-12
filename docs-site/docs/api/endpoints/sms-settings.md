---
title: Sms-settings endpoints
sidebar_label: Sms-settings
---

# Sms-settings API

> Auto-generated from the OpenAPI spec. Run `node docs-site/scripts/fetch-openapi.js` to regenerate.

## `GET /api/v1/sms/settings`

Get Sms Settings




**Responses**

- **200** — Successful Response

---

## `PUT /api/v1/sms/settings`

Update Sms Settings




**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `POST /api/v1/sms/settings/test`

Send Test Sms Endpoint

Send a test SMS to verify the Twilio configuration works.




**Responses**

- **200** — Successful Response
- **422** — Validation Error

---
