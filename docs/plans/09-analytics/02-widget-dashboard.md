# 09/02 — Widget beacon and dashboard column

Plan folder: [`00-README.md`](00-README.md) · Model: Sonnet · Prerequisites: none (the contract is I6) · Parallel with: 09/01

## Decisions you need
I1, I4, I5, I6: run `grep -E '^\| I(1|4|5|6) ' docs/plans/09-analytics/00-README.md`.

## Read first
- `CLAUDE_FRONTEND_REACT.md`
- `widget/src/index.js`, `widget/src/logic/{api,evergreen}.js`, `widget/test/controller.test.js`
- `web/frontend/{pages/index.jsx,api/timers.js,components/TimerTable.jsx,components/TimerRow.jsx}`

## Scope (files you own)
`widget/src/**`, `widget/test/**`, `web/frontend/**`, `web/test/impression-client*`

## Tasks
1. **Session id:** a random UUID kept in `sessionStorage`; blocked storage uses one in memory for the page. Nothing else about the visitor is collected (I4).
2. **Beacon (I1):** once per timer per page, when the drawn countdown first becomes visible (`IntersectionObserver`; without it, on first draw). Also remember sent timer ids in `sessionStorage` so later pages in the session do not resend. `fetch` with `keepalive`, JSON, no retry, never throws or logs, never delays rendering. An expired or missing timer sends nothing. The theme editor sends nothing (`window.Shopify.designMode`).
3. **Dashboard:** `getTimerStats(ids)` in the API client; the list page asks for the ids on the current page (one request, only when there are rows) and shows the total in the Impressions column. While loading or on failure show "—", never 0, and never break the list. No layout or design change.
4. **Tests** for the beacon rules and the client call. The widget size check must still pass.

## Done when
- `tools/verify-slice.sh` and `CI=true npm run build` pass. Append `## Result`, including the widget size.

## Result

**Changed**
- Widget: new `widget/src/logic/impression.js` (beacon, I1/I6); `read`/`write` moved unchanged from `evergreen.js` to new `logic/storage.js`; `index.js` starts watching the slot after the first successful draw and disconnects on clear.
- Dashboard: `getTimerStats(ids)` in `api/timers.js`; new `utils/impressionTotals.js`; `pages/index.jsx` queries the current page's ids (only when there are rows); `TimerTable.jsx` and `TimerRow.jsx` show the total, or "—" while loading or failed. No layout change.
- Tests: `widget/test/logic-impression.test.js`, one case in `controller.test.js`, `web/test/impression-client.test.js`.

**Checks**
- `tools/verify-slice.sh`: LINT PASS, TESTS PASS (exit 0; the full suite, including whatever 09/01 had on disk at the time).
- `CI=true npm run build`: PASS. Widget size 7.82 KB gzipped, script and CSS (was 7.49; target 15, limit 30).

**Not checked**
- No browser or store run: the beacon on the real storefront and the Impressions column against the real `/api/timers/stats` are for 03 / the owner.

**Notes**
- The sent mark is stored before the request and there is no retry, so a failed send is not counted for that session.
- Browsers without `crypto.randomUUID` (for example Safari before 15.4) are not counted.
- The widget change reaches the store only after a build and extension deploy, which the owner runs; the endpoint from 09/01 should be live first (until then the beacon fails silently).
