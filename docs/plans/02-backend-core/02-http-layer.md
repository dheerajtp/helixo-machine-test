# 02/02 — Responses, errors, validation, request ID, logging

Plan folder: [`00-README.md`](00-README.md) · Model: Sonnet · Prerequisites: 02/01 · Parallel with: none

## Decisions you need
From the repo root run `grep -E '^\| (B1|B4|B5|B6|B12) ' docs/plans/02-backend-core/00-README.md`.

## Read first
- `CLAUDE_BACKEND_MONGODB.md` sections 2, 3, 17, 18
- `web/index.js`, the `## Result` of `01-config-docker-db.md`

## Scope (files you own)
`web/src/http/**`, `web/test/**`, `web/package.json`, `package-lock.json`.

## Tasks
1. **`responses.js`:** `sendSuccess(res, {status=200, message, data=null, pagination})` and `sendError(res, {status, code, message, details})`, producing exactly the envelope in rules section 17, with `meta.requestId` from `req.id`.
2. **`errors.js`:** `AppError(code, message, details)` with the status taken from the B4 code table (one exported map).
3. **`errorHandler.js`:** `notFound` (for `/api`) and the central handler. Joi errors give `VALIDATION_ERROR` with `{field, message}`; body-parser errors give 400 or `PAYLOAD_TOO_LARGE`; unknown errors give a generic 500 and are logged with the stack. Never send stacks or database messages. If headers are already sent, delegate to `next`.
4. **`asyncHandler.js`.**
5. **`validate.js`:** `validate({body, query, params, headers})` Joi middleware with the options in rules section 2. Express 5 makes `req.query` read-only: put sanitized values in `req.validated.{body,query,params,headers}`. Header schemas allow unknown headers. An empty body on PATCH is rejected. Reject keys starting with `$` or containing `.` anywhere in the input.
6. **`requestId.js`:** accept an incoming `X-Request-Id` only if it is a UUID, else `crypto.randomUUID()`; set `req.id` and the response header.
7. **`logger.js`:** pino with redaction of authorization, cookie, password, token, secret and API key fields; request logging middleware with request ID, method, path without query string, status and duration.
8. **Tests** with `supertest` on a small in-test Express app: both envelopes, each error mapping, validation (unknown fields stripped, operator keys rejected, empty PATCH), request ID, redaction.

## Done when
- `npm ci` and `tools/verify-slice.sh` pass.
- Append `## Result` with the exported names for slice 03.
