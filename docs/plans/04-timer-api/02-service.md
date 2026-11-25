# 04/02 — Service: rules and status

Plan folder: [`00-README.md`](00-README.md) · Model: Sonnet · Prerequisites: 04/01 · Parallel with: none

## Decisions you need
D1, D3, D4, D7, D9: run `grep -E '^\| (D1|D3|D4|D7|D9) ' docs/plans/04-timer-api/00-README.md`.

## Read first
- `CLAUDE_BACKEND_MONGODB.md` sections 2, 3, 4, 10, 19
- `web/src/models/timer.js`, `web/src/repositories/timerRepository.js`, `web/src/http/{errors,errorHandler}.js`, `## Result` of `01-model-repository.md`

## Scope (files you own)
`web/src/services/timer*`, `web/src/validators/timerDocument.js`, `web/test/**`.

## Tasks
1. **`validators/timerDocument.js`:** one Joi schema for a complete timer's editable fields with all D1/D9 rules, exported with its per-field schemas so slice 03 reuses them. `fixed` needs `startAt` and `endAt` (end > start) and forbids `durationSeconds`; `evergreen` the reverse. `targetType` `all` stores `targetIds: []`; otherwise 1–100 unique GIDs matching the type (`gid://shopify/Product/<digits>` or `gid://shopify/Collection/<digits>`). Dates are ISO 8601 with a timezone.
2. **`services/timerService.js`** (no `req`/`res`, no Mongoose):
   - `computeStatus(timer, now = new Date())` (D3): `disabled` first; fixed: `scheduled` if `now < startAt`, `expired` if `now >= endAt`, else `active`; evergreen `active`.
   - `createTimer(shop, input)`, `getTimer(shop, id)`, `updateTimer(shop, id, patch)`, `deleteTimer(shop, id)`, `listTimers(shop, { limit, cursor, q, sort })`.
   - A missing timer, or another shop's, throws `AppError("NOT_FOUND", "Timer not found")`.
   - Create and update validate the complete document with the schema from task 1 and let the Joi error through (the error handler turns it into 400 with details). Update merges the patch over the stored timer (`appearance` merged key by key), drops fields that no longer apply (e.g. `targetIds` when `targetType` becomes `all`), validates, then writes the whole editable document, so concurrent PATCHes cannot leave an invalid mix.
   - `sortAt` (D7) is set here and recomputed when `startAt` changes.
   - Returned timers carry exactly: `id`, `name`, `type`, `enabled`, `startAt`, `endAt`, `durationSeconds`, `targetType`, `targetIds`, `description`, `appearance`, `urgencyEffect`, `urgencyThresholdSeconds`, `createdAt`, `updatedAt`, `status`. Never `shop`, `_id` or `sortAt`.
   - `listTimers` returns `{ timers, limit, nextCursor }`; the cursor is opaque base64url of `sortAt` and id, `nextCursor` is `null` on the last page, and a malformed cursor throws `AppError("VALIDATION_ERROR", ...)` with a `cursor` detail.
3. **Tests:** status in each state and at both boundaries; disabled wins; each cross-field rule; merged PATCH (changing only `endAt` to before `startAt` fails, switching target type); `type` cannot change; not found for another shop; cursor round trip and a malformed cursor. Real repository on `mongodb-memory-server`.

## Done when
- `tools/verify-slice.sh` passes.
- Append `## Result`, listing the exports slice 03 needs.

## Result

**Files:** `web/src/validators/timerDocument.js` (new), `web/src/services/timerService.js` (new), `web/test/timer-service.test.js` (new).

**Checks:** `tools/verify-slice.sh`: lint PASS, tests PASS (77 pass, 0 fail, 0 skipped), on `mongodb-memory-server` only.

**Exports for slice 03**
- `web/src/validators/timerDocument.js`
  - `timerSchema`: complete document (presence, defaults, cross-field rules); options built in.
  - `timerFields`: `name`, `type`, `enabled`, `startAt`, `endAt`, `durationSeconds`, `targetType`, `targetIds`, `description`, `appearance`, `urgencyEffect`, `urgencyThresholdSeconds`. No presence rules or defaults.
  - `appearanceFields`: `backgroundColor`, `size`, `position`. `timerFields.appearance` is the object of these, all optional.
- `web/src/services/timerService.js`
  - `computeStatus(timer, now?)`
  - `createTimer(shop, input)` -> timer
  - `getTimer(shop, id)` -> timer
  - `updateTimer(shop, id, patch)` -> timer; `patch` must be an object
  - `deleteTimer(shop, id)` -> nothing
  - `listTimers(shop, { limit, cursor, q, sort })` -> `{ timers, limit, nextCursor }`

**For slice 03**
- Create and update throw a raw Joi `ValidationError` (400 through the error handler). Not found and bad cursor throw `AppError`.
- A `type` in a PATCH that differs from the stored one is a 400 on `type`; the same value is accepted. Keep `type` in the PATCH request schema, or `stripUnknown` drops it silently.
- `startAt`, `endAt` and `durationSeconds` are `null` in returned timers when they do not apply. Sending `null` back is rejected.
- Dates come out of the field schemas as `Date` objects, which `timerSchema` accepts. Returned dates are `Date` objects (ISO strings in JSON).
- `targetType: "all"` replaces whatever `targetIds` were sent with `[]`. `timerFields.targetIds` accepts either GID kind; `timerSchema` enforces the match.
- `limit` is clamped to 20 by default and 50 at most; slice 03 still validates it, and rejects control characters in `q`.
