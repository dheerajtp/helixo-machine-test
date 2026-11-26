# 12/03 — No past start date

Plan folder: [`00-README.md`](00-README.md) · Model: Sonnet · Prerequisites: 12/01 · Parallel with: 12/02

## Decisions you need
L6 — run `grep -E '^\| L6 ' docs/plans/12-no-gap/00-README.md`.

## Read first
- `web/src/services/timerService.js` (`createTimer`, `updateTimer`), `web/src/validators/timerDocument.js`
- `web/frontend/utils/timerForm.js` (`validateForm`, `formFromTimer`, `buildPayload`), `web/frontend/components/form/{DateTimeFields,TimerFormModal}.jsx`
- Current Polaris `s-date-field` docs for limiting selectable dates

## Scope (files you own)
`web/src/services/timerService.js`, `web/src/validators/timer*`, `web/frontend/**`, `web/test/**`, `docs/api.md`

## Tasks
1. **Server:** apply L6 in the service (create always; update only when `startAt` differs from the stored value), with the clock injectable for tests, as a 400 with a `startAt` detail. Not in the Mongoose schema: stored past timers stay valid.
2. **Form:** `validateForm` reports "Start cannot be in the past" on the start time (on the start date if the whole day is past) for a new timer, or an edit that changes the start date or time; an untouched stored start passes. A new form pre-fills today and the next 5-minute mark, computed when the form opens (`emptyForm(now)`); this must not count as a user change for the discard prompt. Disable earlier dates in the start date picker if the component supports it.
3. **Tests:** now and a minute ahead accepted, five minutes ago and yesterday refused, edit and enable/disable of a long-running timer accepted, moving its start further back refused, the pre-filled start near midnight (23:58 rolls to the next day). Update existing tests that create past starts through the API or service.
4. Add the rule to `docs/api.md`.

## Done when
- `tools/verify-slice.sh` and `CI=true npm run build` pass. Append `## Result`.

## Result

Changed: `web/src/services/timerService.js`, `web/frontend/utils/timerForm.js`, `web/frontend/components/form/{TimerFormModal,ScheduleFields,DateTimeFields}.jsx`, `web/test/{timer-service,timer-form}.test.js`, `docs/api.md`.

- Service: `createTimer(shop, input, now)` and `updateTimer(shop, id, patch, now)`; 400 on `startAt` when new or changed and more than 60 s before `now`. No schema change.
- Form: `emptyForm(now)` pre-fills the next 5-minute mark; `validateForm(form, timer, now)`; the start picker uses `allow="<today>--,<date the form opened with>"`, so a running timer's stored date stays selectable. `clearErrors` now clears both start errors when either start field changes.
- `tools/verify-slice.sh`: LINT PASS, TESTS PASS (165/165). `CI=true npm run build`: PASS.
- Not checked: the date picker restriction in a real browser (`allow` format taken from the current Polaris `s-date-field` docs).
- Limit: the server grace counts from the request's arrival, so a start picked in the current minute and saved right at the minute boundary can be refused by the server; the error shows on the start date field.
