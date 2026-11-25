# 03 — Shopify auth, tenancy and webhooks

Master plan: [`../../PLAN.md`](../../PLAN.md) · Builds on: [02](../02-backend-core/00-README.md)

## Goal
- Only verified shops reach the admin API, and each sees only its own data

## Decisions (already made; do not revisit)
| # | Decision |
| --- | --- |
| C1 | **Sessions (owner, 2026-11-26).** Own store in `web/src/repositories/sessionRepository.js` on the shared Mongoose connection, collection `shopify_sessions`, implementing Shopify's `SessionStorage` interface (`storeSession`, `loadSession`, `deleteSession`, `deleteSessions`, `findSessionsByShop`) with schema validation. No new dependency; the Mongo session package is not used. Remove the SQLite storage; its sessions are not migrated. |
| C2 | **Admin auth.** `/api/*` (not `/api/auth*`, not `/api/webhooks`) first verifies the session token (`Authorization: Bearer`); missing or invalid gives 401 `UNAUTHORIZED` envelope. Then the library's `validateAuthenticatedSession` (its 403 re-authorize response stays, App Bridge needs it). `req.shop` comes only from the verified session and must match the token's `dest`. A client-sent shop never selects data. |
| C3 | **Scoping.** Every repository function takes `shop` as its first argument and filters by it. Only exception: the interface methods keyed by session id (`storeSession`, `loadSession`, `deleteSession`, `deleteSessions`). |
| C4 | **Webhooks.** `app/uninstalled` deletes the shop's sessions (the library's built-in handler does it through C1); `shop/redact` deletes all shop data through `shopDataService.redactShop(shop)`, taking `shop` from the signed body (`shop_domain`), not the unsigned header; `customers/data_request` and `customers/redact` acknowledge only (no customer data is stored). All HMAC-verified and idempotent; bad HMAC gets 401. Plans that add shop data add it to `redactShop`. |
| C5 | **Scopes.** `read_products` only. The template's "populate products" demo stops working until plan 05 removes it. |
| C6 | **Rate limit.** `/api/*` after auth: 100 requests/minute per shop, 429 `RATE_LIMITED` envelope. `express-rate-limit`, in-memory store (single instance; documented). Webhooks and OAuth are not limited. |
| C7 | **Tokens (owner, 2026-11-26).** `future.expiringOfflineAccessTokens` on; the session store keeps `refreshToken` and `refreshTokenExpires`. |
| C8 | **Indexes.** Production and development build no indexes at boot (`autoIndex` off), so indexes come from versioned, idempotent, reversible migrations in `web/migrations/`, run by `npm run migrate -w shopify-app-template-node` (`down` reverses the last). The owner runs it; workers never run it against the real database. |

## Status
- [x] 01 — Session store, migrations, admin auth, rate limit
- [x] 02 — Webhooks, shop data cleanup, scopes
- [x] 03 — Acceptance

## Dependencies and parallel tracks
| Slice | Prerequisites | Parallel with | Model | Files touched |
| --- | --- | --- | --- | --- |
| 01 | none | none | Opus | `web/shopify.js`, `web/src/{auth,repositories,app.js}`, `web/src/http/rateLimit.js`, `web/migrations/**`, `web/scripts/**`, `web/test/**`, `web/package.json`, lockfile |
| 02 | 01 | none | Sonnet | `web/src/{webhooks,services}/**`, `web/src/app.js`, `web/privacy.js`, `web/test/**`, `shopify.app.toml` |
| 03 | all above | none | Opus | this plan folder, `docs/**` |

**Rules for every slice:** follow `CLAUDE.md` and `CLAUDE_BACKEND_MONGODB.md`; never commit; never read or change `web/config/`; never run Docker or the migration against the real database.

## Acceptance checklist
- [x] `/api/*` without a valid token returns 401
- [x] A client-sent shop never returns another shop's data
- [x] The 101st request in a minute from one shop returns 429; another shop is unaffected
- [x] A forged webhook returns 401; a replayed one has no extra effect
- [x] Sessions, including the refresh token, round-trip through MongoDB
- [x] MANUAL: run the migration, reinstall on the dev store, the app loads and still loads after a server restart
- [x] MANUAL: uninstalling on the dev store removes the shop's sessions
