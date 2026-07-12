---
title: API Reference Overview
sidebar_label: Overview
---

# API Reference

Agon exposes a REST API that the desktop app and mobile app both use. If you are a developer and want to integrate with Agon or build on top of it, this page explains the basics.

---

## Base URL

The API runs locally on the studio manager's machine:

```
http://localhost:8000
```

When clients connect from outside (via the mobile app), they use the studio's Cloudflare Tunnel URL, which looks like:

```
https://your-studio.trycloudflare.com
```

All endpoints are versioned under `/api/v1/`. For example:

```
http://localhost:8000/api/v1/clients
```

---

## Authentication

All protected endpoints require a valid JWT access token in the `Authorization` header:

```
Authorization: Bearer <your_access_token>
```

To get a token, send a `POST` request to `/api/v1/auth/login` with your email and password:

```json
{
  "email": "manager@mystudio.com",
  "password": "your-password"
}
```

The response includes an `access_token` (valid for 8 hours for desktop, 30 days for mobile) and a `refresh_token`.

When the access token expires, send the refresh token to `POST /api/v1/auth/refresh` to get a new access token without logging in again.

---

## Response format

All endpoints return JSON. Successful responses return the requested data directly.

Example successful response:

```json
{
  "id": 42,
  "full_name": "Jane Smith",
  "email": "jane@example.com",
  "status": "active"
}
```

---

## Error format

All error responses follow this structure:

```json
{
  "error": {
    "code": "BOOKING_CLASS_FULL",
    "message": "This class is full. Would you like to join the waitlist?",
    "details": {}
  }
}
```

Common error codes:

| Code | Meaning |
|---|---|
| `AUTH_INVALID_CREDENTIALS` | Wrong email or password |
| `AUTH_TOKEN_EXPIRED` | Access token has expired — refresh it |
| `AUTH_INSUFFICIENT_PERMISSIONS` | Your role doesn't allow this action |
| `BOOKING_CLASS_FULL` | No spots available in the class |
| `BOOKING_ALREADY_EXISTS` | Client is already booked for this class |
| `BOOKING_NO_MEMBERSHIP` | Client has no active membership or credits (also used for appointment booking) |
| `BOOKING_CANCELLATION_WINDOW_PASSED` | Too close to class start to cancel |
| `CHECKIN_NO_BOOKING` | No confirmed booking found for this client and class |
| `CHECKIN_OUTSIDE_WINDOW` | Outside the check-in time window |
| `CHECKIN_ALREADY_CHECKED_IN` | Client is already checked in |
| `WAIVER_SIGNATURE_REQUIRED` | Client has an unsigned required waiver and cannot book |
| `APPOINTMENT_SERVICE_INACTIVE` | The requested appointment service has been deactivated |
| `APPOINTMENT_INSTRUCTOR_INACTIVE` | The requested instructor's account is not active |
| `APPOINTMENT_IN_PAST` | Requested appointment start time is in the past |
| `APPOINTMENT_OUTSIDE_AVAILABILITY` | Requested time falls outside the instructor's availability |
| `APPOINTMENT_SLOT_CONFLICT` | Requested time overlaps another confirmed appointment (including buffer time) |
| `APPOINTMENT_ALREADY_CANCELLED` | Appointment is not in a confirmed state and cannot be cancelled again |
| `APPOINTMENT_NOT_CONFIRMED` | Appointment must be confirmed to be marked completed or no-show |
| `NOT_FOUND` | The requested resource does not exist |
| `VALIDATION_ERROR` | The request body is missing required fields or has invalid values |

---

## Interactive documentation (Swagger UI)

Agon's API includes interactive documentation powered by Swagger UI. When Agon is running, open this URL in your browser:

```
http://localhost:8000/docs
```

The Swagger UI lets you browse all available endpoints, see their parameters and response formats, and make test requests directly from your browser.

An alternative OpenAPI (ReDoc) view is also available at:

```
http://localhost:8000/redoc
```

---

## API versioning

All current endpoints are under `/api/v1/`. When breaking changes are introduced in a future version, they will be available under `/api/v2/` while `/api/v1/` remains active for a transition period.

---

## Related pages

- [Installation](../getting-started/installation)
- [Settings — Connectivity](../studio-manager/settings)
