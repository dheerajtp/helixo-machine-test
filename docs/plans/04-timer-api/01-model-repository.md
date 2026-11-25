# 04/01 — Model, migration, repository

Plan folder: [`00-README.md`](00-README.md) · Model: Sonnet · Prerequisites: none · Parallel with: none

## Decisions you need
D1, D4, D6, D7, D8: run `grep -E '^\| (D1|D4|D6|D7|D8) ' docs/plans/04-timer-api/00-README.md`.

## Read first
- `CLAUDE_BACKEND_MONGODB.md` sections 3, 5, 6, 7, 9, 19
- `web/src/repositories/sessionRepository.js`, `web/src/services/shopDataService.js`, `web/src/db/connection.js`
- `web/migrations/001-session-indexes.js`, `web/scripts/migrate.js`, `web/test/{migrations,session-repository,webhooks}.test.js`

## Scope (files you own)
`web/src/models/**`, `web/src/repositories/timer*`, `web/migrations/**`, `web/src/services/shopDataService.js`, `web/test/**`.

## Tasks
1. **`models/timer.js`:** Mongoose model, collection `timers`, strict, `timestamps: true`, no version key. Fields and limits from D1 as schema validators (enums, lengths, ranges, `targetIds` max 100), plus `sortAt` (Date, required). `shop` required. Declare the three D6/D7 indexes with the same names the migration creates. Cross-field rules belong to slice 02, not here.
2. **`migrations/002-timer-indexes.js`:** `up`/`down` in the style of 001, both safe to run twice. Update `migrations.test.js` for the second migration.
3. **`repositories/timerRepository.js`**, `shop` first in every function; return plain objects:
   - `createTimer(shop, data)`; `shop` from the argument always wins over `data`.
   - `findTimer(shop, id)` → timer or `null`.
   - `replaceTimer(shop, id, data)`: sets the given editable fields (a field set to `null` is unset) with validators, returns the new timer or `null`. Never changes `shop`, `type`, `_id`, `createdAt`.
   - `deleteTimer(shop, id)` → boolean.
   - `listTimers(shop, { limit, q, sort, after })`: `sort` is `oldest` (default) or `newest` on `(sortAt, _id)`; `after` is `{ sortAt: Date, id }` and returns rows strictly after it in that order; `q` is a case-insensitive substring of `name` with regex characters escaped; `limit` default 20, capped at 51 (the service asks for one extra). No `skip`.
   - `deleteTimersByShop(shop)`.
   - A missing or non-string `shop`, or an `id` that is not a 24-character hex string, never reaches a query (return `null`/`false`/`[]`; `createTimer` throws `TypeError`).
   - Projections on reads. `maxTimeMS` is already global.
4. **`redactShop` (D8)** also calls `deleteTimersByShop`.
5. **Tests** on a `mongodb-memory-server` replica set (binary 8.0.4): CRUD; shop A cannot read, replace or delete shop B's timer; paging through ties on `sortAt` in both orders with no duplicate or gap; `q` with `.*(` matches literally; operator objects never reach a query; schema rejects out-of-range values; `shop/redact` removes timers and spares another shop's. `explain()` shows the list query uses `{shop,sortAt,_id}`; record it in Result.

## Done when
- `tools/verify-slice.sh` passes.
- Append `## Result`, listing the repository signatures for slice 02.

## Result

**Files:** `web/src/models/timer.js`, `web/migrations/002-timer-indexes.js`, `web/src/repositories/timerRepository.js`, `web/src/services/shopDataService.js`, `web/test/timer-repository.test.js` (new), `web/test/migrations.test.js`.

**Checks:** `tools/verify-slice.sh`: LINT PASS, TESTS PASS (69 pass, 0 fail, 0 skipped). The migration ran only against `mongodb-memory-server`.

**explain() (MongoDB 8.0.4):** every list shape uses `shop_1_sortAt_1__id_1`, with no `SORT` or `COLLSCAN` stage. Oldest, oldest with cursor and `q`: `LIMIT > PROJECTION_SIMPLE > FETCH > IXSCAN` (forward). Newest: same, backward. Newest with cursor: `SORT_MERGE` of two backward `IXSCAN`s on that index. `q` is filtered after the fetch, scoped to one shop.

**Repository signatures** (`web/src/repositories/timerRepository.js`, named exports, plain objects):
- `createTimer(shop, data)` -> timer. Takes only editable fields, `sortAt`, `type`, `createdAt`. Throws `TypeError` on a bad shop, Mongoose `ValidationError` on bad data.
- `findTimer(shop, id)` -> timer | `null`
- `replaceTimer(shop, id, data)` -> new timer | `null`. Editable fields and `sortAt`; `undefined` leaves a field, `null` unsets it; `appearance` is replaced as a whole.
- `deleteTimer(shop, id)` -> boolean
- `listTimers(shop, { limit, q, sort, after: { sortAt: Date, id: string } })` -> timer[]; a malformed `after` gives `[]`.
- `deleteTimersByShop(shop)` -> boolean

**For slice 02:**
- A returned timer has `_id` (ObjectId), `shop`, `sortAt`, `type`, the editable fields, `createdAt`, `updatedAt`. Map to `id` and strip `shop`/`_id`/`sortAt`. Unset fields are absent.
- Evergreen `sortAt` = `createdAt`: pass the same `Date` as both to `createTimer`.
- The model requires `shop`, `name`, `type`, `targetType`, `appearance.backgroundColor`, `sortAt`. It applies the D1/D9 defaults (`enabled`, `size`, `position`, `description`, `urgencyEffect`, `urgencyThresholdSeconds`).
- A missing `targetIds` is stored as `[]` (Mongoose array default).
- Schema validators do not check GID format, integer seconds or cross-field rules.

**For slice 03:** reject control characters in `q`; a NUL byte cannot be encoded in a MongoDB regex and would give a 500.
