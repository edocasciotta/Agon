---
title: Tags endpoints
sidebar_label: Tags
---

# Tags API

> Auto-generated from the OpenAPI spec. Run `node docs-site/scripts/fetch-openapi.js` to regenerate.

## `GET /api/v1/tags`

List Tags




**Responses**

- **200** — Successful Response

---

## `POST /api/v1/tags`

Create Tag




**Responses**

- **201** — Successful Response
- **422** — Validation Error

---

## `PUT /api/v1/tags/{tag_id}`

Update Tag


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `tag_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `DELETE /api/v1/tags/{tag_id}`

Delete Tag


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `tag_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `GET /api/v1/clients/{client_id}/tags`

List Client Tags


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `client_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `POST /api/v1/clients/{client_id}/tags`

Assign Client Tag


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `client_id` | path | Yes | integer |  |



**Responses**

- **201** — Successful Response
- **422** — Validation Error

---

## `DELETE /api/v1/clients/{client_id}/tags/{tag_id}`

Remove Client Tag


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `client_id` | path | Yes | integer |  |
| `tag_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `GET /api/v1/auto-tag-rules`

List Auto Tag Rules




**Responses**

- **200** — Successful Response

---

## `POST /api/v1/auto-tag-rules`

Create Auto Tag Rule




**Responses**

- **201** — Successful Response
- **422** — Validation Error

---

## `PUT /api/v1/auto-tag-rules/{rule_id}`

Update Auto Tag Rule


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `rule_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---

## `DELETE /api/v1/auto-tag-rules/{rule_id}`

Delete Auto Tag Rule


**Parameters**

| Name | In | Required | Type | Description |
|------|-----|----------|------|-------------|
| `rule_id` | path | Yes | integer |  |



**Responses**

- **200** — Successful Response
- **422** — Validation Error

---
