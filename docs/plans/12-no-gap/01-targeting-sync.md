# 12/01 — Targeting sync

Plan folder: [`00-README.md`](00-README.md) · Model: Sonnet · Prerequisites: none · Parallel with: 12/02

## Decisions you need
L2, L3 — run `grep -E '^\| (L2|L3) ' docs/plans/12-no-gap/00-README.md`.

## Read first
- `CLAUDE_BACKEND_MONGODB.md` sections 3, 4, 7, 11, 13
- `web/src/{services/timerService,controllers/timerController,repositories/timerRepository}.js`, `web/shopify.js`, `web/test/timer-api.test.js`
- Current shopify.dev docs for app-data metafields (`currentAppInstallation`, `metafieldsSet`)

## Scope (files you own)
`web/src/{services,controllers,repositories,integrations}/**`, `web/test/**`

## Tasks
1. Shop-scoped repository query for enabled, not yet expired timers (projection, limit 101, `maxTimeMS`).
2. A pure builder for the L2 value, and the Admin GraphQL write behind one small module (client injected so tests need no network). `userErrors` count as failure.
3. Run it after create, update and delete (L3). The API response and status codes stay as they are.
4. Tests: value for each target type, expired and disabled excluded, the size and count fallback, called after each change, failure and timeout do not fail the request, nothing sensitive logged.

## Done when
- `tools/verify-slice.sh` passes. Append `## Result`.

## Result
Changed:
- `web/src/repositories/timerRepository.js`: `listTargetingTimers(shop, now, limit)` (projection, `maxTimeMS` 500; the caller passes 101).
- `web/src/services/targetSyncService.js` (new): `buildTargets` (L2) and `syncTargets` (never throws; 3 s per attempt, one retry; logs request id and error class only).
- `web/src/integrations/targetsMetafield.js` (new): installation id query and `metafieldsSet`; client injected.
- `web/src/controllers/timerController.js`: awaits the sync after create, update and delete; responses unchanged. `app.locals.adminClient` / `app.locals.logger` override the real ones in tests.
- `web/test/timer-api.test.js`, `web/test/target-sync.test.js` (new).

Checks: `tools/verify-slice.sh` passed (lint and `npm test`, with 12/02's in-progress changes in the tree).

Not checked: nothing was sent to Shopify, so the GraphQL operations and the real client are unverified until a store run. No `explain()` on the new query (it filters on the `{shop, enabled, targetType}` index prefix).

Notes:
- The metafield is written only after a timer change, so a shop with existing timers has none until its next change; the theme block then reserves space (L4).
- The request waits for the sync: up to about 6 s more if Shopify hangs.
- Concurrent changes in one shop can write out of order until the next change.
- Theme side: `app.metafields.countdown.targets.value`, ids are numeric strings, `s`/`e` epoch seconds (`s` rounded down, `e` up).
