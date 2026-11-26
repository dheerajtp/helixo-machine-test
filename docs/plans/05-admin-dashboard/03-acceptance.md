# 05/03 — Acceptance

Plan folder: [`00-README.md`](00-README.md) · Model: Opus · Prerequisites: 05/01, 05/02 · Parallel with: none

## Decisions you need
All: run `grep -E '^\| E[0-9]+ ' docs/plans/05-admin-dashboard/00-README.md`.

## Read first
- The acceptance checklist in `00-README.md`, the `## Result` of slices 01 and 02, `docs/runbook.md`, `docs/api.md`

## Scope (files you own)
This plan folder, `docs/**`.

## Tasks
1. Run every non-manual check and record commands and output as evidence. MANUAL rows stay MANUAL.
2. `docs/runbook.md`: numbered owner steps to check the dashboard in Shopify admin, including the empty state, the error state with retry (stop MongoDB or go offline), paging and search. There is no create form yet, so give a browser-console snippet, run inside the app frame, that creates one fixed and one evergreen timer through `POST /api/timers` with a token from `shopify.idToken()`.
3. List known issues in `## Result`.

## Done when
- Each checklist row has PASS, FAIL or MANUAL with evidence; `tools/verify-slice.sh` passes. Append `## Result`.

## Result

### Changed
- `docs/runbook.md`: new section 9, "Timer dashboard": numbered owner steps for loading, empty state, console snippets (one fixed and one evergreen timer, then 23 more for paging) through `POST /api/timers` with `shopify.idToken()`, list, disable/enable, paging, search and sort, delete with modal, delete-last-row-of-page, error with retry (DevTools Offline, or stopping MongoDB), and the list of things slice 02 could not check in a browser.
- This file (Result).

### Acceptance checklist
| Row | Result | Evidence |
| --- | --- | --- |
| MANUAL: list, disable and delete work in Shopify admin | MANUAL | runbook §9 steps 1–10; `evidence-05/01-manual-list-disable-delete.txt` |
| MANUAL: empty and error states appear | MANUAL | runbook §9 steps 2 and 11; `evidence-05/02-manual-empty-error-states.txt` |
| `npm run build` passes | PASS | `CI=true npm run build` exit 0, bundle 213.10 kB / 67.16 kB gzip; `evidence-05/03-npm-run-build.txt` |

Evidence folder: the session scratchpad `evidence-05/` (not in the repo). `tools/verify-slice.sh`: LINT PASS, TESTS PASS (98/98), `evidence-05/verify-slice.txt`.

### Known issues
- Nothing has run inside Shopify admin; every web-component behaviour listed at the end of runbook §9 is unverified.
- Admin bundle is 67 KB gzipped (no budget is set for the admin; the 15/30 KB budget is for the widget).
- The list sends no `limit`, so the page size is the server default of 20.
- The error state appears only after react-query's default 3 retries (about 7 s, or about 30 s with MongoDB down because of the 5 s server-selection timeout). With MongoDB down, the session lookup may fail before the timer query; how the Shopify library answers then (500 or a re-authorize 403) is unverified.
- Empty later page without a search shows the no-match card with an empty query (slice 02).
- 2 moderate `react-router` advisories remain (fix is a major upgrade, ask first); the `write_products` scope question from slice 01 is still open.
- `npm run build` without `CI` or `SHOPIFY_API_KEY` stops on purpose (template `vite.config.js`), so the check ran with `CI=true`.
