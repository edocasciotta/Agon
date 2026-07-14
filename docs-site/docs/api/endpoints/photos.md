---
title: Photos endpoints
sidebar_label: Photos
---

# Photos API

> Auto-generated from the OpenAPI spec. Run `node docs-site/scripts/fetch-openapi.js` to regenerate.

## `GET /api/v1/photos/{filename}`

Get Photo

Serve a previously-uploaded profile photo (client or instructor).

Any authenticated role (manager/instructor/client) may fetch any photo —
profile photos are visible across the studio (e.g. a client viewing an
instructor's profile), not owner-restricted. Unauthenticated requests are
rejected (401).

The filename path param is never trusted directly: it is sanitized
(basename + allow-list + commonpath containment check) before being used
to build a filesystem path, per docs/SECURITY_GUIDELINES.md §4.1 — defence
in depth even though it is expected to be one of our own generated names.


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `filename` | path | Yes | string |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---
