# 08/01 — Countdown logic

Plan folder: [`00-README.md`](00-README.md) · Model: Sonnet · Prerequisites: none · Parallel with: 08/02

## Decisions you need
H3, H4, H5, H9, H12: run `grep -E '^\| H(3|4|5|9|12) ' docs/plans/08-widget/00-README.md`.

## Read first
- `CLAUDE_FRONTEND_REACT.md`, `docs/api.md` (storefront endpoint), `## Result` of `docs/plans/07-storefront-api/01-proxy-endpoint.md`

## Scope (files you own)
`widget/src/logic/**`, `widget/test/logic*`. Plain ES modules with no imports from outside `widget/src/logic`; inject `fetch`, clock and storage so Node can test them.

## Tasks
1. **Fetch (H5, H12):** `GET /apps/countdown/timer?productId&collectionIds` (at most 50 numeric ids; omit `collectionIds` entirely when there are none, the API rejects an empty value), `cache: "no-cache"`, 3 s timeout, one retry for network errors, timeouts and 5xx only. Returns the timer plus the clock offset, or `null`. Never throws. Check the response shape before trusting it.
2. **Time:** remaining seconds for fixed (with offset) and evergreen; split into days, hours, minutes, seconds; urgency when `0 < remaining <= urgencyThresholdSeconds`.
3. **Evergreen (H4):** start per timer id in `localStorage`; `sessionStorage` marks the current session, so an expired timer stays hidden for that session and restarts in the next one. Blocked or full storage, or a corrupt value, falls back to memory and never throws.
4. **Text color (H9):** black or white by the better WCAG contrast.
5. **Tests** with `node --test` in `widget/test/logic*.test.js`: expiry, evergreen reset across sessions, drift in both directions, blocked storage, bad responses, retry and timeout, contrast.

## Done when
- `tools/verify-slice.sh widget/test/logic*.test.js` passes (slice 02 adds widget tests to `npm test`).
- Append `## Result` listing the exports.

## Result

**Files:** `widget/src/logic/{api,time,evergreen,color}.js`, `widget/test/logic-api.test.js`, `widget/test/logic-time.test.js`.

**Exports.**
- `api.js`: `fetchTimer({ productId, collectionIds = [], fetch, now = Date.now, timeoutMs = 3000 })` → `Promise<{ timer, offsetMs } | null>`, never rejects. `timer` is the API's `data`; `offsetMs` is server minus shopper clock. Ids may be numbers or numeric strings.
- `time.js`: `fixedEndMs(endAt, offsetMs)`, `remainingSeconds(endMs, nowMs)` (rounded up, never below 0), `splitTime(seconds)` → `{ days, hours, minutes, seconds }`, `isUrgent(remaining, thresholdSeconds)`.
- `evergreen.js`: `evergreenEndMs(timer, scope, nowMs)` → end time in epoch ms. Pass `window` as `scope` (not `window.localStorage`, whose getter throws when storage is blocked). A past value means hidden for this session.
- `color.js`: `textColor("#rrggbb")` → `"#000000"` or `"#ffffff"`.

**For slice 03.** End time: `timer.type === "fixed" ? fixedEndMs(timer.endAt, offsetMs) : evergreenEndMs(timer, window)`. Call `evergreenEndMs` once per page load, then tick with `remainingSeconds(endMs, Date.now())`; render nothing when it is 0. `offsetMs` does not apply to evergreen.

**Limits.** `sessionStorage` is per tab, so a new tab counts as a new session (H4 as written). With the `Date` header's 1 s resolution, fixed countdowns can differ from the server by about 1 s.

**Checks.**
- `tools/verify-slice.sh widget/test/logic*.test.js` → LINT: PASS, TESTS: PASS (16 pass, 0 fail), after slice 02's `eslint.config.js` change landed (before it, lint failed only on `no-undef` for browser globals under `widget/`).
- Not checked: a real browser (storage, `no-cache` revalidation, `Date` header through the app proxy).
