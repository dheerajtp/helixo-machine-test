# 11/01 — Live validation and tests

Plan folder: [`00-README.md`](00-README.md) · Model: Sonnet · Prerequisites: none · Parallel with: none

## Decisions you need
K1–K4 — run `grep -E '^\| K[1-4] ' docs/plans/11-form-validation/00-README.md`.

## Read first
- `web/frontend/utils/timerForm.js`: `emptyForm`, `parseTime`, `toIso`, `validateForm`, `clearErrors`, `serverErrors`
- `web/frontend/components/form/TimerFormModal.jsx` (state, `change`, `submit`) and the field components `BasicFields`, `DateTimeFields`, `ScheduleFields`, `DurationFields`, `ColorFields`, `UrgencyFields`
- `web/frontend/utils/useElementEvent.js`, and `## Result` of `docs/plans/05-admin-dashboard/01-shell-api-client.md`: on `s-*` elements React fires `onInput`, `onBlur`, `onFocus`; `change` needs `useElementEvent`

## Scope (files you own)
`web/frontend/components/form/**`, `web/frontend/utils/**`, `web/test/timer-form*`

## Tasks
0. **Since this slice was written:** `emptyForm(now)` pre-fills the start, and `validateForm(form, timer, now)` takes the edited timer and applies "Start cannot be in the past". Keep both signatures and pass the timer; pre-filled values the merchant has not touched show no error until submit.
1. **Pure helpers** in `utils/timerForm.js`: which errors to show given the form, the set of fields already left, and the current errors, using `validateForm` as the only source of errors (K4). A field that shows an error is rechecked on every change (K1), including related ones (start fields and end time affect `errors.endDate`; `durationUnit` affects `errors.duration`). An empty field the merchant never typed in stays clean until submit (K2). A `formatTime(text)` helper returns `h:mm AM/PM` for a valid time, otherwise the text unchanged (K3).
2. **Wire blur** (and `change` for date fields) in the field components through one callback from `TimerFormModal`. Time fields are rewritten with `formatTime` on blur. Reformatting alone must not make an untouched edit form count as changed (`isChanged` drives the discard prompt) and must not alter the stored instant sent by `buildPayload`.
3. **Keep** submit behaviour and server field errors: a server error stays until that field changes. Reset the left-field set when the modal starts a new session. Pressing Cancel or X while a field is focused must still close the modal.
4. **Tests** in `web/test/timer-form*`: nothing shown for an untouched form; error on leaving a bad name, time (`9:30 pm,`, `23:59 pm`), duration, color, urgency; clears when fixed; end-before-start appears once both are complete; `formatTime` cases; edit form unchanged after reformat.

## Done when
- `tools/verify-slice.sh` and `CI=true npm run build` pass.
- Append `## Result`, including what was not checked in a browser.

## Result

### Changed
- `web/frontend/utils/timerForm.js`: `formatTime`, and pure state helpers `changeFields`, `formatTimeField`, `leaveField` over `{ form, edited, errors, server }`. `errors` come from `validateForm`; `server` keeps the old `clearErrors` behaviour.
- `web/frontend/utils/useAfterPointer.js` (new): a field left by pressing the mouse elsewhere shows its error after the click, so a growing modal cannot move Cancel or X from under the pointer.
- `components/form/{TimerFormModal,BasicFields,ColorFields,DateTimeFields,DurationFields,ScheduleFields,UrgencyFields}.jsx`: `onLeave` on blur, and on change for date fields and the duration unit.
- `web/test/timer-form.test.js`: 7 new tests.

### Behaviour notes
- The state tracks fields the merchant changed, not fields left: a field is judged on leaving only if it was changed, so untouched empty and pre-filled fields stay clean until submit. No separate left set was needed.
- Any shown error, including `targetIds`, is now rechecked on change and stays until valid (before, any change to the field removed it).

### Checks
- `tools/verify-slice.sh`: LINT PASS, TESTS PASS (194/194, with the parallel 13 slices' work in the tree).
- `CI=true npm run build` (in `web/frontend`): PASS.

### Not checked
- Nothing was run in a browser or inside Shopify admin: blur and change events of the real Polaris web components, error display, time rewriting, and Cancel or X with a focused field are unverified.
- `useAfterPointer` has no automated test (no DOM test environment).
