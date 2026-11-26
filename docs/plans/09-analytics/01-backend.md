# 09/01 — Models, migration, repository, service, endpoints, cleanup

Plan folder: [`00-README.md`](00-README.md) · Model: Opus · Prerequisites: none · Parallel with: 09/02

## Decisions you need
I1–I8: run `grep -E '^\| I[1-8] ' docs/plans/09-analytics/00-README.md`.

## Read first
- `CLAUDE_BACKEND_MONGODB.md` sections 2, 3, 5–10, 17, 19
- `web/src/routes/{proxy,timers}.js`, `web/src/{auth/proxy,http/rateLimit,http/validate,app}.js`, `web/src/models/timer.js`, `web/src/repositories/timerRepository.js`, `web/src/services/{timerService,shopDataService}.js`
- `web/migrations/002-timer-indexes.js`, `web/scripts/migrate.js`, `web/test/{storefront-proxy,migrations}.test.js`

## Scope (files you own)
`web/src/**`, `web/migrations/**`, `web/test/**` (not `web/test/impression-client*`), `docs/api.md`

## Tasks
1. **Models** `impression_keys` {shop, timerId, sessionId, createdAt} and `timer_stats` {shop, timerId, day `YYYY-MM-DD` UTC, count}. **Migration 003:** unique `{shop,timerId,sessionId}`, TTL 86400 s on `createdAt`, unique `{shop,timerId,day}`; safe to run twice. Update `migrations.test.js`.
2. **Record (I3):** one transaction with majority read/write concern: insert the key, then upsert `$inc` the day. A duplicate key means already counted: no increment, success. Retry only the driver's transient transaction errors, bounded; a concurrent first write of a day must not lose a count.
3. **`POST /proxy/impressions`:** after the existing signature check; its own limiter (60/minute per shop and shopper IP, same key rule as the timer limiter) without using up the timer route's 300; a JSON parser limited to 1 KB on this route only; Joi body; timer must belong to the signed shop, else 404; 202; `no-store`. The existing GET behaviour and headers stay unchanged.
4. **`GET /api/timers/stats`** (I5, I6), registered before `/:id`; one aggregation for all ids, `maxTimeMS`, shop-scoped.
5. **Cleanup:** deleting a timer removes its stats and keys; `redactShop` removes both collections for the shop.
6. **Tests:** repeat counts once, 20 concurrent identical requests count once, 20 different sessions count 20, other shop's or unknown timer 404 and nothing stored, bad signature 401, bad body 400, over 1 KB 413, limiter, stats shape and isolation, delete and redact cleanup. `explain()` for the stats query in Result.
7. Add both endpoints to `docs/api.md`.

## Done when
- `tools/verify-slice.sh` passes. Append `## Result`.

## Result

**Files**
- New: `web/src/models/impression.js` (`ImpressionKeyModel` → `impression_keys`, `TimerStatsModel` → `timer_stats`), `web/migrations/003-impression-indexes.js`, `web/src/repositories/impressionRepository.js`, `web/src/services/impressionService.js`, `web/test/impressions.test.js`
- Changed: `web/src/routes/{proxy,timers}.js`, `web/src/controllers/{proxyController,timerController}.js`, `web/src/validators/{proxyRequests,timerRequests}.js`, `web/src/http/rateLimit.js` (`createProxyRateLimiter({ limit = 300, skip })`), `web/src/repositories/timerRepository.js` (`timerExists`, `findTimerIds`), `web/src/services/{timerService,shopDataService}.js`, `web/test/migrations.test.js`, `docs/api.md`

**Checks**
- `tools/verify-slice.sh` → LINT: PASS, TESTS: PASS (182 tests, 0 fail; includes slice 02's tests present at the time)
- `node --test web/test/impressions.test.js` → 8/8 pass; concurrency test re-run 5 times, all pass
- Scratch stress (not committed): 100 concurrent different sessions on one timer and day → 100 counted, 0 errors

**Behaviour**
- Record: one transaction (read `majority`, write `majority`): insert key, then upsert `$inc` the day. A duplicate key on the key insert (not transient) means already counted: abort, 202, no increment. `TransientTransactionError` (write conflicts from concurrent writers of the same key or day) retries the whole transaction, at most 10 attempts with full jitter doubling to a 250 ms cap. A 11000 on the stats upsert is not treated as a duplicate.
- Proxy limiter: the shared router-level 300/min limiter skips `POST /impressions`; the route has its own 60/min limiter with the same key (shop + first X-Forwarded-For IP). GET `/proxy/timer` behaviour and headers unchanged. JSON parser limited to 1 KB on this route only.
- Stats: `timerId` values are lowercased by the validator; repeats deduplicated; output in the order asked, own timers only. `last7Days` is always 7 entries, the UTC days ending today, oldest first, zero-filled (I6 did not say; this was my reading).
- Delete removes the timer, then its stats and keys. `redactShop` removes both collections for the shop.

**`explain("executionStats")` of the stats aggregation** (MongoDB 8.0.4, one timer):
`IXSCAN shop_1_timerId_1_day_1` bounds shop `[a, a]`, timerId `[id, id]`, day `[MinKey, MaxKey]` → FETCH → GROUP; `nReturned 1, totalKeysExamined 1, totalDocsExamined 1`. The `$in` on own timer ids runs first as `TimerModel.find({ shop, _id: { $in } }, { _id: 1 })` on the `_id` index.

**Surprising / known limits**
- Stats `$group` uses `$topN` (MongoDB 5.2+); the stack runs `mongo:8.0`.
- A timer deleted between the existence check and the write can leave an orphan stats row (shortcut comment in `impressionService.js`); `redactShop` clears it.
- If the stats delete fails after the timer delete, the timer is gone and its stats stay (500 to the client); harmless, cleared by redact.
- Prettier `--check` flags these files and also untouched ones (no repo prettier config); not enforced by lint, so not reformatted.

**For dependents**
- Storefront: `POST /proxy/impressions` JSON `{ timerId, sessionId }` → 202 `data: null`; 404 for other-shop/unknown timer; 400/401/413/429 as in `docs/api.md`.
- Admin: `GET /api/timers/stats?ids=a,b` → `data: [{ timerId, total, last7Days: [{ day, count }] }]`.
- Owner runs `npm run migrate -w shopify-app-template-node` to build the 003 indexes (not run here against any real database).
