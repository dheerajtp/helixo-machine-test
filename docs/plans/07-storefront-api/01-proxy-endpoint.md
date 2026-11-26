# 07/01 — Proxy verification, selection service, endpoint, docs

Plan folder: [`00-README.md`](00-README.md) · Model: Opus · Prerequisites: none · Parallel with: none

## Decisions you need
All: run `grep -E '^\| G[0-9] ' docs/plans/07-storefront-api/00-README.md`.

## Read first
- `CLAUDE_BACKEND_MONGODB.md` sections 2, 3, 7, 10, 11, 15, 17, 19
- `web/src/app.js`, `web/src/http/{validate,rateLimit,responses,errors,errorHandler,asyncHandler}.js`, `web/src/{models/timer,repositories/timerRepository}.js`, `web/frontend/vite.config.js`, `shopify.app.toml`, `docs/api.md`
- `node_modules/@shopify/shopify-api/dist/esm/lib/utils/hmac-validator.mjs` (`signator: 'appProxy'`, 90 s timestamp window)
- Current shopify.dev docs for app proxy configuration and the parameters Shopify appends

## Scope (files you own)
`web/src/{routes,controllers,validators,services,auth}/{proxy,storefront}*`, `web/src/repositories/timer*`, `web/src/http/rateLimit.js`, `web/src/app.js`, `web/frontend/vite.config.js`, `web/test/**`, `shopify.app.toml`, `docs/api.md`.

## Tasks
1. **`auth/proxy*`:** verify the signature with the library. Missing, wrong, expired or malformed is 401 in the envelope; never 500. `req.shop` comes from the signed `shop` and must be a `*.myshopify.com` name. Never log the query or signature.
2. **Validation (Joi, after the signature):** `productId` digits, required; `collectionIds` optional, comma-separated digits, max 50. Convert to GIDs. Parameters Shopify appends are accepted and stripped.
3. **Repository and service (G2):** one shop-scoped query for candidates (enabled, targeting this product, these collections or all; fixed only when `startAt <= now < endAt`), projection of the needed fields, `maxTimeMS(500)`, bounded. Priority product, collection, all; newest `createdAt` within a level. A newer timer at a lower level never beats a higher one, even with many timers. Run `explain()` and record which index serves it; if an index is missing, report it rather than adding a migration.
4. **Response:** `GET /proxy/timer`, shared envelope, `data` is exactly G3 or `null`. `Cache-Control` and `ETag` per G4: the ETag covers the timer fields only (not `serverNow` or `requestId`); matching `If-None-Match` gives 304. A fixed timer's `max-age` is at most the whole seconds left. Errors are `no-store`.
5. **Rate limit (G5, G7):** its own limiter, after verification.
6. **Wiring:** mount in `app.js` outside `/api`, before the static and install checks. Add the dev proxy rule for `/proxy` in `vite.config.js`.
7. **`shopify.app.toml`:** add `write_app_proxy` to scopes and `[app_proxy]` with `url = "/proxy"`, `prefix = "apps"`, `subpath = "countdown"`. Change nothing else; never deploy.
8. **Docs:** add the endpoint to `docs/api.md`.
9. **Tests** with supertest through `createApp`, signing requests with a test secret: bad, missing and expired signature; priority and tie-break; disabled, scheduled and expired excluded; other shop's timers never returned; exact payload keys; headers and 304; validation errors; limiter. Time 100 sequential requests with 500 timers on `mongodb-memory-server` and record the slowest.

## Done when
- `tools/verify-slice.sh` and `CI=true npm run build` pass.
- Append `## Result`, including the exact response shape for plan 08 and what only a real store can confirm.

## Result

**Files.** New: `web/src/auth/proxy.js`, `web/src/validators/proxyRequests.js`, `web/src/services/storefrontService.js`, `web/src/controllers/proxyController.js`, `web/src/routes/proxy.js`, `web/test/storefront-proxy.test.js`. Changed: `web/src/repositories/timerRepository.js` (`findStorefrontTimer`), `web/src/http/rateLimit.js` (`createProxyRateLimiter`, shared 429 handler), `web/src/app.js` (mount `/proxy` + `/proxy` 404 before `/api`, static and install check), `web/frontend/vite.config.js` (`^/proxy` rule), `shopify.app.toml` (scopes `read_products,write_app_proxy`; `[app_proxy]` url `/proxy`, prefix `apps`, subpath `countdown`), `docs/api.md` (storefront section).

**Checks.**
- `tools/verify-slice.sh` → LINT: PASS, TESTS: PASS (125 pass, 0 fail)
- `CI=true npm run build` → PASS
- 100 sequential requests, 500 timers, mongodb-memory-server 8.0.4: slowest 3.6–4.2 ms (asserted < 200 ms).
- `explain("executionStats")` on the aggregation (500 timers, 2 shops): winning plan `IXSCAN shop_1_enabled_1_targetType_1` → FETCH; keys/docs examined = the shop's enabled timers. No missing index; no migration.

**How it works.**
- Chain under `/proxy`: `Cache-Control: no-store` → signature (`shopify.api.utils.validateHmac({...req.query}, { signator: "appProxy" })`; throw or false → 401; `shop` must match `^[a-z0-9][a-z0-9-]*\.myshopify\.com$`) → limiter (300/min, key `shop|ipKeyGenerator(first X-Forwarded-For)` or `shop`) → Joi → controller.
- Selection is one aggregation: `$match` (shop, enabled, target or-clause, evergreen or `startAt <= now < endAt`) → rank via `$indexOfArray(["products","collections","all"])` → `$sort {rank, createdAt:-1, _id:-1}` → `$limit 1` → `$project`, `maxTimeMS 500`. Ranking happens in the database, so many newer lower-rank timers cannot crowd out a higher one.
- ETag is `"<id>-<updatedAt ms>"` (or `"none"` for null), not a content hash: avoids sync crypto in the request path; changes whenever any timer field is edited through the app (Mongoose bumps `updatedAt`). A raw DB edit that skips `updatedAt` would not change it. Express answers the 304 itself from that ETag.

**Response shape for plan 08** (`GET /apps/countdown/timer?productId=<digits>&collectionIds=<digits,digits>`):
```json
{ "success": true, "message": "Timer",
  "data": { "id": "<24 hex>", "type": "fixed", "endAt": "<ISO>",
            "description": "<text>", "appearance": { "backgroundColor": "#rrggbb", "size": "small|medium|large", "position": "top|bottom" },
            "urgencyEffect": "colorPulse|blinkingText|none", "urgencyThresholdSeconds": 300, "serverNow": "<ISO>" },
  "meta": { "requestId": "<uuid>" } }
```
Evergreen: `durationSeconds` (number) instead of `endAt`; the other key is absent, not null. No timer: `data: null`, message `"No active timer"`, 200, `max-age=60`. `productId`/`collectionIds` are numeric ids (not GIDs); the server converts.

**Only a real store can confirm.** That Shopify forwards `/apps/countdown/timer` to `/proxy/timer` with the expected params and signature; which `X-Forwarded-For` entry Shopify puts first, and whether it keeps a shopper-sent one (if kept, the per-IP key is spoofable; marked `shortcut:` in `rateLimit.js`); whether Shopify's proxy passes `Cache-Control`/`ETag`/304 through unchanged; real latency through the proxy; that `write_app_proxy` is granted on reinstall after `shopify app deploy` (not run).
