# Admin API: timers

Base path `/api/timers`. Used by the embedded admin app only.

## Authentication

Every request needs `Authorization: Bearer <Shopify session token>` (App Bridge). The shop is taken from the verified session; a `shop` value sent by the client is ignored. A missing or invalid token is `401 UNAUTHORIZED`. If the shop's stored session is no longer valid, the Shopify library answers `403` with its re-authorize headers (not the envelope below).

## Rate limit

100 requests per minute per shop, shared by all `/api` routes. The counter is in memory, so it is per process and resets on restart. Over the limit: `429 RATE_LIMITED`, with `RateLimit` headers (draft-8).

## Envelope

Success:

```json
{ "success": true, "message": "Timer", "data": {}, "meta": { "requestId": "uuid" } }
```

Error:

```json
{
  "success": false,
  "message": "Validation failed",
  "error": { "code": "VALIDATION_ERROR", "details": [{ "field": "endAt", "message": "\"endAt\" must be after startAt" }] },
  "meta": { "requestId": "uuid" }
}
```

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Invalid body, id, query or cursor; malformed JSON; keys starting with `$` or containing `.` |
| 401 | `UNAUTHORIZED` | Missing or invalid session token |
| 404 | `NOT_FOUND` | No such timer, including another shop's |
| 413 | `PAYLOAD_TOO_LARGE` | Body over 32 KB |
| 429 | `RATE_LIMITED` | Rate limit exceeded |
| 500 | `INTERNAL` | Unexpected error |

## Timer fields

Send JSON with `Content-Type: application/json`. Unknown fields, including `shop`, `_id`, `status`, `createdAt` and `updatedAt`, are ignored. Text is trimmed, must not contain control characters, and is stored as written: render it as text, never HTML.

| Field | Rules | Default on create |
| --- | --- | --- |
| `name` | 1–100 characters | required |
| `type` | `fixed` or `evergreen`; cannot be changed | required |
| `enabled` | boolean | `true` |
| `startAt`, `endAt` | `fixed` only, both required; ISO 8601 with a timezone; `endAt` after `startAt` | |
| `durationSeconds` | `evergreen` only, required; integer 60–2592000 | |
| `targetType` | `all`, `products` or `collections` | required |
| `targetIds` | 1–100 unique `gid://shopify/Product/<digits>` or `gid://shopify/Collection/<digits>` matching `targetType`; always `[]` for `all` | required unless `all` |
| `description` | up to 120 characters, may be empty | `""` |
| `appearance.backgroundColor` | `#RRGGBB` | required |
| `appearance.size` | `small`, `medium` or `large` | `medium` |
| `appearance.position` | `top` or `bottom` of the app block | `top` |
| `urgencyEffect` | `colorPulse`, `blinkingText` or `none` | `colorPulse` |
| `urgencyThresholdSeconds` | integer 0–86400 | `300` |

Responses also carry `id`, `createdAt`, `updatedAt` and `status`: `scheduled`, `active`, `expired` or `disabled`, computed at request time. `startAt`, `endAt` and `durationSeconds` are `null` when they do not apply; leave them out when sending a timer back, as `null` is rejected.

`:id` is 24 hexadecimal characters.

## Endpoints

### `GET /api/timers` (200)

| Query | Rules | Default |
| --- | --- | --- |
| `limit` | 1–50 | `20` |
| `cursor` | `nextCursor` of the previous page, up to 200 characters; use with the same `sort` and `q` | first page |
| `q` | case-insensitive name search, literal text, up to 100 characters | none |
| `sort` | `oldest` or `newest` by start date (evergreen: creation date) | `oldest` |

`data` is an array of timers. `meta.pagination` is `{ "limit": 20, "nextCursor": null }`; `nextCursor` is `null` on the last page. Other query parameters are ignored, except bracketed ones such as `q[x]`, which are a 400.

### `POST /api/timers` (201)

Body: a complete timer. Returns the created timer.

### `GET /api/timers/:id` (200)

Returns the timer.

### `PATCH /api/timers/:id` (200)

Body: only the fields to change, at least one. `type` is not allowed. `appearance` is merged key by key. The merged timer must satisfy all the rules above, so switching `targetType` to `products` or `collections` needs matching `targetIds`. Returns the updated timer.

### `DELETE /api/timers/:id` (200)

Deletes permanently. `data` is `null`.

## Example

```http
POST /api/timers
Authorization: Bearer <session token>
Content-Type: application/json

{
  "name": "Winter sale",
  "type": "fixed",
  "startAt": "2030-01-01T00:00:00Z",
  "endAt": "2030-02-01T00:00:00Z",
  "targetType": "products",
  "targetIds": ["gid://shopify/Product/1"],
  "appearance": { "backgroundColor": "#ff0000" }
}
```

`201 Created`

```json
{
  "success": true,
  "message": "Timer created",
  "data": {
    "id": "665f1c2e9b1e8a0012345678",
    "name": "Winter sale",
    "type": "fixed",
    "enabled": true,
    "startAt": "2030-01-01T00:00:00.000Z",
    "endAt": "2030-02-01T00:00:00.000Z",
    "durationSeconds": null,
    "targetType": "products",
    "targetIds": ["gid://shopify/Product/1"],
    "description": "",
    "appearance": { "backgroundColor": "#ff0000", "size": "medium", "position": "top" },
    "urgencyEffect": "colorPulse",
    "urgencyThresholdSeconds": 300,
    "createdAt": "2029-12-01T10:00:00.000Z",
    "updatedAt": "2029-12-01T10:00:00.000Z",
    "status": "scheduled"
  },
  "meta": { "requestId": "3f0c2a9e-6f0b-4b8e-9d4e-2a6f1c7b9e10" }
}
```
