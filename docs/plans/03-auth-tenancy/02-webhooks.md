# 03/02 — Webhooks, shop data cleanup, scopes

Plan folder: [`00-README.md`](00-README.md) · Model: Sonnet · Prerequisites: 03/01 · Parallel with: none

## Decisions you need
C3, C4, C5: run `grep -E '^\| (C3|C4|C5) ' docs/plans/03-auth-tenancy/00-README.md`.

## Read first
- `CLAUDE_BACKEND_MONGODB.md` sections 2, 9, 13
- `web/privacy.js`, `web/src/app.js`, `web/src/repositories/sessionRepository.js`, `shopify.app.toml`, `## Result` of `01-sessions-auth.md`
- In `node_modules/@shopify`: `shopify-app-express/dist/esm/webhooks/{index,process}.mjs`, `middlewares/ensure-installed-on-shop.mjs` (`deleteAppInstallationHandler`); `shopify-api/dist/esm/lib/webhooks/process.mjs`

## Scope (files you own)
`web/src/webhooks/**`, `web/src/services/**`, `web/src/app.js`, `web/privacy.js`, `web/test/**`, `shopify.app.toml`.

## Tasks
1. **`services/shopDataService.js`:** `redactShop(shop)` deletes every record of that shop (today: sessions, through the repository). Safe to run twice. A comment says later plans add their repositories here.
2. **`webhooks/privacy.js`** replaces `web/privacy.js` (delete it) and `app.js` imports it. `SHOP_REDACT`: parse the body, validate with Joi (`shop_domain` string ending `.myshopify.com`, unknown keys allowed), call `redactShop` with `shop_domain` from the signed body, never the header argument. An invalid body is logged without the payload and acknowledged. A database failure throws, so Shopify gets a non-200 and retries. The two customer topics do nothing and acknowledge. Never log bodies.
3. **`app/uninstalled`:** do not add a second handler; the library registers one that deletes sessions via the store. Prove it with a test.
4. **`shopify.app.toml`:** `scopes = "read_products"`; under `[webhooks]` add subscriptions for `app/uninstalled` and `compliance_topics = ["customers/data_request", "customers/redact", "shop/redact"]`, all with `uri = "/api/webhooks"`. Change nothing else; do not run `shopify app deploy`.
5. **Tests** through the real `shopifyApp(...).processWebhooks` with test API key and secret and the real repository on `mongodb-memory-server`: correctly signed requests (HMAC-SHA256 base64 of the raw body, Shopify webhook headers) for each topic; bad HMAC gets 401 and deletes nothing; the same delivery twice has the same end state; another shop's data survives; a forged shop header on `shop/redact` does not change which shop is deleted.

## Done when
- `tools/verify-slice.sh` passes; `web/privacy.js` is gone and nothing imports it.
- Append `## Result`, including whether a database failure really returns non-200.

## Result

**Files changed:** `web/src/app.js`, `shopify.app.toml`, `web/src/repositories/sessionRepository.js` (only `deleteSessionsByShop` added), `web/test/session-repository.test.js`. **New:** `web/src/services/shopDataService.js`, `web/src/webhooks/privacy.js`, `web/test/webhooks.test.js`. **Deleted:** `web/privacy.js`.

**Scope addition (from the orchestrator):** `deleteSessionsByShop(shop)` is exported separately from `sessionStorage` (not part of Shopify's interface, uncapped); `redactShop` uses it.

**Checks**
- `tools/verify-slice.sh` -> LINT: PASS, TESTS: PASS (57/57)
- No import of `web/privacy.js` is left in code; the file is gone.
- `shopify app deploy` was **not** run, so the TOML scopes and subscriptions are not live and not validated by the Shopify CLI. No real Shopify delivery was tested.

**Database failure:** yes, it returns non-200. A rejected `deleteMany` during `shop/redact` gave HTTP 500 through the real `processWebhooks`, and redelivery then returned 200 and deleted the data. The failure was injected by mocking `deleteMany`, not by stopping MongoDB. The library logs the error message itself (`Failed to process webhook: ...`).

**Notes**
- `webhooks/privacy.js` exports a factory, `privacyWebhookHandlers(logger)`. The library passes no request to callbacks, so the invalid-payload log line carries `webhookId`, not the request ID.
- `app/uninstalled` uses only the library's handler. It takes the shop from the header and deletes through `findSessionsByShop`, so it removes at most 100 sessions per delivery; `shop/redact` has no cap.
- Later plans: add each new shop-scoped delete to `redactShop` in `web/src/services/shopDataService.js`.
- Outside Scope, for the owner or a later slice: `eslint.config.js` still names `web/privacy.js` in the `no-unused-vars` override (harmless, stale); `SCOPES` in the web env file should be `read_products` where it is not injected by the Shopify CLI.
