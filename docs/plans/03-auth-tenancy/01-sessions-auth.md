# 03/01 — Session store, migrations, admin auth, rate limit

Plan folder: [`00-README.md`](00-README.md) · Model: Opus · Prerequisites: none · Parallel with: none

## Decisions you need
C1, C2, C3, C6, C7, C8: run `grep -E '^\| (C1|C2|C3|C6|C7|C8) ' docs/plans/03-auth-tenancy/00-README.md`.

## Read first
- `CLAUDE_BACKEND_MONGODB.md` sections 3, 5, 6, 7, 9, 10, 19
- `web/shopify.js`, `web/src/app.js`, `web/src/server.js`, `web/src/db/connection.js`, `web/src/config.js`, `web/src/http/{errors,responses,asyncHandler}.js`, `web/test/app.test.js` (shopify stub)
- In `node_modules/@shopify`: `shopify-app-express/dist/esm/middlewares/validate-authenticated-session.mjs`; `shopify-api/dist/esm/lib/session/session.mjs` (constructor, `toObject`)

## Scope (files you own)
`web/shopify.js`, `web/src/auth/**`, `web/src/repositories/**`, `web/src/app.js`, `web/src/http/rateLimit.js`, `web/migrations/**`, `web/scripts/**`, `web/test/**`, `web/package.json`, `package-lock.json`.

## Tasks
1. **`repositories/sessionRepository.js`:** Mongoose model, collection `shopify_sessions`, strict schema: `id` (String, required), `shop` (String, required), `state`, `isOnline` (Boolean), `scope`, `expires` (Date), `accessToken`, `refreshToken`, `refreshTokenExpires` (Date), `onlineAccessInfo` (Mixed). Indexes declared: unique `{id:1}`, `{shop:1,id:1}`. Export one object `sessionStorage` with the five interface methods. `storeSession` is an upsert replace by `id` with validators, writes only schema fields, and retries once on duplicate key 11000. Reads use projections, `lean`, and return `new Session(...)` or `undefined`. `findSessionsByShop(shop)` is capped at 100. Arguments that are not non-empty strings (arrays of them for `deleteSessions`) never reach a query. Never log session contents.
2. **Migrations (C8):** `web/migrations/001-session-indexes.js` exports `up(db)` and `down(db)`; both are safe to run twice. `web/scripts/migrate.js` (`up` default, `down` reverses the last applied) records applied names in a `migrations` collection, loads config with `loadEnvFile`/`loadConfig`, uses the shared connection helpers, exits non-zero on failure, and never prints the URI. Add the `migrate` script to `web/package.json`. `connect()` retries forever: give the script its own overall time limit.
3. **`shopify.js`:** use `sessionStorage` from task 1; `future: { expiringOfflineAccessTokens: true }` where both `shopify-app-express` and `shopify-api` read it (check the library code; the boot log must stop saying the flag is disabled). Remove the SQLite import, `DB_PATH` and the `@shopify/shopify-app-session-storage-sqlite` dependency (`npm uninstall -w shopify-app-template-node`).
4. **`auth/requireShop.js` (C2):** two middlewares around the library's: `verifySessionToken(shopify)` uses `shopify.api.session.decodeSessionToken`; `attachShop` sets `req.shop`. Never log the token.
5. **`http/rateLimit.js` (C6):** `express-rate-limit` (install it), `windowMs` 60000, `limit` 100, key `req.shop`, standard headers on, response through `sendError`. A factory, so each app instance has its own store.
6. **`app.js`:** on `/api`: token check, library session check, `attachShop`, limiter, then the JSON parser. Order of the OAuth and webhook routes above stays.
7. **Tests:** repository against `mongodb-memory-server` replica set, MongoDB 8.0 binary as in `web/test/db-connection.test.js` (round-trip of every field including both token dates, replace on same id, delete one and many, find by shop never returns another shop, operator objects rejected); migration up twice, down twice, unique index enforced; auth with a stub library: no token, bad token, valid token, `dest`/session mismatch, `?shop=` of another shop never reaches `req.shop`; limiter: 101st is 429, other shop is 200. Update the stub in `app.test.js`.

## Done when
- `npm ci` and `tools/verify-slice.sh` pass; `npm audit --audit-level=high` passes; no `sqlite` import or dependency is left in `web/`.
- Append `## Result`, naming the repository exports for slice 02.

## Result

**Files changed:** `web/shopify.js`, `web/src/app.js`, `web/package.json`, `package-lock.json`, `web/test/app.test.js`. **New:** `web/src/repositories/sessionRepository.js`, `web/src/auth/requireShop.js`, `web/src/http/rateLimit.js`, `web/migrations/001-session-indexes.js`, `web/scripts/migrate.js`, `web/test/session-repository.test.js`, `web/test/migrations.test.js`, `web/test/auth.test.js`.

**Checks**
- `tools/verify-slice.sh` → LINT: PASS, TESTS: PASS (48/48)
- `npm ci` → PASS
- `npm audit --audit-level=high` → PASS (exit 0; 3 moderate in frontend deps i18next / react-router, already there before this slice)
- `grep -rni sqlite web --exclude-dir=node_modules` → no matches; `package-lock.json` has no sqlite entry
- Boot check (importing `shopify.js` with dummy env): only "Future flag tokenExchange is disabled" is logged; `expiringOfflineAccessTokens` is no longer reported as disabled.
- `npm run migrate` was **not** run against any real database (C8: the owner runs it). The runner is tested against mongodb-memory-server only.

**Notes and surprises**
- `expiringOfflineAccessTokens` is read only by `shopify-app-express`, from the top-level `shopifyApp({ future })`. It then passes `expiring` into `shopify-api`'s token calls. `shopify-api` has no future flag with this name, so the flag is set in one place only.
- Library 403 re-authorize, `?shop=` mismatch redirect and offline-token refresh are untouched. `verifySessionToken` runs first and returns 401 `UNAUTHORIZED` when the token is missing, not `Bearer <token>`, fails to decode, or has no usable `dest`. `attachShop` returns 401 when there is no session or `session.shop !== token dest host`.
- `web/database.sqlite` (gitignored, untracked) is still on disk; it is outside Scope and was not deleted.
- The migration uses the default index names (`id_1`, `shop_1_id_1`), so it does not conflict with what Mongoose builds when `autoIndex` is on in test.

**Facts for slice 02**
- `import { sessionStorage } from "web/src/repositories/sessionRepository.js"`: a frozen object with `storeSession(session) → true` (throws `TypeError` when `id`/`shop` are not non-empty strings), `loadSession(id) → Session | undefined`, `deleteSession(id) → boolean`, `deleteSessions(ids) → boolean`, `findSessionsByShop(shop) → Session[]` (max 100, sorted by id). Invalid arguments return `undefined` / `false` / `[]` and never run a query.
- The collection is `shopify_sessions`. The Mongoose model is named `ShopifySession` (not exported). Indexes: unique `{id:1}`, `{shop:1,id:1}`, so `deleteMany({ shop })` for `app/uninstalled` would need a new shop-scoped repository function, added in slice 02's own scope.
- `req.shop` is set on every `/api/*` request after auth. Limiter: `createApiRateLimiter()` from `web/src/http/rateLimit.js`.
- Migrations: `npm run migrate -w shopify-app-template-node` (`-- down` reverses the last applied). Applied names are stored in the `migrations` collection. Runner exports: `migrateUp(db, dir?)` and `migrateDown(db, dir?)`.
