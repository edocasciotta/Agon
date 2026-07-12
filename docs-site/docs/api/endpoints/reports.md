---
title: Reports endpoints
sidebar_label: Reports
---

# Reports API

> Auto-generated from the OpenAPI spec. Run `node docs-site/scripts/fetch-openapi.js` to regenerate.

## `GET /api/v1/reports/attendance`

Get Attendance Report


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `start_date` | query | No |  |  |
| `end_date` | query | No |  |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `GET /api/v1/reports/revenue`

Get Revenue Report


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `start_date` | query | No |  |  |
| `end_date` | query | No |  |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `GET /api/v1/reports/memberships`

Get Memberships Report


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `start_date` | query | No |  |  |
| `end_date` | query | No |  |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `GET /api/v1/reports/retention`

Get Retention Report


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `start_date` | query | No |  |  |
| `end_date` | query | No |  |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `GET /api/v1/reports/attendance/export`

Export Attendance Csv


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `start_date` | query | No |  |  |
| `end_date` | query | No |  |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `GET /api/v1/reports/revenue/export`

Export Revenue Csv


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `start_date` | query | No |  |  |
| `end_date` | query | No |  |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---
