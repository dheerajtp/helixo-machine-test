# 05/02 — Timer list page

Plan folder: [`00-README.md`](00-README.md) · Model: Opus · Prerequisites: 05/01 · Parallel with: none

## Decisions you need
E1–E3, E6–E10: run `grep -E '^\| E([1236789]|10) ' docs/plans/05-admin-dashboard/00-README.md`.

## Read first
- `CLAUDE_FRONTEND_REACT.md`, `docs/api.md`, **the images** `docs/ui/dashboard-list.png` and `docs/ui/dashboard-states.png`
- `web/frontend/api/**`, `App.jsx`, `pages/index.jsx`, `## Result` of `01-shell-api-client.md`
- Current Polaris web components docs on shopify.dev for every element you use

## Scope (files you own)
`web/frontend/{pages,components,utils}/**`, `web/test/**`.

## Tasks
1. **Page** as in the images, with Polaris web components and one JSX component per file. If the image shows something Polaris cannot do, use the nearest standard component and say so in Result; no custom component library.
2. **Rows:** name and description (rendered as text, never HTML), status badge with its word, type, target ("All products", "3 products", "2 collections"), schedule (fixed: start and end in the browser's local time; evergreen: "30 minutes per visitor"), `impressions ?? 0`, actions menu.
3. **Search and sort:** search debounced 300 ms, max 100 characters; sort oldest (default) / newest. Changing either returns to page 1.
4. **Paging:** next uses `nextCursor`; previous uses a stack of earlier cursors. Deleting the last row of a later page goes back one page.
5. **States** from the image: loading, empty, error with retry, no search match with "Clear search". A slow older response never replaces a newer one.
6. **Actions:** Disable/Enable sends `{ enabled }`; Delete asks first in a Polaris modal (E6). Block repeat clicks while a request runs, keep the modal open on failure, show a toast for success and failure, then refetch.
7. **Create and Edit** are disabled (E10).
8. **Pure helpers** (target, schedule, duration text, cursor stack) in `utils/`, tested in `web/test/`.

## Done when
- `tools/verify-slice.sh` and `CI=true npm run build` pass.
- Append `## Result`, including what was not checked in a real browser.

## Result

### Changed
- `web/frontend/pages/index.jsx`: the list page. It holds search (debounced 300 ms, trimmed, max 100), sort, cursor paging, react-query list, toggle and delete mutations, toasts (`useAppBridge().toast.show`), and picks the state to show.
- New components, one JSX component per file: `components/{TimerTable,TimerRow,TimerFilters,ListMessage,DeleteTimerModal}.jsx`, exported from `components/index.js`.
- New utils: `utils/timerFormat.js` (`targetText`, `durationText`, `scheduleLines`, `statusBadge`), `utils/cursorStack.js` (`firstPage`, `nextPage`, `previousPage`, `afterDelete`), `utils/useElementEvent.js` (ref-based listener for `change` and custom events, per the slice 01 pitfalls).
- New test: `web/test/timer-list-utils.test.js` (6 tests).

### Checks
- `tools/verify-slice.sh`: LINT PASS, TESTS PASS (98/98).
- `CI=true npm run build`: PASS (admin bundle 67 KB gzipped).
- Grep for `console.` / `dangerouslySetInnerHTML` in pages, components and utils: no matches.

### Design notes and deviations
- Status tones: active=success, scheduled=info, expired=neutral, disabled=caution (the nearest match to the yellow in the image).
- Loading: Polaris has no skeleton web component, so the first load shows `s-spinner` in a section. Later page, search and sort loads use `s-table loading` and keep the previous rows (`keepPreviousData`).
- Previous/Next use `s-table`'s built-in `paginate` controls (`nextpage`/`previouspage` events) rather than separate buttons.
- The subtitle under the heading is an `s-paragraph color="subdued"`.
- Stale responses: each param set is its own react-query key, and the `signal` is passed so superseded requests are aborted.
- Repeat clicks: while either mutation runs, every row action and the modal buttons are disabled. The modal closes only on delete success (`hideOverlay()`). Success and failure both show a toast, then the list refetches.
- Create (page action and empty state) and Edit (menu) are rendered disabled (E10).

### Not checked in a real browser
- Nothing ran inside Shopify admin. Not verified: rendering of every web component, `s-table` pagination events and their names, `s-menu` opening by `commandFor`, the `menu-horizontal`/`plus`/`edit`/`delete` icon names, the `s-select` `change` event, the modal's `afterhide`, `showOverlay` and `hideOverlay`, and the toasts.
- Edge: an empty later page without a search (only reachable if rows are deleted elsewhere) shows the no-match card with an empty query.
