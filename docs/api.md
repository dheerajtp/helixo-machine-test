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

A fixed timer's start cannot be in the past. On create, and on an update that changes `startAt`, a value more than 60 seconds before the server's clock is a `400 VALIDATION_ERROR` on `startAt`. An unchanged `startAt` is always accepted, so a running or expired timer can still be edited, disabled and enabled.

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

# Storefront API: app proxy

Used by the storefront widget only. The widget calls `/apps/countdown/timer` on the shop's own domain; Shopify's app proxy forwards it to `GET /proxy/timer` on this app and adds `shop`, `path_prefix`, `logged_in_customer_id`, `timestamp` and `signature`. Not under `/api`, and no session token.

## Authentication

The `signature` is verified with the app's API secret (Shopify library, `signator: "appProxy"`), and `timestamp` must be within 90 seconds. The shop is the signed `shop` value and must be a `*.myshopify.com` name. A missing, wrong, expired or malformed signature, or any parameter added after signing, is `401 UNAUTHORIZED`. Requests sent straight to the app, not through Shopify, therefore fail.

## Rate limit

300 requests per minute per shop and shopper IP, counted only after the signature passes. The shopper IP is the first `X-Forwarded-For` entry; without a valid one the key is the shop alone. In memory, per process, like the admin limit. Over the limit: `429 RATE_LIMITED` with `RateLimit` headers (draft-8).

## `GET /proxy/timer` (200)

| Query | Rules |
| --- | --- |
| `productId` | required; the numeric product id (digits, up to 20) |
| `collectionIds` | optional; comma-separated numeric collection ids of that product, at most 50 |

Other parameters, including the ones Shopify adds, are ignored.

The timer is the one enabled timer running now (`fixed`: `startAt <= now < endAt`; `evergreen`: always) that targets this product, one of these collections, or all products. A product timer beats a collection timer, which beats an all-products timer; within one level the most recently created wins. Timers of other shops are never considered.

`data` is the timer, or `null` when none applies (still `200`):

```json
{
  "success": true,
  "message": "Timer",
  "data": {
    "id": "665f1c2e9b1e8a0012345678",
    "type": "fixed",
    "endAt": "2030-02-01T00:00:00.000Z",
    "description": "Ends soon",
    "appearance": { "backgroundColor": "#ff0000", "size": "medium", "position": "top" },
    "urgencyEffect": "colorPulse",
    "urgencyThresholdSeconds": 300,
    "serverNow": "2030-01-15T12:00:00.000Z"
  },
  "meta": { "requestId": "3f0c2a9e-6f0b-4b8e-9d4e-2a6f1c7b9e10" }
}
```

An `evergreen` timer has `durationSeconds` (seconds) in place of `endAt`. `serverNow` is the server clock, for correcting the shopper's clock. `description` is plain text: render it as text, never HTML.

### Caching

- `200`: `Cache-Control: public, max-age=60`; for a `fixed` timer `max-age` is at most the whole seconds left until `endAt`.
- `ETag` identifies the timer and its last edit (`"none"` when `data` is `null`); it ignores `serverNow`. A matching `If-None-Match` gives `304 Not Modified` with no body.
- Errors (`400`, `401`, `404`, `429`, `500`) are `Cache-Control: no-store`.

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Missing or non-numeric `productId`, bad or more than 50 `collectionIds` |
| 401 | `UNAUTHORIZED` | Signature missing, wrong, expired or malformed |
| 404 | `NOT_FOUND` | Other path under `/proxy` (after the signature check) |
| 429 | `RATE_LIMITED` | Rate limit exceeded |
| 500 | `INTERNAL` | Unexpected error |
