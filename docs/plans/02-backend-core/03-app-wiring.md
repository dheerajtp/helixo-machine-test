# 02/03 — Security, health, metrics, shutdown, wiring

Plan folder: [`00-README.md`](00-README.md) · Model: Sonnet · Prerequisites: 02/02 · Parallel with: none

## Decisions you need
From the repo root run `grep -E '^\| (B1|B6|B7|B8|B11|B12) ' docs/plans/02-backend-core/00-README.md`.

## Read first
- `web/index.js`, `web/shopify.js`, `web/privacy.js`, `web/frontend/vite.config.js`
- The `## Result` of slices 01 and 02

## Scope (files you own)
`web/src/app.js`, `web/src/server.js`, `web/src/ops/**`, `web/index.js`, `web/test/**`, `web/package.json`, `package-lock.json`.

## Tasks
1. **`app.js`:** `createApp({shopify, config, logger, isShuttingDown, isDbReady})` so tests need no Shopify env. Order: request ID, request log, metrics timer, helmet, `/health`, `/ready`, `/metrics`, the existing Shopify auth routes, the existing webhook route (it needs the raw body: no JSON parser before it), `/api` session validation, `express.json({limit: "32kb"})`, existing demo routes unchanged, `/api` not found, CSP and static serving and the install check as now, central error handler last.
2. **Helmet** must not break admin embedding: disable its CSP and `X-Frame-Options`, keep `shopify.cspHeaders()`. No CORS middleware.
3. **`ops/health.js`:** `/health` 200; `/ready` 200 only if the database is ready and not shutting down, else 503 `NOT_READY`; both use the envelope and expose nothing internal.
4. **`ops/metrics.js`:** `prom-client` request duration histogram and error counter, labelled by route pattern (never raw paths). `/metrics` needs `Authorization: Bearer <METRICS_TOKEN>`, compared with `crypto.timingSafeEqual` on equal-length digests; otherwise 401 envelope.
5. **`server.js`:** load env file and config (exit 1 with the message on error), start listening and log the port, connect to MongoDB without blocking the listen. SIGTERM/SIGINT: mark shutting down, close the server, wait up to 10 s, disconnect, exit 0. `unhandledRejection` and `uncaughtException`: log and exit 1.
6. **`web/index.js`:** only imports and starts the server. `web/shopify.js` reads env at import, so load the env file before importing it.
7. **Tests** with `supertest` and a stub `shopify`: health, ready (ready, not ready, shutting down), metrics auth, helmet headers, 404 envelope, oversized body, webhook route still receives the raw body.

## Done when
- `npm ci`, `tools/verify-slice.sh` and `CI=true npm run build` pass.
- With fake values passed only on the command line and an unreachable `MONGO_URI`, the server starts, `/health` is 200, `/ready` is 503, and SIGTERM exits 0. With a missing variable it exits 1 and names it. Write no env file.
- Append `## Result`.
