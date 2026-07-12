---
title: Auth endpoints
sidebar_label: Auth
---

# Auth API

> Auto-generated from the OpenAPI spec. Run `node docs-site/scripts/fetch-openapi.js` to regenerate.

## `POST /api/v1/auth/register/client`

Register Client

Register a new client account (mobile app). Auto-logs in and returns tokens.




**Responses**

- **201** — Successful Response
- **422** — Validation Error

---

## `POST /api/v1/auth/login`

Login

Login for managers, instructors, and clients. Tries users table first, then clients.




**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `POST /api/v1/auth/refresh`

Refresh Token Endpoint

Issue a new access token from a valid refresh token.

The new access token's role is derived from the refresh token's own ``role``
claim, NOT by probing the users table first. User.id and Client.id overlap,
so a "try users then clients" lookup would let a client refresh token mint a
manager access token whenever the ids collide (privilege escalation).




**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `POST /api/v1/auth/logout`

Logout

Invalidate session (stateless — client should discard tokens).




**Responses**

- **200** — Successful Response

---

## `POST /api/v1/auth/forgot-password`

Forgot Password

Request a password reset email.




**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `POST /api/v1/auth/reset-password`

Reset Password

Reset password using a token.




**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `GET /api/v1/auth/invite/{token}`

Validate Invite Token

Validate an invitation token and return basic client info.


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `token` | path | Yes | string |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `GET /api/v1/auth/me`

Get Me

Return the current authenticated user or client profile.




**Responses**

- **200** — Successful Response

---
