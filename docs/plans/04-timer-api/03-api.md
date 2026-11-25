# 04/03 — Joi schemas, controllers, routes, API docs

Plan folder: [`00-README.md`](00-README.md) · Model: Sonnet · Prerequisites: 04/02 · Parallel with: none

## Decisions you need
D4, D5, D9: run `grep -E '^\| (D4|D5|D9) ' docs/plans/04-timer-api/00-README.md`.

## Read first
- `CLAUDE_BACKEND_MONGODB.md` sections 2, 3, 4, 17, 19
- `web/src/app.js`, `web/src/http/{validate,asyncHandler,responses,errors,errorHandler}.js`, `web/src/services/timerService.js`, `web/src/validators/timerDocument.js`, `web/test/app.test.js` (shopify stub), `## Result` of `02-service.md`

## Scope (files you own)
`web/src/routes/timers*`, `web/src/controllers/timer*`, `web/src/validators/timerRequests.js`, `web/src/app.js`, `web/test/**`, `docs/api.md`.

## Tasks
1. **`validators/timerRequests.js`:** create body, PATCH body, `:id` params (24 hex), list query (`limit` 1–50 default 20, `cursor` max 200, `q` max 100, `sort` `oldest`/`newest` default `oldest`). Build from slice 02's field schemas. `type` in a PATCH is forbidden (400), not silently dropped. PATCH must not apply create defaults.
2. **Controllers and routes:** `createTimersRouter()` with the shared `validate` and `asyncHandler`; pass `req.shop` and `req.validated` only; respond with `sendSuccess`. Create 201, others 200; list returns the array as `data` with `meta.pagination` `{ limit, nextCursor }`; delete returns `data: null`.
3. **`app.js`:** mount at `/api/timers` after the JSON parser and before the `/api` 404. Change nothing else.
4. **`docs/api.md`:** auth header, envelope, each endpoint with fields, limits, status codes, one example request and response, and the rate limit (100/minute per shop, per process).
5. **Tests** with supertest through `createApp`: full CRUD; 400 with field details; unknown fields stripped and `shop`, `_id`, `createdAt`, `sortAt`, `status` cannot be set; `{"name":{"$ne":null}}` and `?q[$ne]=x` give 400; shop B gets 404 on shop A's get, patch and delete and does not see it in the list; 401 without a token; pagination meta.

## Done when
- `tools/verify-slice.sh` passes.
- Append `## Result`.

## Result

**Files:** `web/src/validators/timerRequests.js`, `web/src/controllers/timerController.js`, `web/src/routes/timers.js`, `web/test/timer-api.test.js`, `docs/api.md` (all new), `web/src/app.js` (import and mount).

**Checks:** `tools/verify-slice.sh` exit 0: lint PASS, tests PASS (83 pass, 0 fail, 0 skipped), on `mongodb-memory-server` with a stubbed Shopify library. No real Shopify session was exercised.

**Notes**
- PATCH forbids `type` in the request schema, even when it equals the stored value (this replaces the note in 02's Result).
- Express 5's query parser keeps `q[$ne]` as a literal key, so the list schema rejects any key containing `[`.
- The create body schema is `timerSchema` itself.
- Open, not fixed (outside this slice): `web/src/ops/metrics.js` labels by `req.route.path`, so timer routes appear as `/` and `/:id` without the `/api/timers` prefix.
