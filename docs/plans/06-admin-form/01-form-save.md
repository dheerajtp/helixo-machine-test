# 06/01 — Form fields, validation, save

Plan folder: [`00-README.md`](00-README.md) · Model: Sonnet · Prerequisites: none · Parallel with: none

## Decisions you need
F1, F3, F4, F9: run `grep -E '^\| F(1|3|4|9) ' docs/plans/06-admin-form/00-README.md`.

## Read first
- `CLAUDE_FRONTEND_REACT.md`, `docs/api.md`, **the image** `docs/ui/timer-form.png`
- `web/frontend/{api,components,pages,utils}/**`, `## Result` of `docs/plans/05-admin-dashboard/01-shell-api-client.md` (React 18 + web component pitfalls)
- Current Polaris web components docs on shopify.dev for every element you use

## Scope (files you own)
`web/frontend/{api,components,pages,utils}/**`, `web/test/**`.

## Tasks
1. **Pure logic** in `utils/timerForm.js`: empty form (D1 defaults; urgency 5 minutes; enabled), form from a timer, validation with D1 limits, payload builder, server `details` to field errors. Dates are entered in local time and sent as ISO UTC. Evergreen duration is number plus unit (minutes, hours, days), sent as whole seconds within 60–2592000. Never send `null` fields; the edit payload has no `type`.
2. **API:** add `createTimer`; edit uses `updateTimer`.
3. **Modal** as in the image, one JSX component per file under `components/form/`: name, type, dates or duration, description, "Show on" choice, background color (picker plus hex field), size, position, urgency effect and minutes, enabled. State the time zone. Slice 02 adds the picker below "Show on"; until then specific targets keep existing IDs and show their count. If Polaris has no time field, use the nearest standard component and say so.
4. **Enable Create (header and empty state) and Edit.** Same modal; edit changes title and button text and locks the type.
5. **Behaviour:** field errors next to fields, request errors in a banner in the modal, values kept after failure, no double submit, confirm before discarding changed values, toast and list refresh on success, state reset when reopened.
6. **Tests** in `web/test/` for task 1, including round trip timer → form → payload, local-time conversion and server error mapping.

## Done when
- `tools/verify-slice.sh` and `CI=true npm run build` pass.
- Append `## Result`, naming what the picker slice plugs into and what was not checked in a browser.

## Result

### Changed
- New: `web/frontend/utils/timerForm.js`, `web/test/timer-form.test.js`, and in `web/frontend/components/form/`: `TimerFormModal`, `DiscardChangesModal`, `BasicFields`, `ScheduleFields`, `DateTimeFields`, `DurationFields`, `TargetingFields`, `ColorFields`, `AppearanceFields`, `UrgencyFields`, `EnabledField` (`.jsx`).
- Edited: `api/timers.js` (`createTimer`), `components/{index.js,TimerRow.jsx,TimerTable.jsx}`, `pages/index.jsx` (Create and Edit enabled).

### Checks
- `tools/verify-slice.sh`: lint PASS (rerun alone), tests PASS (111/111).
- `CI=true npm run build`: PASS.

### Differences from the image (standard component limits)
- Polaris web components have no time field: time is `s-text-field`, accepting `9:30 PM` or `21:30`.
- `s-choice-list` only stacks vertically: type and "Show on" radios are not in a row.
- The time zone line also names the zone.

### Behaviour worth knowing
- `s-modal` cannot veto closing, so the discard confirm opens after it closes; "Keep editing" reopens it with the values.
- Initial color is `#1A7F1A` (from the image; D1 has none). Dates, times and duration start empty.
- Line breaks in the description are a field error (the API rejects control characters).
- Edit sends every editable field; untouched dates are sent back as stored.

### For slice 02 (picker)
- Put it in `components/form/TargetingFields.jsx` at the marked comment; it replaces the "N selected" text.
- Set selections with `onChange({ productIds })` or `onChange({ collectionIds })` (arrays of GIDs). `targetIdsOf(form)` in `utils/timerForm.js` gives the active list; `errors.targetIds` already shows on the choice list. `TARGETS_MAX` is 100.
- The form holds IDs only, no titles. Until the picker exists, a new timer cannot be saved with specific products or collections.
- Listen to non-input events with `useElementEvent` in a component that mounts together with its element.

### Not checked in a browser (none of the UI was)
- Layout against `docs/ui/timer-form.png`, including narrow screens.
- Real Polaris events and values: `change` on choice list, select, checkbox, date field and color picker; `input` on text, number and text area; controlled `selected` and `checked`.
- `afterhide` flow (X, Escape, backdrop, Cancel), discard and reopen, nested date picker inside the modal, header button opening the modal from the admin title bar, Shopify mobile modal, toast, focus and screen reader behaviour.
